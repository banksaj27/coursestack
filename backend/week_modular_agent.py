from __future__ import annotations

import json
from typing import AsyncGenerator

from google.genai import types

from gemini_client import get_gemini_client, get_gemini_model
from models import WeekModularGenerated, WeekModularState, WeekModule
from week_context_utils import (
    build_gemini_turns_with_trim,
    format_global_format_block,
    format_other_week_summaries,
    format_problem_set_global_block,
    format_quiz_global_block,
    strip_meta_part_labels,
)


_START_TAG = ":::WEEK_MODULES_UPDATE:::"
_END_TAG = ":::END_WEEK_MODULES_UPDATE:::"


def _extract_modules_json(raw: str) -> str | None:
    si = raw.find(_START_TAG)
    if si < 0:
        return None
    ei = raw.find(_END_TAG, si)
    if ei < 0:
        return None
    return raw[si + len(_START_TAG) : ei].strip()


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

    exam_week_rule = ""
    if week_obj is not None:
        a = (week_obj.assessment or "").strip().lower()
        if a in ("midterm", "final"):
            exam_label = "Midterm" if a == "midterm" else "Final"
            exam_week_rule = f"""
=== EXAM WEEK (syllabus tags this week as **{a}**) ===
The selected week's JSON includes `"assessment": "{a}"`. You **must**:
1. Put **exactly one** module with **kind** `exam` as the **last** item in `modules` (after every lecture, problem_set, quiz, and project for this week). **Nothing** may follow it.
2. That **exam** module's `body_md` must be a complete **{exam_label.lower()}** document students could receive: coverage (aligned with this week and cumulative expectations for a {a}), duration, allowed materials, academic integrity, and **only** **multiple-choice** (full stems + labeled options) and/or **short-answer** questions—every item **complete and gradable** (same bar as **quiz**), scaled longer than a weekly quiz when appropriate.
3. **title** / **summary** should clearly identify it as the **{exam_label.lower()}** so the timeline matches the syllabus tag.

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

=== MODULE TYPES (use these exact `kind` strings) ===
- **lecture** — See **LECTURE MODULES — TEXTBOOK STYLE** below. Each lecture `body_md` is a **chapter-like** document, not an outline.
- **project** — Spec in `body_md`: goal, deliverables, milestones, grading criteria, suggested timeline within the week.
- **problem_set** — `body_md` lists concrete problems (numbered) with full statements; students could submit written solutions. If **GLOBAL PROBLEM SET HOUSE RULES** appear above, **every** `problem_set` module’s `body_md` must satisfy them (notation, length, sections, collaboration policy, etc.).
- **quiz** — `body_md`: the **actual quiz** students would take—**only multiple-choice** (stems with labeled options) **and/or short-answer** questions (explicit prompts); plus instructions, timing, and policies as needed. **Not** a blueprint or list of topics—every item must be a complete, gradable question. If **GLOBAL QUIZ HOUSE RULES** appear above, **every** `quiz` module’s `body_md` must satisfy them (MC/SA mix, length, timing, difficulty, etc.).
- **exam** — **Only** when **EXAM WEEK** rules apply above (`assessment` is **midterm** or **final**). One **terminal** module: full **midterm** or **final** handout with real MC and/or short-answer items (longer/cumulative as appropriate). Per-exam instructor notes live in `exam_specific_rules` on the module (usually empty until set in exam studio). **Never** use `exam` when there is no exam week tag.

=== LECTURE MODULES — TEXTBOOK CHAPTER body_md (CRITICAL) ===
For every **lecture** module, `body_md` must read like **one full textbook chapter** (or major chapter section)—not slides, not a topic list, not “we will cover…”, not a short handout.

**Length (non-negotiable scale):** Aim for roughly **5–10 printed textbook pages** of reading per lecture module. That means **extensive, continuous prose**: paragraph after paragraph of explanation, motivation, and commentary between formal items—not sparse bullets. As a rough numeric guide, that is often on the order of **~2,500–8,000+ words** of instructional text (plus LaTeX and optional code), i.e. a **very long** single `body_md` string. Shorter only if the instructor explicitly asks for brevity or the syllabus slot is truly minimal.

You MUST include:
1. **Paragraph-driven exposition**: Multiple **full paragraphs** per major idea (intro, intuition, comparison to prior ideas, why definitions are shaped as they are). Use `##` and `###` headings to structure a chapter (e.g. Motivation → Core definitions → Main results → Extended examples → Connections → Pitfalls).
2. **Mathematics**: Proper LaTeX in Markdown (`$...$`, `$$...$$`). **Definitions**, **propositions/lemmas/theorems** as appropriate, with **full proofs or careful proof sketches** matching `user_profile.rigor_level` / proof-based courses—written out in prose, not “proof omitted.”
3. **Examples**: **At least three** fully worked examples (not one-liners). Each: setup → step-by-step reasoning → conclusion. Mix difficulty; at least one should combine ideas from more than one subtopic. Weave examples into the narrative, not only at the end.
4. **Code (when relevant)**: If the subject is CS, data, algorithms, stats, or anything implementation-adjacent, include **fenced code blocks** (```python or appropriate language) with runnable or near-runnable snippets, plus **paragraphs** of commentary before/after. Use **inline code** for APIs, commands, or notation. If the course is purely theoretical math with no code culture, skip code but keep proofs and prose heavy.
5. **Pitfalls / remarks**: A substantive subsection (multiple paragraphs) on common mistakes, edge cases, and misconceptions.

You MUST NOT:
- Replace long explanations with bullet lists of topic names only.
- Leave “TBD”, “exercise for the reader” without content, or placeholder sections.
- Produce a “summary chapter” of one or two screens when the spec calls for 5–10 pages of depth.

**If multiple lecture modules share one week:** Each **individual** lecture module’s `body_md` should still approximate **one chapter’s worth** of material for the topics it covers (do not split one thin lecture into many tiny files—prefer fewer, longer lectures when the syllabus allows).

=== STRUCTURE RULES ===
1. Produce **ordered** `modules` (top = earlier in the week, bottom = later). Typical week: mix of lectures + at least one **problem_set** and/or **quiz**; add a **project** when it fits the topic (e.g. implementation, extended investigation). If **EXAM WEEK** rules apply, the **last** module **must** be **kind** `exam`.
2. Cover the week's **topics** across the **lecture** modules; do not leave syllabus topics only in titles.
3. Each module needs: **id** (unique snake_case, e.g. `w3_lecture_axioms`), **kind**, **title**, **summary** (one line for the timeline card), **body_md** (substantive), optional **estimated_minutes**.
4. **instructor_notes_md**: pacing for the whole week, how modules connect, what to do in class vs async.

=== RESPOND TO THE INSTRUCTOR ===
The **last user message** in the thread is their current request. The text you show **above** the `:::WEEK_MODULES_UPDATE:::` block must **directly answer** that message: questions get answers; edit requests get a short confirmation of what you changed and why; vague asks get one focused clarifying question. Do **not** reply with only a generic recap of the week or boilerplate that ignores their wording.

=== OUTPUT FORMAT (STRICT) ===
Write a **natural** message first (plain text or light Markdown, no JSON). Do **not** use headings like "Part 1", "Part 2", or any similar labels—just talk to the instructor, then append the block.

At the **very end**, exactly one block:

:::WEEK_MODULES_UPDATE:::
{{ "modules": [ ... ], "instructor_notes_md": "...", "week_context_summary": "..." }}
:::END_WEEK_MODULES_UPDATE:::

Rules:
- Valid JSON only inside the block. Use \\n inside strings for newlines in body_md.
- Pack as much **chapter-length** lecture material as the response allows; if constrained, prioritize **complete** proofs and worked examples over filler—then the instructor can ask to continue in a follow-up turn.
- **Every** reply must include the block. **modules** must be a non-empty array unless the user explicitly asked to clear it.
- **kind** must be exactly one of: lecture, project, problem_set, quiz, exam.
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
) -> tuple[str, WeekModularGenerated, str | None]:
    blob = _extract_modules_json(raw)
    si = raw.find(_START_TAG)
    agent_message = strip_meta_part_labels(
        raw[:si].strip() if si >= 0 else raw.strip()
    )
    if not blob:
        return agent_message, fallback, None
    try:
        data = json.loads(blob)
        mods_raw = data.get("modules", [])
        modules = []
        for m in mods_raw:
            if not isinstance(m, dict):
                continue
            kind = str(m.get("kind", "lecture")).lower().strip()
            if kind not in ("lecture", "project", "problem_set", "quiz", "exam"):
                kind = "lecture"
            est = m.get("estimated_minutes")
            modules.append(
                WeekModule(
                    id=str(m.get("id", "")),
                    kind=kind,
                    title=str(m.get("title", "Untitled")),
                    summary=str(m.get("summary", "")),
                    body_md=str(m.get("body_md", "")),
                    estimated_minutes=int(est) if est is not None else None,
                    exam_specific_rules=str(m.get("exam_specific_rules", "")),
                )
            )
        notes = str(data.get("instructor_notes_md", ""))
        summary_raw = data.get("week_context_summary")
        summary = str(summary_raw).strip() if summary_raw is not None else None
        if summary == "":
            summary = None
        return agent_message, WeekModularGenerated(
            modules=modules, instructor_notes_md=notes
        ), summary
    except (json.JSONDecodeError, TypeError, ValueError):
        return agent_message, fallback, None


def _stream_chunk_text(chunk) -> str:
    try:
        t = getattr(chunk, "text", None)
        if t:
            return t
    except (ValueError, AttributeError):
        pass
    return ""


async def run_week_modular_stream(
    state: WeekModularState, user_message: str
) -> AsyncGenerator[dict, None]:
    model = get_gemini_model()
    client = get_gemini_client()
    system, turns = _build_gemini_turns(state, user_message)
    contents = _turns_to_contents(turns)

    stream = await client.aio.models.generate_content_stream(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.5,
            max_output_tokens=65536,
        ),
    )

    full_response = ""
    marker_seen = False

    async for chunk in stream:
        token = _stream_chunk_text(chunk)
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

    agent_message, new_gen, week_summary = _parse_modules(
        full_response, state.generated
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
        }),
    }

    yield {"event": "done", "data": "{}"}
