import json
import anthropic
from app.config import settings

MODEL = "claude-haiku-4-5-20251001"


async def grade_free_text(
    question_text: str,
    correct_answer: str,
    user_answer: str,
) -> tuple[bool, str]:
    """Returns (is_correct, feedback)"""
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    prompt = f"""You are grading a short-answer quiz question.

Question: {question_text}
Model Answer: {correct_answer}
Student Answer: {user_answer}

Evaluate the student's answer. Return ONLY valid JSON:
{{"is_correct": true, "feedback": "One or two sentence explanation."}}

Be generous: accept answers that convey the correct concept even if worded differently.
Be strict: reject answers that are missing key details or fundamentally wrong."""

    message = await client.messages.create(
        model=MODEL,
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    result = json.loads(raw)
    return result["is_correct"], result["feedback"]
