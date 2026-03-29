from __future__ import annotations

import os
import re

from models import WeekContextSummary

# Lines the model sometimes copies from our old "Part 1 / Part 2" prompt scaffolding.
_PART_HEADING_LINE = re.compile(
    r"^\s*(?:\*\*)?\s*(?:part|PART)\s*[12]\s*(?:\*\*)?\s*"
    r"(?:[:\.\)]|[\u2013\u2014-])\s*.*$",
)
_PART_ONLY_LINE = re.compile(
    r"^\s*(?:\*\*)?\s*(?:part|PART)\s*[12]\s*(?:\*\*)?\s*$",
)


_FALLBACK_WEEK_MODULAR_CHAT = (
    "I've updated this week's modules—open the timeline on the right for full "
    "lecture chapters, assignments, quizzes, and exams."
)


def sanitize_week_modular_chat_prose(text: str) -> str:
    """
    The model sometimes pastes YAML/field dumps or body_md into the prose before
    :::WEEK_MODULES_UPDATE:::. That text is redundant with the JSON block and
    should not appear in chat history—replace with a short acknowledgment.
    """
    t = (text or "").strip()
    if not t:
        return t
    if re.search(r"(?m)^\s*body_md\s*:", t):
        return _FALLBACK_WEEK_MODULAR_CHAT
    if re.search(r"(?m)^\s*one_line_summary\s*:", t):
        return _FALLBACK_WEEK_MODULAR_CHAT
    if re.search(r"(?m)^\s*kind\s*:", t) and re.search(r"(?m)^\s*id\s*:", t):
        return _FALLBACK_WEEK_MODULAR_CHAT
    low = t.lower()
    if "```json" in low or ('```' in t and '"modules"' in t):
        return _FALLBACK_WEEK_MODULAR_CHAT
    if len(t) > 8000:
        return _FALLBACK_WEEK_MODULAR_CHAT
    return t


def strip_meta_part_labels(text: str) -> str:
    """Drop 'Part 1 — …' / 'Part 2' heading lines from the visible assistant reply."""
    if not (text or "").strip():
        return text
    out: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if _PART_ONLY_LINE.match(s) or _PART_HEADING_LINE.match(s):
            continue
        out.append(line)
    return "\n".join(out).strip()


def effective_history_limit(max_from_state: int | None) -> int:
    if max_from_state is not None and max_from_state > 0:
        return max_from_state
    return int(os.getenv("WEEK_STUDIO_MAX_HISTORY_MESSAGES", "24"))


def trim_conversation_history(history: list[dict], max_messages: int) -> list[dict]:
    if max_messages <= 0 or len(history) <= max_messages:
        return list(history)
    return list(history[-max_messages:])


def format_other_week_summaries(
    summaries: list[WeekContextSummary],
    selected_week: int,
) -> str:
    lines: list[str] = []
    for s in summaries:
        if s.week == selected_week or not (s.summary or "").strip():
            continue
        t = s.summary.strip().replace("\n", " ")
        if len(t) > 1200:
            t = t[:1197] + "..."
        lines.append(f"- **Week {s.week}:** {t}")
    if not lines:
        return "No compact summaries yet for other weeks (they appear after you generate content for those weeks)."
    return "\n".join(lines)


GLOBAL_FORMAT_MAX_CHARS = 4000


def format_global_format_block(raw: str | None) -> str:
    """Inject standing format rules for all weeks (bounded length)."""
    if raw is None:
        return ""
    t = str(raw).strip()
    if not t:
        return ""
    if len(t) > GLOBAL_FORMAT_MAX_CHARS:
        t = t[: GLOBAL_FORMAT_MAX_CHARS - 3] + "..."
    return f"""=== GLOBAL FORMAT & STRUCTURE RULES (ALL WEEKS) ===
The instructor authored the rules below. They apply to **every week** of this course, including the current week. Follow them in **all** outputs: lecture markdown, problem_set prompts, quiz and exam write-ups, module body_md, instructor notes—unless the user's **latest** chat message explicitly overrides them.

**Module mix (critical):** If these rules specify **how many** modules of a kind appear each week (e.g. **at least one project**, **only one quiz**, **one problem set**), you **must** implement that in the `modules` array using the correct `kind` values (`project`, `quiz`, `problem_set`, …). That requirement **overrides** any generic “project optional” or “typical week” wording elsewhere in the system prompt.

{t}

=== END GLOBAL RULES ===

"""


PROBLEM_SET_GLOBAL_MAX_CHARS = 4000


