"""
Multi-step lecture notes generation for the Lecture workspace.

1) Plan section structure (JSON).
2) Generate each section's markdown separately.
3) Concatenate into one body_md and emit lecture_module_update.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, AsyncGenerator

from google.genai import types

from gemini_client import (
    env_model_or,
    gemini_thinking_disabled,
    get_gemini_client,
    get_gemini_model,
    streaming_chunk_text,
)
from models import LectureStudioState
from week_context_utils import format_global_format_block

_OUTLINE_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "sections": {
            "type": "array",
            "minItems": 3,
            "maxItems": 12,
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "goal": {"type": "string"},
                },
                "required": ["title", "goal"],
            },
        },
    },
    "required": ["sections"],
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


def _parse_outline_sections(content: str) -> list[dict[str, str]]:
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
    raw = data.get("sections")
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for x in raw:
        if isinstance(x, dict):
            title = str(x.get("title", "")).strip()
            if title:
                out.append(
                    {
                        "title": title,
                        "goal": str(x.get("goal", "")).strip(),
                    }
                )
    return out


def _clamp_sections(sections: list[dict[str, str]]) -> list[dict[str, str]]:
    if len(sections) > 12:
        return sections[:12]
    return sections


def _strip_duplicate_h2(md: str, _title: str) -> str:
    """Remove a leading # / ## line if the model repeated a top heading."""
    s = md.strip()
    if not s:
        return s
    first = s.split("\n", 1)[0].strip()
    if re.match(r"^#{1,2}\s+\S", first):
        rest = s[len(first) :].lstrip("\n").strip()
        return rest if rest else s
    return s


async def run_lecture_notes_pipeline(
    state: LectureStudioState,
) -> AsyncGenerator[dict, None]:
    """Yields SSE-shaped dicts: lecture_notes_progress, lecture_module_update, done."""
    if state.module.kind != "lecture":
        yield {
            "event": "error",
            "data": json.dumps({"message": "Module is not a lecture."}),
        }
        return

    default_model = get_gemini_model()
    model = env_model_or("GEMINI_MODEL_LECTURE_NOTES", default_model)
    client = get_gemini_client()
    mod = state.module
    week_json, week_title = _week_context_json(state)
    profile = state.syllabus.user_profile
    global_fmt = format_global_format_block(state.global_format_instructions)

    syllabus_snapshot = json.dumps(
        {
            "topic": state.syllabus.topic,
            "user_profile": profile.model_dump(),
        },
        indent=2,
    )

    seed_outline = (mod.body_md or "").strip()
    if len(seed_outline) > 12000:
        seed_outline = seed_outline[:11997] + "..."

    yield {
        "event": "lecture_notes_progress",
        "data": json.dumps(
            {
                "step": "outline",
                "index": 0,
                "total": 0,
                "label": "Planning lecture sections…",
            }
        ),
    }

    outline_system = f"""You are an expert professor planning ONE lecture chapter for a university course.
Return ONLY a JSON object matching the schema with this shape:
{{"sections":[{{"title":"Short specific section title (will become a ## heading)","goal":"What students must get from this section — concepts, skills, one sentence"}}]}}

Rules:
- Produce **between 5 and 10** sections that together cover **one** coherent chapter aligned with the module title and week topics.
- Titles must be **specific** (not generic placeholders like only "Introduction").
- Order sections pedagogically (motivation → core ideas → formalism → examples → synthesis / pitfalls).
- **No overlap:** each section’s `goal` must cover **different** material. Do **not** assign the same major definition, theorem, or worked-example storyline to two sections; split the chapter so each block has a single clear job.
- Respect course rigor and tone implied by user_profile when choosing depth of goals.

{global_fmt}
"""

    outline_user = f"""Course snapshot:
{syllabus_snapshot}

Selected week JSON:
{week_json}

**Lecture module title:** {mod.title}
**Timeline summary (paragraph):** {mod.summary}
**Existing outline or stub in body_md (may be short — use as hints, you may reorganize):**
---
{seed_outline if seed_outline else "(empty — design the chapter from title + week topics)"}
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
                response_json_schema=_OUTLINE_JSON_SCHEMA,
            ),
        )
        oc = (r_outline.text or "").strip()
        sections = _clamp_sections(_parse_outline_sections(oc))
    except Exception as e:
        yield {
            "event": "error",
            "data": json.dumps(
                {"message": f"Failed to plan sections: {e!s}"},
            ),
        }
        return

    if len(sections) < 3:
        yield {
            "event": "error",
            "data": json.dumps(
                {
                    "message": "Outline did not return enough sections; try again.",
                },
            ),
        }
        return

    total = len(sections)
    yield {
        "event": "lecture_notes_progress",
        "data": json.dumps(
            {
                "step": "outline_done",
                "index": 0,
                "total": total,
                "label": f"Planned {total} sections",
            }
        ),
    }

    rigor = (profile.rigor_level or "").strip() or "typical upper-level undergraduate"
    parts: list[str] = []
    headings_so_far = [s["title"] for s in sections]

    for idx, sec in enumerate(sections):
        title = sec["title"]
        goal = sec["goal"]
        yield {
            "event": "lecture_notes_progress",
            "data": json.dumps(
                {
                    "step": "section",
                    "index": idx + 1,
                    "total": total,
                    "label": f"Writing: {title}",
                }
            ),
        }

        section_system = f"""You are writing **one contiguous portion** of a single textbook-style lecture chapter in Markdown.

