import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.dependencies import get_current_user, CurrentUser
from app.db.supabase_client import get_supabase
from app.models.quiz import QuizCreate, QuizResponse, QuestionResponse
from app.services.github_service import get_note_changes
from app.services.quiz_generator import generate_questions

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


async def _generate_quiz_background(quiz_id: str, user_id: str, body: QuizCreate):
    db = get_supabase()
    try:
        # Get user profile for repo settings
        profile = db.table("profiles").select("*").eq("id", user_id).single().execute()
        if not profile.data or not profile.data.get("repo_owner"):
            raise ValueError("User profile missing repo configuration")

        p = profile.data
        changes = await get_note_changes(
            repo_owner=p["repo_owner"],
            repo_name=p["repo_name"],
            file_prefix=p.get("file_prefix", "LN"),
            hours_lookback=body.hours_lookback,
        )

        if not changes:
            db.table("quizzes").update(
                {"status": "error", "error_message": "No notes found in the lookback window."}
            ).eq("id", quiz_id).execute()
            return

        questions = await generate_questions(changes, body.num_questions)

        # Insert questions
        question_rows = [
            {
                "id": str(uuid.uuid4()),
                "quiz_id": quiz_id,
                "question_text": q["question_text"],
                "question_type": q["question_type"],
                "choices": q.get("choices"),
                "correct_answer": q["correct_answer"],
                "explanation": q.get("explanation", ""),
                "source_file": q.get("source_file", ""),
                "position": i,
            }
            for i, q in enumerate(questions)
        ]
        db.table("questions").insert(question_rows).execute()

        source_files = list({c.filename for c in changes})
        db.table("quizzes").update(
            {
                "status": "ready",
                "source_files": source_files,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", quiz_id).execute()

    except Exception as e:
        db.table("quizzes").update(
            {"status": "error", "error_message": str(e)}
        ).eq("id", quiz_id).execute()


@router.post("", response_model=QuizResponse, status_code=201)
async def create_quiz(
    body: QuizCreate,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase()
    quiz_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    row = {
        "id": quiz_id,
        "user_id": current_user.user_id,
        "title": f"Quiz: last {body.hours_lookback}h of notes",
        "source_files": [],
        "hours_lookback": body.hours_lookback,
        "status": "generating",
        "created_at": now,
    }
    db.table("quizzes").insert(row).execute()
    background_tasks.add_task(_generate_quiz_background, quiz_id, current_user.user_id, body)

    return QuizResponse(**row, generated_at=None)


@router.get("", response_model=list[QuizResponse])
def list_quizzes(current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    result = (
        db.table("quizzes")
        .select("*")
        .eq("user_id", current_user.user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [QuizResponse(**r) for r in result.data]


@router.get("/{quiz_id}", response_model=QuizResponse)
def get_quiz(quiz_id: str, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("quizzes").select("*").eq("id", quiz_id).eq("user_id", current_user.user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return QuizResponse(**result.data)


@router.get("/{quiz_id}/questions", response_model=list[QuestionResponse])
def get_questions(quiz_id: str, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    # Verify ownership
    quiz = db.table("quizzes").select("id").eq("id", quiz_id).eq("user_id", current_user.user_id).single().execute()
    if not quiz.data:
        raise HTTPException(status_code=404, detail="Quiz not found")

    result = (
        db.table("questions")
        .select("id, quiz_id, question_text, question_type, choices, position, source_file")
        .eq("quiz_id", quiz_id)
        .order("position")
        .execute()
    )
    return [QuestionResponse(**r) for r in result.data]


@router.delete("/{quiz_id}", status_code=204)
def delete_quiz(quiz_id: str, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    db.table("quizzes").delete().eq("id", quiz_id).eq("user_id", current_user.user_id).execute()
