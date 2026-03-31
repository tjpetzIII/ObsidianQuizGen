from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class QuizCreate(BaseModel):
    hours_lookback: int = 24
    num_questions: int = 10


class QuizResponse(BaseModel):
    id: str
    user_id: str
    title: str
    source_files: list[str]
    hours_lookback: int
    status: str  # generating, ready, error
    error_message: Optional[str] = None
    created_at: datetime
    generated_at: Optional[datetime] = None


class QuestionResponse(BaseModel):
    id: str
    quiz_id: str
    question_text: str
    question_type: str  # multiple_choice, free_text
    choices: Optional[list[dict]] = None
    position: int
    source_file: str
    # correct_answer intentionally omitted