def format_problem_set_global_block(raw: str | None) -> str:
    """House rules that apply to every problem_set in the course (studio + week generation)."""
    if raw is None:
        return ""
    t = str(raw).strip()
    if not t:
        return ""
    if len(t) > PROBLEM_SET_GLOBAL_MAX_CHARS:
        t = t[: PROBLEM_SET_GLOBAL_MAX_CHARS - 3] + "..."
    return f"""=== GLOBAL PROBLEM SET HOUSE RULES (ALL PROBLEM SETS) ===
The instructor authored the rules below. They apply to **every** module with `kind` **problem_set** in this course: when building or editing a week on the timeline, and when refining one assignment in problem set studio. Apply them **in addition to** the global format rules above. When they conflict with the user's **latest** chat message, follow the chat. Every `body_md` for a problem set must honor these rules unless the user explicitly overrides them.

{t}

=== END GLOBAL PROBLEM SET HOUSE RULES ===

"""

QUIZ_GLOBAL_MAX_CHARS = 4000


def format_quiz_global_block(raw: str | None) -> str:
    """House rules that apply to every quiz in the course (studio + week generation)."""
    if raw is None:
        return ""
    t = str(raw).strip()
    if not t:
        return ""
    if len(t) > QUIZ_GLOBAL_MAX_CHARS:
        t = t[: QUIZ_GLOBAL_MAX_CHARS - 3] + "..."
    return f"""=== GLOBAL QUIZ HOUSE RULES (ALL QUIZZES) ===
The instructor authored the rules below. They apply to **every** module with `kind` **quiz** in this course: when building or editing a week on the timeline, and when refining one quiz in quiz studio. Apply them **in addition to** the global format rules above. When they conflict with the user's **latest** chat message, follow the chat. Every `body_md` for a quiz must honor these rules unless the user explicitly overrides them.

{t}

=== END GLOBAL QUIZ HOUSE RULES ===

"""

EXAM_SPECIFIC_RULES_MAX_CHARS = 4000

# Shown in system prompts for problem_set, quiz, and exam so body_md parses into MC vs short-answer UI.
ASSESSMENT_MARKDOWN_MACHINE_READABLE = """=== ASSESSMENT body_md — FORMAT FOR THE LEARNING APP (problem_set, quiz, exam) ===
The app parses each item to show **radio choices** (multiple choice / true–false) or a **text box** (short answer, proofs, calculations). Structure graded `body_md` accordingly:

- **One heading per major graded item** when possible: prefer `## Question 1 (4 pts)` (or `###` for parts (a)(b)). Long exams may use **top-level `# Question …`** per item instead of `##`; either style is fine as long as each question is its own heading block. Prefer **clear headings** over a bare numbered list (`1.` `2.` …) for separate questions—if you use numbered lists, keep each item under a `##`, `###`, or `#` question heading so the app can split them.
- **Multiple choice**: Write the stem (paragraphs, math). **End** that question with **consecutive lines**, one per option, using **letters A–Z** and this pattern (nothing after the last option except the next heading or question):
  `A. …`
  `B. …`
  `C. …`
  `D. …`
  Do **not** put hints, “Correct:”, or answer keys **after** the option list—put notes **before** the options or omit them from the student-facing text.
- **True/False**: End with two options whose labels read **True** and **False** (e.g. `A. True` and `B. False`).
- **Short answer / written response**: Start the block with a heading such as `### Question`, `### Problem`, `### Short answer`, or `## Question …` with a clear prompt; the app shows a **textarea** under that block. Use verbs like *Prove*, *Show that*, *Compute*, *Explain*, *Find* when appropriate.

=== END ASSESSMENT FORMAT ===
"""


def assessment_markdown_format_block() -> str:
    """Instructions so problem_set / quiz / exam body_md matches the frontend parser."""
    return ASSESSMENT_MARKDOWN_MACHINE_READABLE


def format_exam_specific_rules_block(raw: str | None) -> str:
    """Per-exam instructor rules for the single exam module open in lecture studio (not course-wide)."""
    if raw is None:
        return ""
    t = str(raw).strip()
    if not t:
        return ""
    if len(t) > EXAM_SPECIFIC_RULES_MAX_CHARS:
        t = t[: EXAM_SPECIFIC_RULES_MAX_CHARS - 3] + "..."
    return f"""=== THIS EXAM — INSTRUCTOR RULES (THIS MODULE ONLY) ===
The instructor wrote the notes below for **this exam module only** (the one in the JSON). Apply them when editing `body_md` for this exam, **in addition to** the global format rules above. They do **not** apply to other exams or quizzes. When they conflict with the user's **latest** chat message, follow the chat.

{t}

=== END THIS EXAM — INSTRUCTOR RULES ===

"""


def build_messages_with_trim(
    system: str,
    history: list[dict],
    user_message: str,
    max_conversation_messages: int | None,
) -> list[dict]:
    limit = effective_history_limit(max_conversation_messages)
    trimmed = trim_conversation_history(history, limit)
    messages: list[dict] = [{"role": "system", "content": system}]
    for entry in trimmed:
        messages.append({"role": entry["role"], "content": entry["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages
