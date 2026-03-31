from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AttemptResponse(BaseModel):
    id: str
    quiz_id: str
    user_id: str
    status: str  # in_progress, completed
    score: Optional[float] = None
    started_at: datetime
    completed_at: Optional[datetime] = None


class AnswerSubmit(BaseModel):
    question_id: str
    user_answer: str


class AnswerResponse(BaseModel):
    id: str
    attempt_id: str
    question_id: str
    user_answer: str
    is_correct: Optional[bool] = None
    ai_feedback: Optional[str] = None
    grading_status: str  # pending, graded
    submitted_at: datetime
