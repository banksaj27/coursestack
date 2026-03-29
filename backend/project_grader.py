"""Grade student project submissions against the project spec using an LLM."""

from __future__ import annotations

import json
import os
from typing import AsyncGenerator

from openai import AsyncOpenAI

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


def _build_grading_prompt(
    body_md: str,
    project_title: str,
    course_topic: str,
) -> str:
    title_ctx = f" for **{project_title}**" if project_title else ""
    course_ctx = f" in **{course_topic}**" if course_topic else ""

    return f"""You are a seasoned but approachable professor grading a student's project submission{title_ctx}{course_ctx}.

=== PROJECT SPEC (what they were asked to do) ===
{body_md}

=== YOUR GRADING STYLE ===
You are **slightly critical but kind**. You genuinely want the student to succeed and learn. Your tone:
- Acknowledge what they did well **first** — be specific, not generic ("good job")
- Point out issues **directly but constructively** — frame problems as growth opportunities, not failures
- Be honest about gaps — don't sugarcoat a missing deliverable, but suggest how to fix it
- End with encouragement and concrete next steps

=== OUTPUT FORMAT (follow exactly) ===
Structure your response with these sections, using markdown:

## Grade: [letter grade] ([numeric score]/100)

A single line with the letter grade (A+, A, A-, B+, B, B-, C+, C, C-, D, F) and numeric score.

## What You Did Well
2–4 specific things the student executed effectively. Be concrete — reference particular functions, sections, arguments, or design choices.

## Areas for Improvement
2–5 specific issues, each with:
- **What's missing or weak** (be direct)
- **Why it matters** (connect to learning objectives or real-world practice)
- **How to fix it** (actionable suggestion, not vague)

## Code / Content Review
If the submission includes code: comment on structure, correctness, style, edge cases, documentation.
If writing: comment on argument strength, evidence usage, clarity, structure.
If creative: comment on concept execution, craft, ambition.

## Final Thoughts
1–2 sentences of genuine encouragement + the single most impactful thing they could improve.

=== GRADING RUBRIC ===
- **A range (90–100):** Meets all deliverables, shows depth and originality, clean execution
- **B range (80–89):** Meets most deliverables, solid work with minor gaps
- **C range (70–79):** Meets core deliverables but with notable issues or missing components
- **D range (60–69):** Significant gaps, partial execution
- **F (<60):** Major deliverables missing or fundamentally misunderstood

Be fair but lean slightly critical — an "A" should require genuinely impressive work. Most solid-but-not-exceptional submissions land in the B+ to A- range. Do not inflate grades.
"""


async def run_project_grading_stream(
    body_md: str,
    submission: str,
    project_title: str = "",
    course_topic: str = "",
) -> AsyncGenerator[dict, None]:
    client = _get_client()
    model = os.getenv("OPENAI_MODEL_PROJECT", os.getenv("OPENAI_MODEL", "gpt-4o"))

    system = _build_grading_prompt(body_md, project_title, course_topic)

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"Here is my submission:\n\n{submission}"},
    ]

    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.4,
        max_tokens=4096,
        stream=True,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield {
                "event": "token",
                "data": json.dumps({"token": delta.content}),
            }

    yield {"event": "done", "data": "{}"}
