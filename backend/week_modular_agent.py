from __future__ import annotations

import json
import os
from typing import AsyncGenerator

from openai import AsyncOpenAI

from models import WeekModularGenerated, WeekModularState, WeekModule
from week_context_utils import (
    assessment_markdown_format_block,
    build_messages_with_trim,
    format_global_format_block,
    format_other_week_summaries,
    format_problem_set_global_block,
    format_quiz_global_block,
    sanitize_week_modular_chat_prose,
    strip_meta_part_labels,
)

_client: AsyncOpenAI | None = None

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


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


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


def _cap_chat_text(text: str, max_chars: int = 2800) -> str:
    t = (text or "").strip()
    if len(t) <= max_chars:
        return t
    return t[: max_chars - 1].rstrip() + "…"


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
- **lecture** — See **LECTURE MODULES — TIMELINE STUB** below. Full chapter-length notes are generated when the instructor opens the **Lecture workspace** (separate pipeline), not in this export.
- **project** — Spec in `body_md`: goal, deliverables, milestones, grading criteria, suggested timeline within the week. Include **`## Starter Kit`** (medium-specific, **~30-minute** start) and **`## Output deliverables (copy-paste files)`** with **`=== path/filename.ext ===`** markers. **CRITICAL:** After each `=== filename ===` line, write the **COMPLETE file body** — real, runnable code or full prose — **NOT** a one-line description, heading, or placeholder like "# Script implementing X". Code projects: file tree + **working** main script (30–100+ lines) that **outlines the solution approach** — real imports, class/function signatures with docstrings, core algorithm logic as working code or `# TODO: student implements ...` with detailed comments on the expected approach, sample data loading, and a runnable `if __name__ == "__main__"` block. Also at least one helper module, `requirements.txt`, and `README.md` with setup/run instructions. Writing: MD/LaTeX with title, abstract, section headings + partial drafted prose (not stubs). Creative: full project brief. Slides: slide-by-slide MD. **Every** `=== ===` block must contain **substantive content** a student can save and immediately use.
- **problem_set** — `body_md` lists concrete problems (numbered) with full statements; students could submit written solutions. If **GLOBAL PROBLEM SET HOUSE RULES** appear above, **every** `problem_set` module’s `body_md` must satisfy them (notation, length, sections, collaboration policy, etc.).
- **quiz** — `body_md`: the **actual quiz** students would take—**only multiple-choice** (stems with labeled options) **and/or short-answer** questions (explicit prompts); plus instructions, timing, and policies as needed. **Not** a blueprint or list of topics—every item must be a complete, gradable question. If **GLOBAL QUIZ HOUSE RULES** appear above, **every** `quiz` module’s `body_md` must satisfy them (MC/SA mix, length, timing, difficulty, etc.).
- **exam** — **Only** when **EXAM WEEK** rules apply above (`assessment` is **midterm** or **final**). One **terminal** module: full **midterm** or **final** handout with real MC and/or short-answer items (longer/cumulative as appropriate). Per-exam instructor notes live in `exam_specific_rules` on the module (usually empty until set in exam studio). **Never** use `exam` when there is no exam week tag.

=== GRADED MODULES — POINTS (problem_set, quiz, exam) ===
For **every** module with **kind** `problem_set`, `quiz`, or `exam` you **must** set:
- **assessment_total_points** — total for that module: **10** for `problem_set`, **20** for `quiz`, **100** for `exam` (use these defaults unless the instructor’s message explicitly asks for different totals).
- **graded_item_points** — a JSON array of **positive numbers**, **one per graded problem or question** in **the same order** as they appear in `body_md` (typically one entry per top-level `##` question block). The numbers **must sum exactly** to **assessment_total_points**.
In **body_md**, label each item with its points (e.g. lines like **(2 pts)** or **Points: 3**) so the weights match **graded_item_points**.

{assessment_markdown_format_block()}
=== LECTURE MODULES — TIMELINE STUB body_md (CRITICAL) ===
For every **lecture** module, `body_md` here is a **planning stub for the Weekly Plan export**, not the full chapter students read in the Lecture workspace.

