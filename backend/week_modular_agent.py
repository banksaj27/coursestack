from __future__ import annotations

import json
import re
import traceback
from typing import Any, AsyncGenerator

from google.genai import types

from gemini_client import (
    gemini_thinking_disabled,
    get_gemini_client,
    get_gemini_model,
    streaming_chunk_text,
)
from models import (
    WeekModularGenerated,
    WeekModularState,
    WeekModule,
    parse_assessment_items_from_payload,
)
from week_context_utils import (
    assessment_markdown_format_block,
    build_gemini_turns_with_trim,
    format_global_format_block,
    format_other_week_summaries,
    format_problem_set_global_block,
    format_quiz_global_block,
    sanitize_week_modular_chat_prose,
    strip_meta_part_labels,
)

# Default total points when the model omits assessment_total_points (client matches these).
_DEFAULT_ASSESSMENT_POINTS = {
    "problem_set": 10,
    "quiz": 20,
    "exam": 100,
}


def _parse_graded_item_points(raw: object) -> list[float]:
    if raw is None or not isinstance(raw, list):
        return []
    out: list[float] = []
    for x in raw:
        try:
            out.append(float(x))
        except (TypeError, ValueError):
            continue
    return out


_START_TAG = ":::WEEK_MODULES_UPDATE:::"
_END_TAG = ":::END_WEEK_MODULES_UPDATE:::"

_REPAIR_USER_MESSAGE = (
    "Your previous reply did not include a valid, complete weekly module payload. "
    "Fix this now by outputting: (1) a **brief** reply to the instructor, then (2) **on the last lines**, "
    "the exact delimiter `:::WEEK_MODULES_UPDATE:::` followed by **one JSON object** (valid JSON only, "
    "no markdown fences around it) with keys `modules` (array), `instructor_notes_md` (string), "
    "and `week_context_summary` (string), then the closing line `:::END_WEEK_MODULES_UPDATE:::`. "
    "The `modules` array must list **every** module for this week with `id`, `kind`, `title`, "
    "`one_line_summary`, `summary`, `body_md`, and optional `estimated_minutes`. "
    "Do not omit the closing tag; do not truncate the JSON."
)

# Gemini structured output when delimited prose+JSON fails (markers missing, fences, or truncation).
_WEEK_MODULAR_RESPONSE_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "agent_message": {
            "type": "string",
            "description": "Brief reply to the instructor (1–6 sentences).",
        },
        "modules": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "kind": {"type": "string"},
                    "title": {"type": "string"},
                    "one_line_summary": {"type": "string"},
                    "summary": {"type": "string"},
                    "body_md": {"type": "string"},
                    "estimated_minutes": {"type": "integer"},
                    "exam_specific_rules": {"type": "string"},
                    "assessment_total_points": {"type": "integer"},
                    "graded_item_points": {
                        "type": "array",
                        "items": {"type": "number"},
                    },
                },
                "required": [
                    "id",
                    "kind",
                    "title",
                    "one_line_summary",
                    "summary",
                    "body_md",
                ],
            },
        },
        "instructor_notes_md": {"type": "string"},
        "week_context_summary": {"type": "string"},
    },
    "required": [
        "agent_message",
        "modules",
        "instructor_notes_md",
        "week_context_summary",
    ],
}


def _cap_chat_text(text: str, max_chars: int = 2800) -> str:
    t = (text or "").strip()
    if len(t) <= max_chars:
        return t
    return t[: max_chars - 1].rstrip() + "…"


def _strip_fenced_json(blob: str) -> str:
    """Models often wrap JSON in ```json ... ``` inside the delimiters."""
    b = blob.strip()
    if not b.startswith("```"):
        return b
    first_nl = b.find("\n")
    if first_nl == -1:
        return b
    b = b[first_nl + 1 :]
    b = b.rstrip()
    if b.endswith("```"):
        b = b[: -3].rstrip()
    return b.strip()


def _extract_modules_json(raw: str) -> str | None:
    si = raw.find(_START_TAG)
    if si < 0:
        return None
    ei = raw.find(_END_TAG, si)
    if ei < 0:
        return None
    return raw[si + len(_START_TAG) : ei].strip()


