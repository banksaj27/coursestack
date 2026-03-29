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
The instructor authored the rules below. They apply to **every week** of this course, including the current week. Follow them in **all** outputs: lecture markdown, problem_set prompts, quiz question write-ups, module body_md, instructor notes—unless the user's **latest** chat message explicitly overrides them.

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