**Length:** Aim for roughly **~500–2,500 words** (or a bit more if needed for clarity). Use `##` and `###` headings for the **planned section structure** of the eventual chapter. Under each heading, write **short paragraphs or tight bullets** that say **what** the full section will teach (definitions named, theorems stated without full proofs, example *topics*), **not** the full textbook prose.

**Why:** When the instructor opens **Lecture workspace**, the app runs a **multi-step generator** (section outline → write each section → concatenate) to produce the **actual long-form** lecture notes. This export must give that pipeline a clear **roadmap** plus enough context to stay aligned with the week’s topics.

You MUST still include:
1. **Clear `##` / `###` roadmap** covering motivation → core ideas → formal results → examples (planned) → pitfalls (planned).
2. **LaTeX** where notation matters (you may keep key equations compact).
3. **Pointers to at least three worked-example *topics*** (what each example will demonstrate)—full step-by-step examples belong in the Lecture workspace pass, not here.
4. **Code discipline (when relevant):** note what kinds of snippets the full chapter will include; optional short fenced snippet if it helps the stub read concretely.

You MUST NOT:
- Paste a **full** 5–10 page chapter into `body_md` in this weekly export (that belongs in Lecture workspace generation).
- Replace structure with a flat topic list with no headings.
- Leave “TBD” for every section—each planned heading should have substantive stub text.

**If multiple lecture modules share one week:** Each lecture’s stub still reflects **one** coherent chapter-sized slice for its title/topics.

**Lecture `one_line_summary` vs `summary` vs `body_md`:** **`one_line_summary`** is a **single** plain sentence for the **collapsed** timeline row (see **MODULE timeline text** below)—a hook only, **no** section roadmap. **`summary`** is **not** a one-liner: it is **~one short paragraph** (about **4–10 sentences**, often **100–450 words**) shown **only when the row is expanded**. It must **outline the chapter**: what the reading covers, the **pedagogical arc**, and—**critically**—an **ordered list of the major sections** matching `body_md`’s `##` / `###` order. When you introduce that list (e.g. **Sections include:**), write the listed names in **lowercase** (sentence-style labels, **not** Title Case) and separate them with **commas**, **not** semicolons—e.g. “Sections include: motivation and scope, formal definitions, main result and proof sketch, worked examples, pitfalls.” (`body_md` headings stay normally titled; only this **summary** inline list uses lowercase comma-separated labels.) Mention one or two central definitions or results students will meet. **Do not** paste the full chapter into `summary`; **do** make the section roadmap concrete enough that the expanded panel reads like a table of contents. **`one_line_summary` must not** repeat or paraphrase the **opening** of **`summary`**.

=== STRUCTURE RULES ===
1. Produce **ordered** `modules` (top = earlier in the week, bottom = later). Typical week: mix of lectures + at least one **problem_set** and/or **quiz**; add a **project** when it fits the topic (e.g. implementation, extended investigation). If **EXAM WEEK** rules apply, the **last** module **must** be **kind** `exam`.
2. Cover the week's **topics** across the **lecture** modules; do not leave syllabus topics only in titles.
3. Each module needs: **id** (unique snake_case, e.g. `w3_lecture_axioms`), **kind**, **title**, **`one_line_summary`**, **`summary`** (see **MODULE timeline text** below), **`body_md`** (substantive full content), optional **estimated_minutes**.
4. **instructor_notes_md**: pacing for the whole week, how modules connect, what to do in class vs async.

=== MODULE timeline text — TWO FIELDS (every `kind`) ===
Every module has **two** strings for the Weekly Plan timeline (full `body_md` is for workspaces):

1. **`one_line_summary`** — **Exactly one sentence** (~12–26 words), plain text. Shown on the **collapsed** row under **title**. It must be a **different idea** from the paragraph: a hook—learning payoff, central tension, or what students will practice—**not** a truncated **summary**. **Forbidden:** repeating, rephrasing, or continuing the **first sentence** (or first ~15 words) of **`summary`**; echoing **title**; putting the **Sections include:** list here (lectures: that list belongs **only** in **`summary`**).

