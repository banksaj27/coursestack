from __future__ import annotations

import json
import os
from typing import AsyncGenerator

from openai import AsyncOpenAI

from models import LectureStudioState, WeekModule
from week_modular_agent import _DEFAULT_ASSESSMENT_POINTS, _parse_graded_item_points
from week_context_utils import (
    assessment_markdown_format_block,
    build_messages_with_trim,
    format_exam_specific_rules_block,
    format_global_format_block,
    format_other_week_summaries,
    format_problem_set_global_block,
    format_quiz_global_block,
    strip_meta_part_labels,
)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


_START_TAG = ":::LECTURE_MODULE_UPDATE:::"
_END_TAG = ":::END_LECTURE_MODULE_UPDATE:::"


def _extract_json(raw: str) -> str | None:
    si = raw.find(_START_TAG)
    if si < 0:
        return None
    ei = raw.find(_END_TAG, si)
    if ei < 0:
        return None
    return raw[si + len(_START_TAG) : ei].strip()


def _project_advisor_framework_block(state: LectureStudioState) -> str:
    """Rich capstone-style guidance for project modules (humanities / social sciences friendly)."""
    topic = (state.syllabus.topic or "this course").strip() or "this course"
    prof = state.syllabus.user_profile
    level_parts: list[str] = []
    if prof.rigor_level:
        level_parts.append(prof.rigor_level)
    if prof.goals:
        level_parts.append("; ".join(prof.goals[:4]))
    if prof.background:
        level_parts.append(f"Learner background: {prof.background[:200]}")
    course_level = " — ".join(level_parts) if level_parts else "infer level and stakes from syllabus and week context"

    weeks = state.syllabus.course_plan.weeks
    week_obj = next((w for w in weeks if w.week == state.selected_week), None)
    week_ctx = ""
    if week_obj is not None:
        week_ctx = f"Week {week_obj.week}: {week_obj.title}"
        if week_obj.topics:
            week_ctx += f" (topics: {', '.join(week_obj.topics[:6])})"

    return f"""=== PROJECT — ACADEMIC ADVISOR FRAMEWORK ===
Act as an **expert academic advisor** in **{topic}** (adjust subfield as needed: political science, history, philosophy, economics, CS capstone, etc., according to the real discipline of this course).

You are helping design a **final / major project** for **{topic}** with course context: **{course_level}**.
Timeline anchor: **{week_ctx or "this module week on the timeline"}**.

**Constraints — take from the user message, existing `body_md`, and GLOBAL FORMAT when present; otherwise infer sensibly:**
- Length / format (e.g. 10–15 page paper, presentation, mixed media, code + report, etc.)
- Timeframe (e.g. 3–4 weeks or fit to this week’s milestones)
- Requirements (e.g. primary sources, quantitative analysis, implementation + evaluation)

**Workflow when the user wants new ideas, a redesign, or `body_md` is thin / placeholder:**

1. Propose **4** project ideas that are **original**, **intellectually interesting**, **arguable** (not merely descriptive), and **feasible** in the stated timeframe.

2. For **each** of the **4** ideas, in **chat** (discussion-only; no JSON block yet unless they ask to save), include:
   - A clear **central question or thesis**
   - **Why it’s interesting** (tension, debate, or gap in the literature / practice)
   - **What evidence** would be used
   - A **rough outline of the argument**
   - **What would make it stand out** vs. a typical A-level project
   - **Mandatory — “Starter Kit”** (so the instructor or student could **start within ~30 minutes**). Pick the **one** medium that best fits that idea and make the kit **concrete** (not generic). Use a `## Starter Kit` subheading under that idea.

   **Coding / technical projects** — include:
   - Minimal **starter code** (core structure, key functions, or tight **pseudocode** they can paste or follow)
   - **Suggested libraries / tools** (named packages, versions if relevant)
   - **Example input/output** (at least one realistic pair or small table)

   **Writing / research projects** — include:
   - A **sample thesis statement** (one or two sharpened sentences)
   - A **paragraph-level outline** (each bullet must be a **short paragraph** of what that section does—not one-word bullets)
   - **2–3 example sources** *or* precise **directions** for finding sources (databases, keywords, archive types, datasets)

   **Art / creative projects** — include:
   - **2–3 specific reference works** (named artists, styles, movements, or pieces)
   - A **suggested composition or structure** (e.g. acts, panels, movements, layers)
   - **Constraints**: color palette, medium, theme, duration, format dimensions—**specific enough** to remove blank-page paralysis

   **Presentations / mixed media** — include:
   - **Slide-by-slide** or **scene-by-scene** outline (titles + 1 line each)
   - **Example narrative flow** (how the story or argument builds)
   - **Visual or stylistic direction** (fonts, imagery metaphors, tone, analogous decks or films)

   If an idea is **hybrid**, blend the two most relevant kits and say which medium is primary.

3. **Then** identify the **strongest** idea and refine it in **chat** into:
   - A **precise thesis statement**
   - **Section-by-section outline**
   - **Suggested sources or types of sources**
   - **Potential counterarguments** (and how a strong submission would answer them)

4. **After** that refinement, when the user confirms or asks to **put it in the handout / update the spec**, emit **one** `:::LECTURE_MODULE_UPDATE:::` block so **`body_md`** becomes the **complete student-facing project handout** embodying that chosen design: goals, deliverables, milestones, rubric, timeline, logistics, and **explicit expectations for argumentation and evidence** appropriate to **{topic}**.

   The handout **must** include a dedicated **`## Starter Kit`** section for the **assigned** project (the one the handout specifies), **expanded** from your strongest idea: same medium-specific rules as above—**concrete enough to begin in under 30 minutes** (code/pseudocode + libs + I/O, *or* sample thesis + paragraph outline + 2–3 sources, *or* references + composition + constraints, *or* slide/scene outline + narrative + visual direction). This section belongs in **`body_md`**, not only in past chat.

   **OUTPUT DELIVERABLES (IMPORTANT):** For the **chosen / best** project, `body_md` **must** also include a major section titled exactly **`## Output deliverables (copy-paste files)`** containing **concrete files** the instructor or student can **copy into separate files** on disk—**not** snippets that say “see chat.”

   **Mandatory label format** (use this exact pattern for **every** file; one blank line after the label line, then the **full** file body):
   ```
   === path/to/filename.ext ===
   <complete file contents>
   ```

   **By medium (include all that apply to the assigned project):**

   - **Coding / technical:** (1) ASCII **file tree** at the start of the section (e.g. `project/`, `src/`, `data/`, `tests/`, `main.py`). (2) **Full** contents (not truncated “…” placeholders) of: the **main** entry script, **at least one** additional module, **`requirements.txt`** (or `package.json`, `go.mod`, `Cargo.toml`, etc. as appropriate), and **`README.md`** with setup, how to run, and how to test or verify. **The code must outline the full solution approach:** include real imports, class/function signatures with docstrings explaining each function's purpose, core algorithm logic as working code or clearly marked `# TODO: student implements ...` blocks with detailed comments explaining the expected approach (e.g. "use TF-IDF to score sentences, then pick top-k"), sample data loading, and a working `if __name__ == "__main__"` block that runs end-to-end. The student should be able to read the scaffold and understand the entire solution strategy before filling in the details.

   - **Writing / research:** One structured document (**Markdown or LaTeX**) suitable to export as PDF: **Title**, **Abstract**, **section headings** each followed by **partial but real** drafted prose (not “TBD” one-liners). Put it in one or more labeled files (e.g. `paper.md`, `paper.tex`).

   - **Art / creative:** A **project brief** document (Markdown or LaTeX): references, constraints, and a **step-by-step** creation plan—each in labeled files if multiple (e.g. `brief.md`).

   - **Presentations / mixed media:** A **slide-by-slide** deck as **Markdown** (`## Slide N — Title` plus bullets per slide) **or** an explicit pseudo-**pptx** structure (for each slide: title line + body text). Use a clear filename (e.g. `slides.md` or `deck-outline.md`).

   **Hybrids:** Include the file bundle for the **primary** medium first; add secondary files (e.g. `report.md` + `src/main.py`) when the assignment truly spans both.

   **ABSOLUTE RULE — NO EMPTY OR STUB FILE BLOCKS:** Every `=== filename ===` block **must** be followed by the **complete file body** — real, runnable code (30–100+ lines for main scripts), real prose paragraphs (not headings-only), real config (not just comments). A block like:
   ```
   === main.py ===
   # Python script implementing the POS tagger
   ```
   is **FORBIDDEN** — that is a one-line description, not a file. Instead, write the **actual working Python script** with imports, functions, main block, etc. If response length is tight, shorten **optional** handout prose first—never truncate the `=== ===` file bodies. Keep **README**, dependency manifest, and **main** script **complete** for code projects.

   **Do not** paste the full handout into chat—only a short preface, per output rules.

**Small edits** (typos, tweak one milestone, adjust a single bullet): skip the 4-idea workflow; patch `body_md` directly with a short chat note.

Avoid **generic** topics. Prioritize **depth**, **originality**, and **strong argumentation** (or, for technical courses, non-trivial design choices and evaluation).

"""


def _build_system_prompt(state: LectureStudioState) -> str:
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

    mod = state.module.model_dump()
    other_summaries = format_other_week_summaries(
        state.week_summaries, state.selected_week
    )
    global_fmt = format_global_format_block(state.global_format_instructions)
    ps_global_fmt = format_problem_set_global_block(
        state.problem_set_global_instructions
    )
    quiz_global_fmt = format_quiz_global_block(state.quiz_global_instructions)

    kind = state.module.kind
    exam_specific_fmt = ""
    if kind == "exam":
        exam_specific_fmt = format_exam_specific_rules_block(
            state.module.exam_specific_rules or ""
        )
    kind_note = ""
    if kind == "lecture":
        kind_note = (
            "This module is a **lecture**: rewrite `body_md` as **one full textbook chapter**—roughly **5–10 "
            "printed pages** of reading, built from **many long paragraphs** of exposition (not sparse bullets). "
            "Target on the order of **~2,500–8,000+ words** of instructional prose plus LaTeX and optional code. "
            "Use `##`/`###` structure; full proofs or proof sketches at course rigor; **three+** worked examples "
            "woven through the text; substantive pitfalls section; fenced code + commentary when CS/stats applies. "
            "Unless the user asks to shorten, **expand** thin text toward chapter length. "
            "Provide **one_line_summary**: **one** plain sentence for the **collapsed** timeline row—a hook (why it matters / main through-line)—**not** the opening of the paragraph **summary**, **not** the **Sections include:** list. Keep **summary** as a **~paragraph** (about **4–10 sentences**) for the **expanded** panel only: include an **ordered rundown of major `##`/`###` section titles** as they appear in `body_md`, plus scope and key ideas. When listing those sections (e.g. after **Sections include:**), use **lowercase** labels separated by **commas**, not semicolons or Title Case."
        )
    elif kind == "problem_set":
        kind_note = (
            "This module is a **problem set**: rewrite `body_md` as a **full homework assignment**—roughly "
            "**3–8 printed pages** of material when rendered (many numbered items, long statements). "
            "Target on the order of **~1,500–6,000+ words** of problem text plus LaTeX and optional code. "
            "Use `##`/`###` for sections **only as needed** (e.g. Problems, optional Instructions, Rubric), subject to **GLOBAL PROBLEM SET HOUSE RULES** when present. "
            "**If the user asks to remove or omit a section** (e.g. “drop Instructions”, “no rubric”, “remove logistics”), "
            "**delete that entire section** from `body_md`—heading, body, and bullets—do **not** keep an empty heading, "
            "a one-line placeholder, or re-add it in `summary` only. "
            "Include **many** fully stated problems (not stubs): clear hypotheses, parts (a)(b)(c) where "
            "appropriate, expected deliverables, and **point values per problem** in **body_md** (and mirror them in JSON **graded_item_points**). "
            "Optional **Hints** or **Solution sketches** only if the instructor asks. "
            "Unless the user asks to shorten, **expand** thin text toward a complete take-home. "
            "**one_line_summary**: one sentence, collapsed row—distinct from **summary**’s opening. **summary**: **~paragraph** (4–10 sentences) for the expanded panel—problem themes, progression, deliverables, logistics—**not** pasted problem text."
        )
    elif kind == "quiz":
        kind_note = (
            "This module is a **quiz**: rewrite `body_md` as the **actual quiz** students would take—roughly "
            "**2–6 printed pages** when rendered (instructions, timing, policies, then numbered questions). "
            "Target on the order of **~800–4,000+ words** plus LaTeX where needed. "
            "**Every graded item must be either (a) multiple choice** with a **clear stem** and **labeled options** "
            "(e.g. A–D or A–E), **or (b) short answer** with an explicit prompt and a defined response format "
            "(e.g. one sentence, a number, a brief proof, fill in the blank with a single expression). "
            "**Do not** replace real questions with topic lists, “sample” items, blueprints, or placeholders like "
            "“Q3: induction”—each item must be a **complete** question students can answer as-is. "
            "Unless the user asks to shorten, **expand** thin text toward a complete quiz. "
            "**one_line_summary**: one sentence, collapsed row—distinct from **summary**’s opening. **summary**: **~paragraph** on coverage, MC vs short-answer mix, and skills assessed—expanded panel only."
        )
    elif kind == "project":
        kind_note = (
            "This module is a **project**: rewrite `body_md` as the **full project handout** students would receive—"
            "**clear goal**, **concrete deliverables**, **milestones** or checkpoints, **grading criteria** (rubric or weights), "
            "**timeline** within the week, collaboration/submission expectations, and constraints or starter materials as needed. "
            "Prefer **arguable**, **non-generic** assignments; when appropriate, make expectations for **thesis / question**, **evidence**, and **counterarguments** explicit in the handout (see **ACADEMIC ADVISOR FRAMEWORK**). "
            "Include **`## Output deliverables (copy-paste files)`** with `=== path/file ===` markers, each followed by the **COMPLETE file body** (real runnable code of 30–100+ lines for scripts, full prose for docs — **NOT** one-line descriptions or placeholders). Code projects: tree + working main + module + requirements.txt + README.md. Writing: MD/LaTeX with drafted prose. "
            "Target substantive length when appropriate (often **~1,000–5,000+ words** plus LaTeX/code when relevant; **much longer** when bundling full starter repos or papers). "
            "Use `##`/`###` for sections. **No** one-line stubs: every deliverable must be actionable. "
            "**one_line_summary**: one sentence, collapsed row—distinct from **summary**’s opening. **summary**: **~paragraph** on goal, milestones, main deliverables, and grading shape—**not** the full spec."
        )
    elif kind == "exam":
        kind_note = (
            "This module is an **exam** (midterm or final): rewrite `body_md` as the **actual exam** students would sit—"
            "instructions, coverage, duration, allowed materials, integrity; then **only** **multiple-choice** (stem + labeled options) "
            "and/or **short-answer** items, each **complete and gradable**—not blueprints or topic lists. "
            "Scale length and difficulty for a **cumulative** sitting when the title/summary indicate a final. "
            "Unless the user asks to shorten, **expand** thin text toward a full exam. "
            "**one_line_summary**: one sentence, collapsed row—distinct from **summary**’s opening. **summary**: **~paragraph** on coverage, format, cumulative emphasis, and logistics—expanded panel only."
        )

    if kind == "problem_set":
        intro = (
            "You are an expert professor. The user is in **one problem-set module** on the course timeline. "
            "They may **shape the assignment** (what appears in `body_md` on the right) **and/or** use the chat for "
            "**hints**, **solution-oriented discussion**, **checking their work**, or **clarifications**—often **without** "
            "changing that write-up."
        )
        job_section = f"""=== YOUR JOB ===
1. Read the **latest** user message and the current module JSON (especially `body_md`).
2. **Tutoring / Q&A** (hints, next-step nudges, “is this correct?”, compare proof or code approaches, unpack a definition, walk through intuition): reply in **prose only** (markdown, LaTeX/code fences as needed). Treat the existing `body_md` as the **source of truth** for problem statements; cite problem numbers. Prefer **hints and guiding questions** over giving a **full solution** unless they **explicitly** ask for a complete solution, a model answer, or official rubric wording.
3. **Assignment editing** (add/remove/reword problems, rubric, points, difficulty, logistics, policies, LaTeX, **whole sections**): before the update block, write **only a short** chat message (about **1–4 sentences**): what you changed or a quick confirmation. **Do not** paste the full problem set, full rubric, or long excerpts of problems into chat—the **entire** revised assignment must appear **only** inside the JSON `body_md` string, not duplicated in prose above the marker. Honor **GLOBAL PROBLEM SET HOUSE RULES** whenever that block is present. **Structural removals:** if they ask to remove “Instructions”, “logistics”, “collaboration policy”, “rubric”, or any `##` section, output `body_md` **without** that section at all (remove the `## …` heading and everything until the next peer `##` or end of doc)—**actually delete the text**, do not claim it is gone while leaving it in JSON.
4. **Mixed** requests (e.g. “fix the typo in P2 and give me a hint for P4”): give the hint in normal prose, then add **one brief** line (optional) before the block—still **no** full assignment text in chat—then **one** update block with the **full** `body_md`.
5. {kind_note}
6. Whenever you emit JSON, preserve logical **id** and **kind** (enforced server-side).
"""
        output_format_section = """=== OUTPUT FORMAT (problem_set) ===
**When you change the module** (steps 3–4): write a **short** natural-language preface (see step 3), then **immediately** end with exactly (no large markdown draft of the assignment before this):

:::LECTURE_MODULE_UPDATE:::
{ "title": "...", "one_line_summary": "...", "summary": "...", "body_md": "...", "estimated_minutes": null, "assessment_total_points": 10, "graded_item_points": [2, 2, 3, 3] }
:::END_LECTURE_MODULE_UPDATE:::

**When you are only tutoring** (step 2): write your full reply in prose. **Do not** include `:::LECTURE_MODULE_UPDATE:::` or any JSON—the assignment text on the right must stay unchanged.

Rules when the JSON block **is** present:
- Valid JSON only inside the block. Use \\n inside strings for newlines in body_md.
- **assessment_total_points** must be **10** for problem sets unless the user asks otherwise; **graded_item_points** must be a non-empty array of positive numbers summing to **assessment_total_points**, one per graded problem in order.
- **estimated_minutes** may be a number or null.
- **one_line_summary**: **one** plain sentence for the **collapsed** timeline row—a distinct hook; **do not** repeat or paraphrase the **opening** of **summary** or duplicate **title**. **summary**: **~paragraph** for the **expanded** panel only.
- **body_md** must be **non-empty** and the **complete** updated assignment unless the user explicitly asked to clear it (brief placeholder + explanation).
- **body_md** must be the **full** problem set text—not a topic list or one-line stubs.
- **Section removal** requests must change `body_md`: the removed section must be **absent** from the string you emit (verify mentally: no `## Instructions` block if they asked to remove instructions).
- The visible chat **before** the marker must stay **brief**: no numbered problem lists, no multi-paragraph reproduction of the homework, no fenced code blocks containing whole problems. Put all of that **only** in `body_md`.

Rules when **no** JSON block:
- Your chat message is the entire answer. Be helpful and precise; do not silently change the stored assignment.
"""
        output_format_section += "\n\n" + assessment_markdown_format_block()
    elif kind == "quiz":
        intro = (
            "You are an expert professor. The user is in **one quiz module** on the course timeline. "
            "They may **shape the quiz** (what appears in `body_md` on the right) **and/or** use the chat for "
            "**practice**, **strategy**, **checking reasoning**, or **clarifications**—often **without** "
            "changing that write-up."
        )
        job_section = f"""=== YOUR JOB ===
1. Read the **latest** user message and the current module JSON (especially `body_md`).
2. **Tutoring / Q&A** (explain a concept the quiz covers, discuss approach, “is this answer reasonable?”, compare methods): reply in **prose only** (markdown, LaTeX/code fences as needed). Treat the existing `body_md` as the **source of truth** for quiz items; cite question numbers. Prefer **hints and guiding questions** over giving a **full answer key** unless they **explicitly** ask for solutions or official grading notes.
3. **Quiz editing** (add/remove/reword **multiple-choice or short-answer** questions, timing, instructions, difficulty, logistics, LaTeX, **whole sections**): before the update block, write **only a short** chat message (about **1–4 sentences**): what you changed or a quick confirmation. **Do not** paste the full quiz or long excerpts into chat—the **entire** revised quiz must appear **only** inside the JSON `body_md` string, not duplicated in prose above the marker. Honor **GLOBAL QUIZ HOUSE RULES** whenever that block is present. **Structural removals:** if they ask to remove “Instructions”, “logistics”, “honor code”, or any `##` section, output `body_md` **without** that section at all—**actually delete the text**, do not claim it is gone while leaving it in JSON.
4. **Mixed** requests: give tutoring in normal prose, then **one brief** line (optional) before the block—still **no** full quiz text in chat—then **one** update block with the **full** `body_md` when edits are needed.
5. {kind_note}
6. Whenever you emit JSON, preserve logical **id** and **kind** (enforced server-side).
"""
        output_format_section = """=== OUTPUT FORMAT (quiz) ===
**When you change the module** (steps 3–4): write a **short** natural-language preface (see step 3), then **immediately** end with exactly (no large markdown draft of the quiz before this):

:::LECTURE_MODULE_UPDATE:::
{ "title": "...", "one_line_summary": "...", "summary": "...", "body_md": "...", "estimated_minutes": null, "assessment_total_points": 20, "graded_item_points": [4, 4, 4, 4, 4] }
:::END_LECTURE_MODULE_UPDATE:::

**When you are only tutoring** (step 2): write your full reply in prose. **Do not** include `:::LECTURE_MODULE_UPDATE:::` or any JSON—the quiz text on the right must stay unchanged.

Rules when the JSON block **is** present:
- Valid JSON only inside the block. Use \\n inside strings for newlines in body_md.
- **assessment_total_points** must be **20** for quizzes unless the user asks otherwise; **graded_item_points** must be a non-empty array of positive numbers summing to **assessment_total_points**, one per graded question in order.
- **estimated_minutes** may be a number or null.
- **one_line_summary**: **one** plain sentence for the **collapsed** timeline row—a distinct hook; **do not** repeat or paraphrase the **opening** of **summary** or duplicate **title**. **summary**: **~paragraph** for the **expanded** panel only.
- **body_md** must be **non-empty** and the **complete** updated quiz unless the user explicitly asked to clear it (brief placeholder + explanation).
- **body_md** must be the **full** quiz text—not a topic list, blueprint, or one-line stubs. **Questions must be real MC or short-answer items** (full stems and options where MC; explicit prompts where SA)—not “sample” or illustrative placeholders.
- **Section removal** requests must change `body_md`: the removed section must be **absent** from the string you emit.
- The visible chat **before** the marker must stay **brief**: no numbered question lists, no multi-paragraph reproduction of the quiz, no fenced code blocks containing whole items. Put all of that **only** in `body_md`.

Rules when **no** JSON block:
- Your chat message is the entire answer. Be helpful and precise; do not silently change the stored quiz.
"""
        output_format_section += "\n\n" + assessment_markdown_format_block()
    elif kind == "project":
        intro = (
            "You are an expert professor. The user is in **one project module** on the course timeline. "
            "They may **shape the project spec** (what appears in `body_md` on the right) **and/or** use the chat for "
            "**design discussion**, **scope tradeoffs**, **clarifications**, or **pedagogy**—often **without** "
            "changing that write-up."
        )
        job_section = f"""=== YOUR JOB ===
1. Read the **latest** user message and the current module JSON (especially `body_md`).
2. **Discussion / Q&A** (brainstorm extensions, compare milestone strategies, clarify ambiguity in the spec, suggest rubric tweaks conceptually without rewriting the whole doc): reply in **prose only** (markdown, LaTeX/code fences as needed). Treat the existing `body_md` as the **source of truth**; cite section names or deliverable numbers when helpful.
3. **Spec editing** (add/remove/reword deliverables, milestones, rubric, timeline, collaboration policy, constraints, LaTeX, **whole sections**): before the update block, write **only a short** chat message (about **1–4 sentences**): what you changed or a quick confirmation. **Do not** paste the full project handout or long excerpts into chat—the **entire** revised spec must appear **only** inside the JSON `body_md` string, not duplicated in prose above the marker. **Structural removals:** if they ask to remove a section (e.g. “drop rubric”, “no milestones”), output `body_md` **without** that section—**actually delete the text**, do not claim it is gone while leaving it in JSON.
4. **Mixed** requests: answer in prose, then **one brief** line (optional) before the block—still **no** full spec in chat—then **one** update block with the **full** `body_md` when edits are needed.
5. {kind_note}
6. Whenever you emit JSON, preserve logical **id** and **kind** (enforced server-side).
"""
        output_format_section = """=== OUTPUT FORMAT (project) ===
**When you change the module** (steps 3–4): write a **short** natural-language preface (see step 3), then **immediately** end with exactly (no large markdown draft of the project before this):

:::LECTURE_MODULE_UPDATE:::
{ "title": "...", "one_line_summary": "...", "summary": "...", "body_md": "...", "estimated_minutes": null }
:::END_LECTURE_MODULE_UPDATE:::

**When you are only discussing** (step 2): write your full reply in prose. **Do not** include `:::LECTURE_MODULE_UPDATE:::` or any JSON—the project spec on the right must stay unchanged.

Rules when the JSON block **is** present:
- Valid JSON only inside the block. Use \\n inside strings for newlines in body_md.
- **estimated_minutes** may be a number or null.
- **one_line_summary**: **one** plain sentence for the **collapsed** timeline row—a distinct hook; **do not** repeat or paraphrase the **opening** of **summary** or duplicate **title**. **summary**: **~paragraph** for the **expanded** panel only.
- **body_md** must be **non-empty** and the **complete** updated project spec unless the user explicitly asked to clear it (brief placeholder + explanation).
- **body_md** must be the **full** handout—not a topic list or stub bullets replacing real deliverables.
- For a **full** project handout (not a tiny patch), **body_md** must include **`## Starter Kit`** and **`## Output deliverables (copy-paste files)`** with **`=== relative/path/filename.ext ===`** labels and **complete** file bodies per the **ACADEMIC ADVISOR FRAMEWORK** (escape newlines as `\\n` inside JSON strings).
- **Section removal** requests must change `body_md`: the removed section must be **absent** from the string you emit.
- The visible chat **before** the marker must stay **brief**: no full reproduction of the spec. Put the full text **only** in `body_md`.

Rules when **no** JSON block:
- Your chat message is the entire answer. Be helpful and precise; do not silently change the stored project spec.
"""
    elif kind == "exam":
        intro = (
            "You are an expert professor. The user is in **one exam module** on the course timeline (midterm or final). "
            "They may **shape the exam** (what appears in `body_md` on the right) **and/or** use the chat for "
            "**review strategy**, **concept checks**, or **clarifications**—often **without** changing that write-up."
        )
        job_section = f"""=== YOUR JOB ===
1. Read the **latest** user message and the current module JSON (especially `body_md`).
2. **Tutoring / Q&A** (explain ideas the exam may cover, discuss study approach, “is this reasoning sound?”): reply in **prose only** (markdown, LaTeX/code fences as needed). Treat the existing `body_md` as the **source of truth**; cite question numbers. Prefer **hints and guiding questions** over a **full answer key** unless they **explicitly** ask for solutions or official grading notes.
3. **Exam editing** (add/remove/reword MC or short-answer items, timing, coverage, instructions, logistics, LaTeX, **whole sections**): before the update block, write **only a short** chat message (about **1–4 sentences**): what you changed or a quick confirmation. **Do not** paste the full exam or long excerpts into chat—the **entire** revised exam must appear **only** inside the JSON `body_md` string, not duplicated in prose above the marker. Honor **THIS EXAM — INSTRUCTOR RULES** whenever that block is present. **Structural removals:** if they ask to remove a section, output `body_md` **without** that section—**actually delete the text**, do not claim it is gone while leaving it in JSON.
4. **Mixed** requests: give tutoring in normal prose, then **one brief** line (optional) before the block—still **no** full exam text in chat—then **one** update block with the **full** `body_md` when edits are needed.
5. {kind_note}
6. Whenever you emit JSON, preserve logical **id** and **kind** (enforced server-side).
"""
        output_format_section = """=== OUTPUT FORMAT (exam) ===
**When you change the module** (steps 3–4): write a **short** natural-language preface (see step 3), then **immediately** end with exactly (no large markdown draft of the exam before this):

:::LECTURE_MODULE_UPDATE:::
{ "title": "...", "one_line_summary": "...", "summary": "...", "body_md": "...", "estimated_minutes": null, "assessment_total_points": 100, "graded_item_points": [10, 10, 10, 10, 10, 10, 10, 10, 10, 10] }
:::END_LECTURE_MODULE_UPDATE:::

**When you are only tutoring** (step 2): write your full reply in prose. **Do not** include `:::LECTURE_MODULE_UPDATE:::` or any JSON—the exam text on the right must stay unchanged.

Rules when the JSON block **is** present:
- Valid JSON only inside the block. Use \\n inside strings for newlines in body_md.
- **assessment_total_points** must be **100** for exams unless the user asks otherwise; **graded_item_points** must be a non-empty array of positive numbers summing to **assessment_total_points**, one per graded question in order.
- **estimated_minutes** may be a number or null.
- **one_line_summary**: **one** plain sentence for the **collapsed** timeline row—a distinct hook; **do not** repeat or paraphrase the **opening** of **summary** or duplicate **title**. **summary**: **~paragraph** for the **expanded** panel only.
- **body_md** must be **non-empty** and the **complete** updated exam unless the user explicitly asked to clear it (brief placeholder + explanation).
- **body_md** must be the **full** exam text—not a topic list or stubs. **Questions must be real MC or short-answer items**—not illustrative placeholders.
- **Section removal** requests must change `body_md`: the removed section must be **absent** from the string you emit.
- The visible chat **before** the marker must stay **brief**: put the full exam **only** in `body_md`.

Rules when **no** JSON block:
- Your chat message is the entire answer. Be helpful and precise; do not silently change the stored exam.
"""
        output_format_section += "\n\n" + assessment_markdown_format_block()
    else:
        intro = (
            "You are an expert professor. The instructor is editing **one module** inside a week timeline."
        )
        job_section = f"""=== YOUR JOB ===
1. Answer the instructor's **latest** message: explain, confirm edits, or ask one focused follow-up.
2. Update **only** this module's **title**, **one_line_summary**, **summary**, **body_md**, and optionally **estimated_minutes** to match what they want.
3. {kind_note}
4. Preserve **id** and **kind** logically in the JSON (we will force them to match the existing module server-side).
"""
        output_format_section = """=== OUTPUT FORMAT (STRICT) ===
Write a short natural reply first (no JSON). Then end with exactly:

:::LECTURE_MODULE_UPDATE:::
{ "title": "...", "one_line_summary": "...", "summary": "...", "body_md": "...", "estimated_minutes": null }
:::END_LECTURE_MODULE_UPDATE:::

Rules:
- Valid JSON only inside the block. Use \\n inside strings for newlines in body_md.
- **estimated_minutes** may be a number or null.
- **one_line_summary**: **one** plain sentence for the **collapsed** timeline row—a distinct hook (payoff / tension / what students do); **forbidden:** copying the **opening** of **summary**, listing **Sections include:**, or duplicating **title**. **summary**: **~paragraph** (4–10 sentences) for the **expanded** panel only.
- **Every** reply must include the block with non-empty **body_md** unless the user explicitly asked to clear it (then use a brief placeholder explaining why).
- For **lecture** modules, **body_md** in the JSON must be the **full chapter-length** material (5–10 pages, paragraph-heavy)—not an outline, not a shortened summary, not bullet-topic lists replacing prose. **summary** must be a **~paragraph** timeline preview that **lists major `##`/`###` section titles in order** matching `body_md`; in that list (e.g. **Sections include:**), **lowercase** names and **comma** separators—no semicolons, no Title Case in the list.
"""

    project_advisor_injection = (
        _project_advisor_framework_block(state) if kind == "project" else ""
    )

    return f"""{intro}

{global_fmt}{ps_global_fmt}{quiz_global_fmt}{exam_specific_fmt}Course context:
{syllabus_snapshot}

**Selected week (for context):**
{week_json}

=== OTHER WEEKS — COMPACT SUMMARIES ONLY ===
{other_summaries}

**Current week index:** {state.selected_week}

**THIS MODULE ONLY (id `{state.module.id}`, kind `{kind}`):**
{json.dumps(mod, indent=2)}

{job_section}
=== TEXTBOOK DEPTH (WHEN kind IS lecture) ===
If this module is a **lecture**, treat `body_md` as a **standalone textbook chapter**: the same scale as **5–10 printed pages**—continuous paragraphs, full mathematical argument where appropriate, multiple examples, and code when the discipline expects it. The JSON `body_md` must contain the **full chapter text**, not a plan or abstract of what you would write.

=== PROBLEM SET DEPTH (WHEN kind IS problem_set) ===
If this module is a **problem_set**, treat `body_md` as the **complete assignment** students would receive: many numbered problems with **full** statements (not “Problem 3: induction” placeholders), LaTeX where needed, coding tasks with I/O or API specs when relevant. Add **instructions / logistics** or **rubric** sections **only when** they fit the user’s intent; **strip them completely** when the user asks to remove those parts (no leftover headings). Whenever you emit an update block, the JSON `body_md` must be the **full problem set text**, not an outline—**do not** mirror that full text in the chat; keep chat to a short note then the marker. For **tutoring-only** replies, rely on the existing `body_md` and do not emit a block.

=== QUIZ DEPTH (WHEN kind IS quiz) ===
If this module is a **quiz**, treat `body_md` as the **complete quiz** students would receive: a **mix or sequence of real questions**, each in **multiple choice** (stem + labeled choices, exactly one intended correct answer unless the instructor specifies otherwise) **or short answer** (clear prompt + expected response shape). **No** blueprints, topic-only lines, or “sample question” framing—only **gradable** items. Add timing and policies when relevant; LaTeX where needed. **Strip** whole sections when the user asks to remove them (no leftover headings). Whenever you emit an update block, the JSON `body_md` must be the **full quiz text**, not an outline—**do not** mirror it in chat. For **tutoring-only** replies, rely on the existing `body_md` and do not emit a block.

{project_advisor_injection}=== PROJECT DEPTH (WHEN kind IS project) ===
If this module is a **project**, treat `body_md` as the **complete project handout**: goal, **actionable** deliverables, milestones, grading expectations, timeline, logistics, and constraints—written so a student could start work without guessing. Follow the **PROJECT — ACADEMIC ADVISOR FRAMEWORK** above for brainstorming and for shaping **argumentative depth** (thesis, evidence, counterarguments) when the discipline calls for it. The handout **must** contain **`## Starter Kit`** and **`## Output deliverables (copy-paste files)`** with **`=== filename ===`** blocks (**full** key files for code; MD/LaTeX PDF-ready drafts for writing; brief + plan for creative; slide-by-slide for decks). Whenever you emit an update block, the JSON `body_md` must be the **full spec**, not an outline—**do not** mirror it in chat. For **discussion-only** replies, rely on the existing `body_md` and do not emit a block.

=== EXAM DEPTH (WHEN kind IS exam) ===
If this module is an **exam**, treat `body_md` as the **complete exam** students would receive: cumulative coverage as appropriate for midterm/final; clear logistics; **only** real **multiple-choice** and/or **short-answer** questions. Whenever you emit an update block, the JSON `body_md` must be the **full exam**, not an outline—**do not** mirror it in chat. For **tutoring-only** replies, rely on the existing `body_md` and do not emit a block.

{output_format_section}
"""


def _build_messages(state: LectureStudioState, user_message: str) -> list[dict]:
    system = _build_system_prompt(state)
    return build_messages_with_trim(
        system,
        state.conversation_history,
        user_message,
        state.max_conversation_messages,
    )


def _parse_module_update(
    raw: str, fallback: WeekModule
) -> tuple[str, WeekModule]:
    blob = _extract_json(raw)
    si = raw.find(_START_TAG)
    agent_message = strip_meta_part_labels(
        raw[:si].strip() if si >= 0 else raw.strip()
    )
    if not blob:
        return agent_message, fallback
    try:
        data = json.loads(blob)
        est = data.get("estimated_minutes")
        ols = data.get("one_line_summary")
        if ols is None:
            one_line = fallback.one_line_summary
        else:
            one_line = str(ols).strip()
        kind = fallback.kind
        atp_raw = data.get("assessment_total_points")
        atp: int | None
        if atp_raw is not None:
            try:
                atp = int(float(atp_raw))
            except (TypeError, ValueError):
                atp = fallback.assessment_total_points
        else:
            atp = fallback.assessment_total_points
        if atp is None and kind in _DEFAULT_ASSESSMENT_POINTS:
            atp = _DEFAULT_ASSESSMENT_POINTS[kind]

        if "graded_item_points" in data:
            gip = _parse_graded_item_points(data.get("graded_item_points"))
        else:
            gip = list(fallback.graded_item_points)

        ex_rules = str(
            data.get("exam_specific_rules", fallback.exam_specific_rules)
            if kind == "exam"
            else fallback.exam_specific_rules
        )

        return agent_message, WeekModule(
            id=fallback.id,
            kind=fallback.kind,
            title=str(data.get("title", fallback.title)),
            one_line_summary=one_line,
            summary=str(data.get("summary", fallback.summary)),
            body_md=str(data.get("body_md", fallback.body_md)),
            estimated_minutes=int(est) if est is not None else None,
            exam_specific_rules=ex_rules,
            assessment_total_points=atp,
            graded_item_points=gip,
        )
    except (json.JSONDecodeError, TypeError, ValueError):
        return agent_message, fallback