def _coerce_module_dict(m: dict) -> WeekModule | None:
    kind = str(m.get("kind", "lecture")).lower().strip()
    if kind not in ("lecture", "project", "problem_set", "quiz", "exam"):
        kind = "lecture"
    est = m.get("estimated_minutes")
    ols = m.get("one_line_summary")
    one_line = "" if ols is None else str(ols).strip()
    atp_raw = m.get("assessment_total_points")
    if atp_raw is not None:
        try:
            atp: int | None = int(float(atp_raw))
        except (TypeError, ValueError):
            atp = _DEFAULT_ASSESSMENT_POINTS.get(kind)
    else:
        atp = _DEFAULT_ASSESSMENT_POINTS.get(kind)
    gip = _parse_graded_item_points(m.get("graded_item_points"))
    aitems = parse_assessment_items_from_payload(m.get("assessment_items"))
    return WeekModule(
        id=str(m.get("id", "")),
        kind=kind,
        title=str(m.get("title", "Untitled")),
        one_line_summary=one_line,
        summary=str(m.get("summary", "")),
        body_md=str(m.get("body_md", "")),
        estimated_minutes=int(est) if est is not None else None,
        exam_specific_rules=str(m.get("exam_specific_rules", "")),
        assessment_total_points=atp,
        graded_item_points=gip,
        assessment_items=aitems,
    )


def _week_generated_from_data(
    data: dict, fallback: WeekModularGenerated
) -> tuple[WeekModularGenerated, str | None, bool]:
    """Build WeekModularGenerated from a parsed JSON object; require ≥1 module."""
    try:
        mods_raw = data.get("modules", [])
        if not isinstance(mods_raw, list):
            return fallback, None, False
        modules: list[WeekModule] = []
        for m in mods_raw:
            if isinstance(m, dict):
                mod = _coerce_module_dict(m)
                if mod.id:
                    modules.append(mod)
        if len(modules) < 1:
            return fallback, None, False
        notes = str(data.get("instructor_notes_md", ""))
        summary_raw = data.get("week_context_summary")
        summary = str(summary_raw).strip() if summary_raw is not None else None
        if summary == "":
            summary = None
        return (
            WeekModularGenerated(modules=modules, instructor_notes_md=notes),
            summary,
            True,
        )
    except (TypeError, ValueError):
        return fallback, None, False


def _try_parse_json_object_after_prose(raw: str) -> dict | None:
    """If delimiters are missing, try the last top-level JSON object in the reply."""
    t = raw.strip()
    if not t:
        return None
    # Strip optional global ```json ... ``` around entire response
    if "```" in t:
        fence = re.search(
            r"```(?:json)?\s*([\s\S]*?)\s*```",
            t,
            re.IGNORECASE,
        )
        if fence:
            inner = fence.group(1).strip()
            if inner.startswith("{"):
                try:
                    data = json.loads(inner)
                    if isinstance(data, dict) and "modules" in data:
                        return data
                except json.JSONDecodeError:
                    pass
    # Last resort: find `{` that parses to dict with "modules"
    for i in range(len(t) - 1, -1, -1):
        if t[i] != "{":
            continue
        chunk = t[i:]
        for j in range(len(chunk), 0, -1):
            try:
                data = json.loads(chunk[:j])
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict) and isinstance(data.get("modules"), list):
                return data
            break
    return None


def _build_system_prompt(state: WeekModularState) -> str:
    weeks = state.syllabus.course_plan.weeks
    week_obj = next((w for w in weeks if w.week == state.selected_week), None)
    if week_obj is None:
        week_json = "{}"
    else:
        week_json = json.dumps(
            {
                "week": week_obj.week,
                "title": week_obj.title,
                "topics": week_obj.topics,
                "has_homework": week_obj.has_homework,
                "assessment": week_obj.assessment,
            },
            indent=2,
        )

    syllabus_snapshot = json.dumps(
        {
            "topic": state.syllabus.topic,
            "user_profile": state.syllabus.user_profile.model_dump(),
            "all_weeks": [
                {
                    "week": w.week,
                    "title": w.title,
                    "topics": w.topics,
                    "has_homework": w.has_homework,
                    "assessment": w.assessment,
                }
                for w in weeks
            ],
        },
        indent=2,
    )

    current = state.generated.model_dump()
    other_summaries = format_other_week_summaries(
        state.week_summaries, state.selected_week
    )

    global_fmt = format_global_format_block(state.global_format_instructions)
    ps_global_fmt = format_problem_set_global_block(
        state.problem_set_global_instructions
    )
    quiz_global_fmt = format_quiz_global_block(state.quiz_global_instructions)

    _weekly_body_placeholder = (
        "Content will be generated when you open this module's workspace."
    )

    exam_week_rule = ""
    if week_obj is not None:
        a = (week_obj.assessment or "").strip().lower()
        if a in ("midterm", "final"):
            exam_label = "Midterm" if a == "midterm" else "Final"
            exam_week_rule = f"""
=== EXAM WEEK (syllabus tags this week as **{a}**) ===
The selected week's JSON includes `"assessment": "{a}"`. You **must**:
1. Put **exactly one** module with **kind** `exam` as the **last** item in `modules` (after every lecture, problem_set, quiz, and project for this week). **Nothing** may follow it.
2. **title** / **summary** / **one_line_summary** must clearly identify it as the **{exam_label.lower()}** (coverage intent, format, logistics) so the timeline matches the syllabus tag. **Do not** put full exam questions or a handout in `body_md` here—use the same **one-line placeholder** as every other module (see **WEEKLY PLAN — body_md** below). The full exam is generated when the instructor opens the **Exam workspace**.
3. Set **assessment_total_points** to **100**; **graded_item_points** may be **[]** until exam content exists in the workspace.

When `assessment` is **null** or missing, **do not** emit any module with **kind** `exam`.

"""

    return f"""You are an expert professor. The user is designing **one calendar week** of a course as a **sequence of modules** (like a vertical timeline), similar to how a full syllabus is broken into weeks — but here each step is a **lecture**, **project**, **problem_set**, **quiz**, or **exam**.

{global_fmt}{ps_global_fmt}{quiz_global_fmt}Course context:
{syllabus_snapshot}

**Selected week:**
{week_json}
{exam_week_rule}
=== OTHER WEEKS — COMPACT SUMMARIES ONLY ===
Short memories of what was generated for *other* weeks. Use for consistency; full structure is the syllabus JSON above.

{other_summaries}

**Current week index:** {state.selected_week}

**Current modular plan + content for THIS week:**
{json.dumps(current, indent=2)}

=== WEEKLY PLAN — body_md (CRITICAL) ===
This export is **timeline metadata only**. For **every** module (all kinds), `body_md` must be **exactly** this one line, verbatim—no extra characters or lines:
`{_weekly_body_placeholder}`
Do **not** put lecture outlines, problem statements, quiz questions, project files, or exam items in `body_md`. Full content is created when the instructor opens each module’s **workspace** (Lecture uses a multi-step notes pipeline; other kinds use studio chat or their generators).

=== MODULE TYPES (use these exact `kind` strings) ===
- **lecture** — **title**, **one_line_summary**, and **summary** describe the slice of the week’s topics this reading covers. Full chapter-length notes are generated when the instructor opens the **Lecture workspace**, not here.
- **project** — Describe the project goal and shape in **summary** only; the full spec and deliverables are created in the **Project workspace**.
- **problem_set** — **summary** describes themes and what students will practice; numbered problems are written in the **Problem set workspace**. If **GLOBAL PROBLEM SET HOUSE RULES** appear above, future workspace content should follow them; this weekly export does not include the problems in `body_md`.
- **quiz** — **summary** describes coverage and intent; actual questions belong in the **Quiz workspace**. If **GLOBAL QUIZ HOUSE RULES** appear above, they apply when the quiz is drafted later.
- **exam** — **Only** when **EXAM WEEK** rules apply above. One **terminal** module; **title** / **summary** identify the midterm or final. Full questions and handout live in the **Exam workspace**. Per-exam instructor notes may use `exam_specific_rules` later. **Never** use `exam` when there is no exam week tag.

=== GRADED MODULES — POINTS (problem_set, quiz, exam) ===
For **every** module with **kind** `problem_set`, `quiz`, or `exam` you **must** set:
- **assessment_total_points** — planned total for that module: **10** for `problem_set`, **20** for `quiz`, **100** for `exam` (unless the instructor’s message explicitly asks for different totals).
- **graded_item_points** — may be an **empty array** `[]` until real problems/questions exist in the workspace. If you include entries, they should be positive numbers that sum to **assessment_total_points** once content exists; for this lightweight weekly export, **`[]` is preferred**.

{assessment_markdown_format_block()}
**Weekly Plan vs. studio:** The block above describes how **graded** `body_md` should look **when** problems and questions are drafted in **quiz / problem set / exam studio**. For **this** weekly timeline export, **`body_md` stays the one-line placeholder**—ignore any wording elsewhere that asks for full `body_md` content in the weekly JSON.

=== STRUCTURE RULES ===
1. Produce **ordered** `modules` (top = earlier in the week, bottom = later). **GLOBAL FORMAT & STRUCTURE RULES** (if present above) **define required module kinds and counts**—e.g. “at least one project per week” ⇒ include **≥1** module with `"kind": "project"`; “only one quiz” ⇒ **exactly one** `quiz` (exam week: still one **terminal** `exam` as specified elsewhere). If global rules are silent on projects, still include **≥1 `project`** when the week’s topic supports implementation, data, or an extended artifact; only omit a project when the subject is purely theoretical **and** global rules do not require one. Typical week: multiple **lecture**s + **problem_set** + **quiz** + **project** when required or fitting. If **EXAM WEEK** rules apply, the **last** module **must** be **kind** `exam`.
2. Cover the week's **topics** across the **lecture** modules; do not leave syllabus topics only in titles.
3. **Subject alignment (critical):** Course **`topic`** plus **Selected week** `topics` define what this week is about. **Every** module—especially **`quiz`**, **`problem_set`**, **`exam`**, **`project`**, and **`lecture`**—must use **titles** and **summaries** that match that subject. **Never** reuse wording from a different discipline (e.g. do not title a quiz “Foundations of Probability” or describe probability axioms when the week is molecular biology, organic chemistry, etc.). When you **edit** or **regenerate** `modules`, **rewrite** any row whose title or summary still refers to the wrong field.
4. Each module needs: **id** (unique snake_case, e.g. `w3_lecture_axioms`), **kind**, **title**, **`one_line_summary`**, **`summary`** (see below), **`body_md`** (the single-line placeholder only), optional **estimated_minutes**.
5. **instructor_notes_md**: pacing for the whole week, how modules connect, what to do in class vs async.

=== MODULE timeline text — TWO FIELDS (every `kind`) ===
Every module has **two** strings for the Weekly Plan timeline; substantive curriculum lives in workspaces, not in `body_md`.

1. **`one_line_summary`** — **Exactly one sentence** (~12–26 words), plain text. Shown on the **collapsed** row under **title**. A hook—learning payoff, central tension, or what students will practice—**not** a truncated **`summary`**. **Forbidden:** repeating or paraphrasing the **opening** of **`summary`**; echoing **title**; long roadmap lists.

2. **`summary`** — **One short paragraph** (**about 3–6 sentences**), plain text or light Markdown. Shown **only in the expanded** panel. Describe scope, learning goals, and intent—**no** enumerated section lists, no “Key concepts” blocks, no pasted `body_md`, no multi-part outlines that duplicate a full lecture outline.

- **lecture** — **one_line_summary:** why this reading matters in one breath. **summary:** one paragraph on what the chapter will cover and the pedagogical arc—**without** listing `##` section titles as a formal table of contents.
- **problem_set** — **one_line_summary:** what they’ll spend the block doing. **summary:** themes and progression—**not** problem statements.
- **quiz** — **one_line_summary:** what skills are probed. **summary:** coverage and intent—**not** quiz items.
- **exam** — **one_line_summary:** framing (e.g. cumulative check). **summary:** coverage, format, logistics—**not** exam questions.
- **project** — **one_line_summary:** deliverable or goal in one breath. **summary:** goal and milestones at a high level—**not** the full spec.

=== RESPOND TO THE INSTRUCTOR ===
The **last user message** in the thread is their current request. The text you show **above** the `:::WEEK_MODULES_UPDATE:::` block must **directly answer** that message in **brief conversational prose only**—questions get concise answers; edit requests get a **short** confirmation of what you changed; vague asks get **one** focused clarifying question.

**Chat vs timeline (critical):** The instructor sees **full modules** on the **timeline panel** to the right. The chat must **never** duplicate that material. **Do not** paste or outline `body_md`, quiz/exam questions, problem statements, YAML-style lines (`id:`, `kind:`, `title:`, `summary:`, `body_md:`), JSON, or fenced code blocks **above** the marker. **All** module payloads—including every `body_md`, `summary`, and `one_line_summary`—belong **only** inside the JSON block.

=== OUTPUT FORMAT (STRICT) ===
Write a **short** natural message first: aim for **about 1–6 sentences** or **under ~900 characters**—plain text or light Markdown, **no JSON**, **no module field dumps**, **no fenced code**. Do **not** use headings like "Part 1", "Part 2", or any similar labels—just talk to the instructor, then append the block.

At the **very end**, exactly one block:

:::WEEK_MODULES_UPDATE:::
{{ "modules": [ ... ], "instructor_notes_md": "...", "week_context_summary": "..." }}
:::END_WEEK_MODULES_UPDATE:::

**Non-negotiable:** Without **both** markers above and **valid** JSON between them, the app **cannot** change the timeline—the instructor will see your chat text but **the modules on the right stay frozen**. A conversational reply alone is **not** an update. When they ask to change, refresh, fix, or “update the modules,” you **must** emit a fresh complete block (full `modules` array), not a description of what you would do.

Rules:
- Valid JSON only inside the block. Use \\n inside strings for newlines in body_md and summary.
- Keep **body_md** minimal: **only** the single-line placeholder (see **WEEKLY PLAN — body_md**). Do not stuff long lecture stubs or full assessments into the weekly export.
- **Every** reply must include the block with **`:::END_WEEK_MODULES_UPDATE:::`** closing the JSON. **modules** must be a non-empty array unless the user explicitly asked to clear it.
- **one_line_summary** on every module: required, **one** sentence, distinct from **summary**’s opening (see **MODULE timeline text**).
- **summary** on every module: **one short paragraph** (3–6 sentences)—scope and intent only, not full outlines or section enumerations.
- **kind** must be exactly one of: lecture, project, problem_set, quiz, exam.
- **GLOBAL FORMAT** overrides defaults: if rules require **≥1 project per week**, include at least one `"kind": "project"` entry; if they cap weekly quizzes, match that count (exam week rules still apply for `exam`).
- **week_context_summary** (REQUIRED): 4–10 sentences, plain text, max ~1200 characters. Summarize THIS week's module line-up and what students do in each type—stored for when other weeks are edited. If global format rules or global problem set or quiz house rules are in effect, note that modules follow those constraints.
"""