Output rules:
- Write **substantive prose** (multiple paragraphs). Target roughly **~500–2,000 words** for this portion unless the goal clearly needs less.
- Use `###` (and `####` if needed) for **subsections inside this portion**. Do **not** start with `#` or `##` — the parent system will add the main `##` heading.
- Use LaTeX: `$...$` and `$$...$$` for math. Include definitions, propositions/theorems and **proofs or proof sketches** when appropriate for rigor: **{rigor}**.
- Include at least **one** fully worked example in this portion if it fits the section goal; otherwise focus on tight theory.
- If the subject is CS/stats/coding-heavy, use fenced code blocks where natural.
- No meta-commentary ("In this section we will…") — start teaching directly.
- Plain Markdown only (no JSON).

**Anti-repetition (mandatory):** Earlier portions of this chapter **already exist** (you cannot see their text). You must **not** re-teach, re-prove, or re-work examples that belong to those portions. **Do not** paste or paraphrase long stretches you already covered conceptually in a prior section. If you must refer back, use **at most one short sentence** by name (e.g. “As with the MDP model above…”)—then move on to **new** material for **this** section’s goal only. If a definition or theorem was introduced earlier, **reference it**; do **not** redefine or reprove it unless this section’s goal is explicitly to **extend** it with genuinely new content.

{global_fmt}
"""

        prior_blocks: list[str] = []
        for j in range(idx):
            pj = sections[j]
            prior_blocks.append(
                f"- **{pj['title']}** — already covered: {pj['goal']}"
            )
        prior_sections_text = (
            "\n".join(prior_blocks)
            if prior_blocks
            else "(none — you are writing the opening portion of the chapter)"
        )

        section_user = f"""Full chapter section plan (headings in order):
{json.dumps(headings_so_far, indent=2)}

**You are writing ONLY the part for:**
- **Section title:** {title}
- **Goal:** {goal}

**Course topic:** {state.syllabus.topic}
**Week:** {week_title} (week index {state.selected_week})
**Module title:** {mod.title}

**Earlier sections (already written — do not repeat their substance):**
{prior_sections_text}

Write **only** the new material for **{title}** that advances the chapter without duplicating the goals above.

Write this portion now."""

        try:
            r_sec = await client.aio.models.generate_content(
                model=model,
                contents=[
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=section_user)],
                    )
                ],
                config=types.GenerateContentConfig(
                    system_instruction=section_system,
                    temperature=0.45,
                    max_output_tokens=32768,
                    thinking_config=gemini_thinking_disabled(),
                ),
            )
            chunk = (r_sec.text or "").strip()
            chunk = _strip_duplicate_h2(chunk, title)
            parts.append(f"## {title}\n\n{chunk}\n")
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps(
                    {"message": f"Failed writing section “{title}”: {e!s}"},
                ),
            }
            return

    full_body = "\n".join(parts).strip()
    new_mod = mod.model_copy(update={"body_md": full_body})

    agent_message = (
        f"Generated full lecture notes in **{total} sections** (outline + sequential writes). "
        "Ask me to clarify, add examples, or tighten any part."
    )

    yield {
        "event": "lecture_module_update",
        "data": json.dumps(
            {
                "agent_message": agent_message,
                "module": new_mod.model_dump(),
                "conversation_history": list(state.conversation_history),
            }
        ),
    }

    yield {"event": "done", "data": "{}"}
