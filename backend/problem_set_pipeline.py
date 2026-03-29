"""
Multi-step problem set generation for the Problem set workspace.

1) Plan problem list (JSON).
2) Generate each problem's markdown separately.
3) Concatenate into one body_md, set points, emit problem_set_module_update.
"""

from __future__ import annotations

import json
import re
from typing import Any, AsyncGenerator

from google.genai import types

from gemini_client import (
    env_model_or,
    gemini_thinking_disabled,
    get_gemini_client,
    get_gemini_model,
)
from models import LectureStudioState
from week_context_utils import (
    assessment_markdown_format_block,
    format_global_format_block,
    format_problem_set_global_block,
)

_PROBLEMS_OUTLINE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "problems": {
            "type": "array",
            "minItems": 3,
            "maxItems": 12,
            "items": {
                "type": "object",
                "properties": {
                    "goal": {"type": "string"},
                },
                "required": ["goal"],
            },
        },
    },
    "required": ["problems"],
}


def _week_context_json(state: LectureStudioState) -> tuple[str, str]:
    weeks = state.syllabus.course_plan.weeks
    week_obj = next((w for w in weeks if w.week == state.selected_week), None)
    if week_obj is None:
        return "{}", ""
    wj = json.dumps(
        {
            "week": week_obj.week,
            "title": week_obj.title,
            "topics": week_obj.topics,
            "has_homework": week_obj.has_homework,
            "assessment": week_obj.assessment,
        },
        indent=2,
    )
    return wj, week_obj.title or ""


def _parse_outline_problems(content: str) -> list[dict[str, str]]:
    t = (content or "").strip()
    try:
        data = json.loads(t)
    except json.JSONDecodeError:
        i, j = t.find("{"), t.rfind("}")
        if i < 0 or j <= i:
            return []
        try:
            data = json.loads(t[i : j + 1])
        except json.JSONDecodeError:
            return []
    raw = data.get("problems")
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for x in raw:
        if isinstance(x, dict):
            goal = str(x.get("goal", "")).strip()
            if goal:
                out.append({"goal": goal})
    return out


def _clamp_problems(problems: list[dict[str, str]]) -> list[dict[str, str]]:
    if len(problems) > 12:
        return problems[:12]
    return problems


def _strip_duplicate_h2(md: str, _title: str) -> str:
    s = md.strip()
    if not s:
        return s
    first = s.split("\n", 1)[0].strip()
    if re.match(r"^#{1,2}\s+\S", first):
        rest = s[len(first) :].lstrip("\n").strip()
        return rest if rest else s
    return s


def _points_for_n_problems(n: int, total: float = 10.0) -> list[float]:
    """Non-negative weights summing to total (default 10 for problem_set)."""
    if n <= 0:
        return []
    if n == 1:
        return [float(total)]
    each = total / n
    pts = [round(each, 4) for _ in range(n)]
    drift = round(total - sum(pts), 4)
    if abs(drift) > 1e-6:
        pts[-1] = round(pts[-1] + drift, 4)
    return pts


def _format_pts(p: float) -> str:
    """Human-readable points for headings (e.g. 5, 3.3)."""
    if abs(p - round(p)) < 1e-6:
        return str(int(round(p)))
    s = f"{p:.2f}".rstrip("0").rstrip(".")
    return s or "0"


def _question_heading(n: int, pts: float) -> str:
    return f"Question {n} ({_format_pts(pts)} pts)"