def _build_gemini_turns(state: WeekModularState, user_message: str) -> tuple[str, list[dict[str, str]]]:
    system = _build_system_prompt(state)
    return build_gemini_turns_with_trim(
        system,
        state.conversation_history,
        user_message,
        state.max_conversation_messages,
    )


def _turns_to_contents(turns: list[dict[str, str]]) -> list[types.Content]:
    return [
        types.Content(role=t["role"], parts=[types.Part.from_text(text=t["content"])])
        for t in turns
    ]


def _parse_modules(
    raw: str, fallback: WeekModularGenerated
) -> tuple[str, WeekModularGenerated, str | None, bool]:
    blob = _extract_modules_json(raw)
    si = raw.find(_START_TAG)
    agent_message = sanitize_week_modular_chat_prose(
        strip_meta_part_labels(raw[:si].strip() if si >= 0 else raw.strip())
    )
    if not blob:
        return agent_message, fallback, None, False
    try:
        data = json.loads(blob)
        mods_raw = data.get("modules", [])
        if not isinstance(mods_raw, list):
            return agent_message, fallback, None, False
        modules = []
        for m in mods_raw:
            if not isinstance(m, dict):
                continue
            kind = str(m.get("kind", "lecture")).lower().strip()
            if kind not in ("lecture", "project", "problem_set", "quiz", "exam"):
                kind = "lecture"
            est = m.get("estimated_minutes")
            ols = m.get("one_line_summary")
            if ols is None:
                one_line = ""
            else:
                one_line = str(ols).strip()
            atp_raw = m.get("assessment_total_points")
            if atp_raw is not None:
                try:
                    atp: int | None = int(float(atp_raw))
                except (TypeError, ValueError):
                    atp = _DEFAULT_ASSESSMENT_POINTS.get(kind)
            else:
                atp = _DEFAULT_ASSESSMENT_POINTS.get(kind)
            gip = _parse_graded_item_points(m.get("graded_item_points"))
            modules.append(
                WeekModule(
                    id=str(m.get("id", "")),
                    kind=kind,
                    title=str(m.get("title", "Untitled")),
                    one_line_summary=one_line,
                    summary=str(m.get("summary", "")),
                    body_md=str(m.get("body_md", "")),
                    estimated_minutes=int(est) if est is not None else None,
                    exam_specific_rules=str(m.get("exam_specific_rules", "")),
                    assessment_total_points=atp,
                    graded_item_points=gip,
                )
            )
        notes = str(data.get("instructor_notes_md", ""))
        summary_raw = data.get("week_context_summary")
        summary = str(summary_raw).strip() if summary_raw is not None else None
        if summary == "":
            summary = None
        return agent_message, WeekModularGenerated(
            modules=modules, instructor_notes_md=notes
        ), summary, True
    except (json.JSONDecodeError, TypeError, ValueError):
        return agent_message, fallback, None, False


