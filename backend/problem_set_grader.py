"""Grade a problem-set submission (PDF) against the assignment and reference answer key."""

from __future__ import annotations

import json
from typing import Any

from google.genai import types

from gemini_client import (
    env_model_or,
    gemini_thinking_disabled,
    get_gemini_client,
    get_gemini_model,
)

_GRADE_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "score": {"type": "number", "description": "Total points earned (0 to max_score)."},
        "max_score": {"type": "number", "description": "Maximum points for the assignment."},
        "feedback_md": {
            "type": "string",
            "description": "Markdown feedback for the student: strengths, gaps, brief per-question notes.",
        },
    },
    "required": ["score", "max_score", "feedback_md"],
}


def _build_system_instruction(
    syllabus_topic: str,
    module_title: str,
    body_md: str,
    solution_md: str,
    assessment_total_points: float,
    graded_item_points: list[float],
) -> str:
    pts_line = ", ".join(str(p) for p in graded_item_points) if graded_item_points else "equal weights"
    topic = syllabus_topic or "the course"
    title = module_title or "Problem set"
    return f"""You are an expert instructor grading a **typed or handwritten** homework submission provided as a **PDF**.

=== ASSIGNMENT (what the student was asked) ===
{body_md}

=== REFERENCE ANSWER KEY (authoritative solutions — for your judgment only; students never see this before grading) ===
{solution_md}

=== GRADING RULES (critical) ===
- **Total points** for this assignment: **{assessment_total_points}**. Per-question weights: **{pts_line}**.
- Award **full credit** for any solution that is **mathematically or logically correct**, even if the **presentation, notation, or steps differ** from the answer key.
- The answer key is a **guide**, not an exact string match. Partial credit is fine where work is incomplete or wrong.
- If the PDF is **illegible**, **blank**, or **unrelated**, score near zero and explain why in feedback.
- Be **fair and concise** in `feedback_md`: use markdown with short sections (e.g. ## Overall, ## By question).

=== OUTPUT ===
Return **only** a JSON object matching the schema with `score`, `max_score`, and `feedback_md`.
Set `max_score` to **{assessment_total_points}** unless the assignment text clearly implies a different total (use {assessment_total_points} here).
`score` must satisfy **0 ≤ score ≤ max_score**.

Course context: **{topic}**. Module title: **{title}**.
"""


async def grade_problem_set_pdf(
    pdf_bytes: bytes,
    syllabus_topic: str,
    module_title: str,
    body_md: str,
    solution_md: str,
    assessment_total_points: float,
    graded_item_points: list[float],
) -> dict[str, Any]:
    """Returns dict with score, max_score, feedback_md (and passes through errors as raise)."""
    client = get_gemini_client()
    default_model = get_gemini_model()
    model = env_model_or("GEMINI_MODEL_PROBLEM_SET_GRADE", default_model)

    system = _build_system_instruction(
        syllabus_topic,
        module_title,
        body_md,
        solution_md,
        assessment_total_points,
        graded_item_points,
    )

    user_parts = [
        types.Part.from_text(
            text="Grade the attached PDF submission against the assignment and rubric described in the system message.",
        ),
        types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
    ]

    r = await client.aio.models.generate_content(
        model=model,
        contents=[types.Content(role="user", parts=user_parts)],
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.25,
            max_output_tokens=8192,
            thinking_config=gemini_thinking_disabled(),
            response_mime_type="application/json",
            response_json_schema=_GRADE_JSON_SCHEMA,
        ),
    )

    raw = (r.text or "").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {
            "score": 0.0,
            "max_score": float(assessment_total_points),
            "feedback_md": f"Could not parse model output. Raw: {raw[:500]}",
            "error": "parse_failed",
        }

    score = float(data.get("score", 0))
    max_score = float(data.get("max_score", assessment_total_points))
    feedback = str(data.get("feedback_md", "")).strip() or "(No feedback returned.)"

    score = max(0.0, min(score, max_score))

    return {
        "score": score,
        "max_score": max_score,
        "feedback_md": feedback,
    }