async def run_problem_set_pipeline(
    state: LectureStudioState,
) -> AsyncGenerator[dict, None]:
    """Yields SSE-shaped dicts: problem_set_progress, problem_set_module_update, done."""
    if state.module.kind != "problem_set":
        yield {
            "event": "error",
            "data": json.dumps({"message": "Module is not a problem set."}),
        }
        return

    default_model = get_gemini_model()
    model = env_model_or("GEMINI_MODEL_PROBLEM_SET", default_model)
    client = get_gemini_client()
    mod = state.module
    week_json, week_title = _week_context_json(state)
    profile = state.syllabus.user_profile
    global_fmt = format_global_format_block(state.global_format_instructions)
    ps_global = format_problem_set_global_block(state.problem_set_global_instructions)
    assessment_fmt = assessment_markdown_format_block()

    syllabus_snapshot = json.dumps(
        {
            "topic": state.syllabus.topic,
            "user_profile": profile.model_dump(),
        },
        indent=2,
    )

    seed_stub = (mod.body_md or "").strip()
    if len(seed_stub) > 12000:
        seed_stub = seed_stub[:11997] + "..."

    yield {
        "event": "problem_set_progress",
        "data": json.dumps(
            {
                "step": "outline",
                "index": 0,
                "total": 0,
                "label": "Planning problems…",
            }
        ),
    }

    outline_system = f"""You are an expert professor planning ONE homework assignment (problem set) for a university course.
Return ONLY a JSON object matching the schema with this shape:
{{"problems":[{{"goal":"What this numbered problem should cover — skills, topic, one or two sentences (internal plan only)"}}]}}

Rules:
- Produce **between 3 and 10** distinct **graded** problems that fit **one** coherent assignment aligned with the module title and week topics.
- The published PDF/UI will show **only** headings like **Question 1 (X pts)**, **Question 2 (X pts)** — **no** separate topic titles (e.g. not "Arc Length Calculation" as the main heading). Each `goal` describes what goes **under** that numbered question.
- Order problems by increasing difficulty or logical dependency when possible.
- **No overlap:** each problem's `goal` must target **different** work; do not duplicate the same exercise twice.
- Mix is fine: some proof/short-answer, some computation, a coding part if the course is CS—match user_profile rigor.
- Respect **GLOBAL PROBLEM SET HOUSE RULES** below if present.

{global_fmt}

{ps_global}
"""

    outline_user = f"""Course snapshot:
{syllabus_snapshot}

Selected week JSON:
{week_json}

**Problem set module title:** {mod.title}
**Timeline summary (paragraph):** {mod.summary}
**Existing stub in body_md (may be the weekly placeholder only — use as hints):**
---
{seed_stub if seed_stub else "(empty — design from title + week topics)"}
---

Emit JSON only."""

    try:
        r_outline = await client.aio.models.generate_content(
            model=model,
            contents=[
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=outline_user)],
                )
            ],
            config=types.GenerateContentConfig(
                system_instruction=outline_system,
                temperature=0.35,
                max_output_tokens=8192,
                thinking_config=gemini_thinking_disabled(),
                response_mime_type="application/json",
                response_json_schema=_PROBLEMS_OUTLINE_SCHEMA,
            ),
        )
        oc = (r_outline.text or "").strip()
        problems = _clamp_problems(_parse_outline_problems(oc))
    except Exception as e:
        yield {
            "event": "error",
            "data": json.dumps(
                {"message": f"Failed to plan problems: {e!s}"},
            ),
        }
        return

    if len(problems) < 3:
        yield {
            "event": "error",
            "data": json.dumps(
                {
                    "message": "Outline did not return enough problems; try again.",
                },
            ),
        }
        return

    total_n = len(problems)
    pts_list = _points_for_n_problems(total_n, 10.0)
    question_headings = [
        _question_heading(i + 1, pts_list[i]) for i in range(total_n)
    ]
    yield {
        "event": "problem_set_progress",
        "data": json.dumps(
            {
                "step": "outline_done",
                "index": 0,
                "total": total_n,
                "label": f"Planned {total_n} problems",
            }
        ),
    }

    rigor = (profile.rigor_level or "").strip() or "typical upper-level undergraduate"
    parts: list[str] = []

    blocks_for_prompt = f"{global_fmt}\n\n{ps_global}\n\n{assessment_fmt}"

    for idx, prob in enumerate(problems):
        goal = prob["goal"]
        qh = question_headings[idx]
        yield {
            "event": "problem_set_progress",
            "data": json.dumps(
                {
                    "step": "problem",
                    "index": idx + 1,
                    "total": total_n,
                    "label": f"Writing: Question {idx + 1}",
                }
            ),
        }

        problem_system = f"""You are writing **one complete graded problem** as part of a single homework assignment in Markdown.

The assignment uses **only** top-level headings of the form **Question N (X pts)** — no separate topic titles like "Arc Length" or "Verifying Curves" as the main heading.

Output rules:
- **No assignment header or logistics block** in your output: do **not** include due date, total points line, course-wide collaboration policy, submission format, “Instructions and Guidelines”, or similar boilerplate—the app shows metadata separately. Start with the mathematical/substantive problem content (definitions, prompt, sub-parts).
- Write the **full problem statement**: clear prompt, any definitions needed, sub-parts **(a) (b)** if appropriate.
- Use LaTeX: `$...$` and `$$...$$` for math. Match rigor: **{rigor}**.
- If the subject is CS/stats, use fenced code blocks for programming tasks with clear I/O or API expectations when relevant.
- Do **not** include solutions or answer keys unless the goal explicitly asks for a "outline of approach" (prefer no solutions for a standard HW).
- Use `###` for sub-parts inside this problem. Do **not** start with `#` or `##` — the parent system will add the single allowed `##` line: **{qh}**.
- Do **not** add a duplicate `##` line with a thematic title; thematic context belongs in the prose below the system heading.
- Plain Markdown only (no JSON).

**Anti-repetition:** Earlier problems in this assignment **already exist** (you cannot see their text). Do **not** repeat the same exercise or nearly the same task. If you must refer to an earlier problem, use **at most one short sentence**—then give **new** work for **this** problem only.

{blocks_for_prompt}
"""

        prior_blocks: list[str] = []
        for j in range(idx):
            pj = problems[j]
            prior_blocks.append(
                f"- **{_question_heading(j + 1, pts_list[j])}** — planned: {pj['goal']}"
            )
        prior_text = (
            "\n".join(prior_blocks)
            if prior_blocks
            else "(none — this is the first problem)"
        )

        problem_user = f"""Published headings for this assignment (exactly this pattern; points split across problems):
{json.dumps(question_headings, indent=2)}

**You are writing ONLY the body for:** {qh}
**Content to cover:** {goal}

**Course topic:** {state.syllabus.topic}
**Week:** {week_title} (week index {state.selected_week})
**Assignment module title:** {mod.title}

**Earlier problems (already on the page — do not duplicate):**
{prior_text}

Write **only** the problem text for **{qh}** (no `##` heading in your output; start with prose or `###` sub-parts)."""

        try:
            r_prob = await client.aio.models.generate_content(
                model=model,
                contents=[
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=problem_user)],
                    )
                ],
                config=types.GenerateContentConfig(
                    system_instruction=problem_system,
                    temperature=0.45,
                    max_output_tokens=32768,
                    thinking_config=gemini_thinking_disabled(),
                ),
            )
            chunk = (r_prob.text or "").strip()
            chunk = _strip_duplicate_h2(chunk, qh)
            parts.append(f"## {qh}\n\n{chunk}\n")
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps(
                    {"message": f"Failed writing {qh}: {e!s}"},
                ),
            }
            return

    full_body = "\n".join(parts).strip()

    solution_parts: list[str] = []
    for idx, _ in enumerate(problems):
        qh = question_headings[idx]
        problem_section = parts[idx]
        yield {
            "event": "problem_set_progress",
            "data": json.dumps(
                {
                    "step": "solution",
                    "index": idx + 1,
                    "total": total_n,
                    "label": f"Answer key: Question {idx + 1}",
                }
            ),
        }

        sol_system = f"""You write the **reference solution / answer key** for **one** homework question (Markdown).

Rules:
- Match subpart structure **(a) (b)** with `###` headings when the problem uses them.
- Show complete work: proofs, calculations, code blocks if the problem asks for code.
- Use LaTeX: `$...$` and `$$...$$` for math. Match rigor: **{rigor}**.
- Do **not** copy boilerplate (due dates, policies). Do **not** repeat the problem statement verbatim—brief restatement is fine if needed.
- Start with solution content; use `###` for subparts. Do **not** add a top-level `#` or duplicate `##` — the parent will prefix **{qh}**.
- Plain Markdown only (no JSON).

{blocks_for_prompt}
"""

        sol_user = f"""**Course topic:** {state.syllabus.topic}
**Week:** {week_title}

**Problem block (this is what students see — your answer key should fully address it):**

{problem_section}

---

Write the **full solution** for **{qh}** only. Do **not** include a `##` line at the start (start with prose, `###` subparts, or a brief strategy line)."""

        try:
            r_sol = await client.aio.models.generate_content(
                model=model,
                contents=[
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=sol_user)],
                    )
                ],
                config=types.GenerateContentConfig(
                    system_instruction=sol_system,
                    temperature=0.35,
                    max_output_tokens=32768,
                    thinking_config=gemini_thinking_disabled(),
                ),
            )
            sol_chunk = (r_sol.text or "").strip()
            sol_chunk = _strip_duplicate_h2(sol_chunk, qh)
            solution_parts.append(f"## {qh}\n\n{sol_chunk}\n")
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps(
                    {"message": f"Failed writing solution for {qh}: {e!s}"},
                ),
            }
            return

    full_solution = "\n".join(solution_parts).strip()
    new_mod = mod.model_copy(
        update={
            "body_md": full_body,
            "solution_md": full_solution,
            "assessment_total_points": 10,
            "graded_item_points": pts_list,
        }
    )

    agent_message = (
        f"Generated a full problem set with **{total_n} problems** (outline + sequential writes). "
        "Ask me to adjust difficulty, add problems, or change the rubric."
    )

    yield {
        "event": "problem_set_module_update",
        "data": json.dumps(
            {
                "agent_message": agent_message,
                "module": new_mod.model_dump(),
                "conversation_history": list(state.conversation_history),
            }
        ),
    }

    yield {"event": "done", "data": "{}"}