def _lecture_studio_model(state: LectureStudioState) -> str:
    """Use OPENAI_MODEL_PROJECT for project modules when set; else OPENAI_MODEL (default gpt-4o)."""
    default = os.getenv("OPENAI_MODEL", "gpt-4o")
    if state.module.kind == "project":
        return os.getenv("OPENAI_MODEL_PROJECT", default)
    return default


def _lecture_studio_max_tokens(state: LectureStudioState) -> int:
    """Project modules can request a higher completion cap (multi-file deliverables)."""
    if state.module.kind != "project":
        return 16384
    raw = os.getenv("OPENAI_MAX_OUTPUT_TOKENS_PROJECT", "16384")
    try:
        cap = int(raw.strip())
    except ValueError:
        cap = 16384
    return max(4096, min(cap, 128_000))


async def run_lecture_studio_stream(
    state: LectureStudioState, user_message: str
) -> AsyncGenerator[dict, None]:
    model = _lecture_studio_model(state)
    client = _get_client()
    messages = _build_messages(state, user_message)

    temperature = 0.55 if state.module.kind == "project" else 0.5
    max_tokens = _lecture_studio_max_tokens(state)

    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
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
                if ":::LECTURE_MODULE_UPDATE:::" in full_response:
                    marker_seen = True
                    pre = token.split(":::LECTURE_MODULE_UPDATE:::", 1)[0]
                    if pre:
                        yield {"event": "token", "data": json.dumps({"token": pre})}
                else:
                    yield {"event": "token", "data": json.dumps({"token": token})}

    agent_message, new_mod = _parse_module_update(full_response, state.module)

    new_hist = list(state.conversation_history)
    new_hist.append({"role": "user", "content": user_message})
    new_hist.append({"role": "assistant", "content": agent_message})

    yield {
        "event": "lecture_module_update",
        "data": json.dumps({
            "agent_message": agent_message,
            "module": new_mod.model_dump(),
            "conversation_history": new_hist,
        }),
    }

    yield {"event": "done", "data": "{}"}
