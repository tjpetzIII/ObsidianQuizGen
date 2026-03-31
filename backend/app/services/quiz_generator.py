import json
import anthropic
from app.config import settings
from app.services.github_service import FileChange

MODEL = "claude-haiku-4-5-20251001"


def build_prompt(changes: list[FileChange], num_questions: int) -> str:
    mc_count = round(num_questions * 0.6)
    ft_count = num_questions - mc_count

    notes_section = ""
    for change in changes:
        notes_section += f"\n### File: {change.filename}\n"
        notes_section += f"Commit: {change.commit_message}\n"
        notes_section += f"```\n{change.patch}\n```\n"

    return f"""You are a quiz generator for a student's personal Obsidian notes.
Given the following note changes, generate exactly {num_questions} quiz questions
({mc_count} multiple choice, {ft_count} free text/short answer).

Return ONLY a valid JSON array with this exact structure:
[
  {{
    "question_text": "...",
    "question_type": "multiple_choice",
    "choices": [{{"label": "A", "text": "..."}}, {{"label": "B", "text": "..."}}, {{"label": "C", "text": "..."}}, {{"label": "D", "text": "..."}}],
    "correct_answer": "A",
    "explanation": "Brief explanation of why this is correct.",
    "source_file": "filename.md"
  }},
  {{
    "question_text": "...",
    "question_type": "free_text",
    "choices": null,
    "correct_answer": "The ideal model answer for grading reference.",
    "explanation": "Brief explanation.",
    "source_file": "filename.md"
  }}
]

Rules:
- Questions must be directly based on the note content below
- Multiple choice must have exactly 4 options (A, B, C, D)
- Free text answers should be 1-3 sentences
- Include the source filename for each question
- Return ONLY the JSON array, no other text

Notes:
{notes_section}"""


async def generate_questions(
    changes: list[FileChange],
    num_questions: int,
) -> list[dict]:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = build_prompt(changes, num_questions)

    message = await client.messages.create(
        model=MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    questions = json.loads(raw)
    return questions