async def _week_modular_repair_completion(
    client,
    model: str,
    system: str,
    base_turns: list[dict[str, str]],
    failed_raw: str,
) -> str:
    tail = failed_raw[-20000:] if len(failed_raw) > 20000 else failed_raw
    repair_turns = [
        *base_turns,
        {"role": "model", "content": tail},
        {"role": "user", "content": _REPAIR_USER_MESSAGE},
    ]
    contents = _turns_to_contents(repair_turns)
    resp = await client.aio.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.2,
            max_output_tokens=65536,
            thinking_config=gemini_thinking_disabled(),
        ),
    )
    return (resp.text or "").strip()


async def run_week_modular_stream(
    state: WeekModularState, user_message: str
) -> AsyncGenerator[dict, None]:
    model = get_gemini_model()
    client = get_gemini_client()
    system, turns = _build_gemini_turns(state, user_message)
    contents = _turns_to_contents(turns)

    full_response = ""
    marker_seen = False
    agent_message = ""
    new_gen = state.generated
    week_summary: str | None = None
    parse_ok = False

    try:
        stream = await client.aio.models.generate_content_stream(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.5,
                max_output_tokens=65536,
                thinking_config=gemini_thinking_disabled(),
            ),
        )

        async for chunk in stream:
            token = streaming_chunk_text(chunk)
            if not token:
                continue
            full_response += token

            if not marker_seen:
                if ":::WEEK_MODULES_UPDATE:::" in full_response:
                    marker_seen = True
                    pre = token.split(":::WEEK_MODULES_UPDATE:::", 1)[0]
                    if pre:
                        yield {"event": "token", "data": json.dumps({"token": pre})}
                else:
                    yield {"event": "token", "data": json.dumps({"token": token})}

        agent_message, new_gen, week_summary, parse_ok = _parse_modules(
            full_response, state.generated
        )

        if not parse_ok:
            repair_raw = await _week_modular_repair_completion(
                client, model, system, turns, full_response
            )
            ra, rg, rw, repair_ok = _parse_modules(repair_raw, state.generated)
            if repair_ok:
                agent_message, new_gen, week_summary = ra, rg, rw
                parse_ok = True
    except Exception as exc:
        traceback.print_exc()
        agent_message = (
            f"**Request failed:** {exc!s}\n\n"
            "Confirm `GOOGLE_API_KEY` in `backend/.env` and that the backend can reach "
            "the Gemini API."
        )
        new_gen = state.generated
        week_summary = None
        parse_ok = False

    if not parse_ok and not agent_message.startswith("**Request failed:**"):
        agent_message = _cap_chat_text(agent_message)
        if not agent_message:
            agent_message = "I wasn't able to refresh the modules on the timeline."
        agent_message += (
            "\n\n_(The timeline was **not** updated: the model response had no valid "
            "`:::WEEK_MODULES_UPDATE:::` / JSON block. Try sending your request again, "
            "or use **Reset & Regenerate**.)_"
        )

    new_hist = list(state.conversation_history)
    new_hist.append({"role": "user", "content": user_message})
    new_hist.append({"role": "assistant", "content": agent_message})

    yield {
        "event": "week_modules_update",
        "data": json.dumps({
            "agent_message": agent_message,
            "generated": new_gen.model_dump(),
            "conversation_history": new_hist,
            "week_context_summary": week_summary,
            "timeline_parse_ok": parse_ok,
        }),
    }

    yield {"event": "done", "data": "{}"}
