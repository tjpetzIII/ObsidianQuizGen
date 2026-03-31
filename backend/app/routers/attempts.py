import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.dependencies import get_current_user, CurrentUser
from app.db.supabase_client import get_supabase
from app.models.attempt import AttemptResponse, AnswerSubmit, AnswerResponse
from app.services.grader import grade_free_text

router = APIRouter(tags=["attempts"])


async def _grade_answer_background(answer_id: str, question_id: str, user_answer: str):
    db = get_supabase()
    question = db.table("questions").select("question_text, correct_answer").eq("id", question_id).single().execute()
    if not question.data:
        return

    q = question.data
    is_correct, feedback = await grade_free_text(q["question_text"], q["correct_answer"], user_answer)
    db.table("answers").update(
        {"is_correct": is_correct, "ai_feedback": feedback, "grading_status": "graded"}
    ).eq("id", answer_id).execute()


@router.post("/quizzes/{quiz_id}/attempts", response_model=AttemptResponse, status_code=201)
def start_attempt(quiz_id: str, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    quiz = db.table("quizzes").select("id").eq("id", quiz_id).eq("user_id", current_user.user_id).single().execute()
    if not quiz.data:
        raise HTTPException(status_code=404, detail="Quiz not found")

    attempt_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "id": attempt_id,
        "quiz_id": quiz_id,
        "user_id": current_user.user_id,
        "status": "in_progress",
        "started_at": now,
    }
    db.table("attempts").insert(row).execute()
    return AttemptResponse(**row)


@router.get("/attempts/{attempt_id}", response_model=AttemptResponse)
def get_attempt(attempt_id: str, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("attempts").select("*").eq("id", attempt_id).eq("user_id", current_user.user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return AttemptResponse(**result.data)


@router.post("/attempts/{attempt_id}/complete", response_model=AttemptResponse)
def complete_attempt(attempt_id: str, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    attempt = db.table("attempts").select("*").eq("id", attempt_id).eq("user_id", current_user.user_id).single().execute()
    if not attempt.data:
        raise HTTPException(status_code=404, detail="Attempt not found")

    answers = db.table("answers").select("is_correct").eq("attempt_id", attempt_id).execute()
    graded = [a for a in answers.data if a["is_correct"] is not None]
    score = sum(1 for a in graded if a["is_correct"]) / len(graded) if graded else 0.0

    now = datetime.now(timezone.utc).isoformat()
    result = db.table("attempts").update(
        {"status": "completed", "score": score, "completed_at": now}
    ).eq("id", attempt_id).execute()
    return AttemptResponse(**result.data[0])


@router.post("/attempts/{attempt_id}/answers", response_model=AnswerResponse, status_code=201)
async def submit_answer(
    attempt_id: str,
    body: AnswerSubmit,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase()
    attempt = db.table("attempts").select("id").eq("id", attempt_id).eq("user_id", current_user.user_id).single().execute()
    if not attempt.data:
        raise HTTPException(status_code=404, detail="Attempt not found")

    question = db.table("questions").select("question_type, correct_answer").eq("id", body.question_id).single().execute()
    if not question.data:
        raise HTTPException(status_code=404, detail="Question not found")

    q = question.data
    answer_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    if q["question_type"] == "multiple_choice":
        is_correct = body.user_answer.strip().upper() == q["correct_answer"].strip().upper()
        grading_status = "graded"
        ai_feedback = None
    else:
        is_correct = None
        grading_status = "pending"
        ai_feedback = None

    row = {
        "id": answer_id,
        "attempt_id": attempt_id,
        "question_id": body.question_id,
        "user_answer": body.user_answer,
        "is_correct": is_correct,
        "ai_feedback": ai_feedback,
        "grading_status": grading_status,
        "submitted_at": now,
    }
    db.table("answers").insert(row).execute()

    if q["question_type"] == "free_text":
        background_tasks.add_task(_grade_answer_background, answer_id, body.question_id, body.user_answer)

    return AnswerResponse(**row)


@router.get("/attempts/{attempt_id}/answers", response_model=list[AnswerResponse])
def get_answers(attempt_id: str, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    attempt = db.table("attempts").select("id").eq("id", attempt_id).eq("user_id", current_user.user_id).single().execute()
    if not attempt.data:
        raise HTTPException(status_code=404, detail="Attempt not found")

    result = db.table("answers").select("*").eq("attempt_id", attempt_id).execute()
    return [AnswerResponse(**r) for r in result.data]