2. **`summary`** — **~one paragraph** (**4–10 sentences**), plain text or light Markdown. Shown **only in the expanded** panel. Must **not** be a single short sentence or a duplicate of **title**. Substantive detail.

- **lecture** — **one_line_summary:** why this reading matters or the through-line in one breath—**no** section list. **summary:** paragraph + **ordered outline of major `##`/`###` headings** from `body_md`, plus scope and key ideas. In **Sections include:** (or equivalent), **lowercase** labels and **comma** separation—no semicolons, no Title Case in that list.
- **problem_set** — **one_line_summary:** what they’ll spend the block doing (one angle). **summary:** paragraph on themes, progression, deliverables, logistics—**not** pasted problem statements.
- **quiz** — **one_line_summary:** one-sentence stake (e.g. what skills are probed). **summary:** paragraph on coverage, MC vs short-answer mix, length, skills.
- **exam** — **one_line_summary:** one-sentence framing (e.g. cumulative check). **summary:** paragraph on coverage, format, cumulative emphasis, logistics.
- **project** — **one_line_summary:** the deliverable or goal in one breath. **summary:** paragraph on goal, milestones, deliverables, grading shape—**not** the full spec.

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
- Pack as much **chapter-length** lecture material as the response allows; if constrained, prioritize **complete** proofs and worked examples over filler—then the instructor can ask to continue in a follow-up turn.
- **Every** reply must include the block with **`:::END_WEEK_MODULES_UPDATE:::`** closing the JSON. **modules** must be a non-empty array unless the user explicitly asked to clear it.
- **one_line_summary** on every module: required, **one** sentence, distinct from **summary**’s opening (see **MODULE timeline text**).
- **summary** on every module: paragraph-length expanded preview (lectures must outline section headings in **summary** only).
- **kind** must be exactly one of: lecture, project, problem_set, quiz, exam.
- **week_context_summary** (REQUIRED): 4–10 sentences, plain text, max ~1200 characters. Summarize THIS week's module line-up and what students do in each type—stored for when other weeks are edited. If global format rules or global problem set or quiz house rules are in effect, note that modules follow those constraints.
"""


def _build_messages(state: WeekModularState, user_message: str) -> list[dict]:
    system = _build_system_prompt(state)
    return build_messages_with_trim(
        system,
        state.conversation_history,
        user_message,
        state.max_conversation_messages,
    )


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
    client: AsyncOpenAI,
    model: str,
    base_messages: list[dict],
    failed_raw: str,
) -> str:
    tail = failed_raw[-20000:] if len(failed_raw) > 20000 else failed_raw
    repair_messages = [
        *base_messages,
        {"role": "assistant", "content": tail},
        {"role": "user", "content": _REPAIR_USER_MESSAGE},
    ]
    resp = await client.chat.completions.create(
        model=model,
        messages=repair_messages,
        temperature=0.2,
        max_tokens=16384,
    )
    return (resp.choices[0].message.content or "").strip()


async def run_week_modular_stream(
    state: WeekModularState, user_message: str
) -> AsyncGenerator[dict, None]:
    model = os.getenv("OPENAI_MODEL", "gpt-4o")
    client = _get_client()
    messages = _build_messages(state, user_message)

    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.5,
        max_tokens=16384,
        stream=True,
    )

    full_response = ""
    marker_seen = False

    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            token = delta.content
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
            client, model, messages, full_response
        )
        ra, rg, rw, repair_ok = _parse_modules(repair_raw, state.generated)
        if repair_ok:
            agent_message, new_gen, week_summary = ra, rg, rw
            parse_ok = True

    if not parse_ok:
        agent_message = _cap_chat_text(agent_message)
        if not agent_message:
            agent_message = "I wasn't able to refresh the modules on the timeline."
        agent_message += (
            "\n\n_(The timeline was **not** updated: the model response had no valid "
            "`:::WEEK_MODULES_UPDATE:::` / JSON block. Try sending your request again, "
            "or use **Reset & regenerate**.)_"
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
