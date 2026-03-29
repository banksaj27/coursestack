"""Parse quiz/exam body_md like the frontend and score MC/T/F locally; short answers via Gemini."""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from typing import Any, Literal

from google.genai import types

from gemini_client import (
    env_model_or,
    gemini_thinking_disabled,
    get_gemini_client,
    get_gemini_model,
)
from models import AssessmentQuizItem

INSTRUCTION_TITLE = re.compile(
    r"^(instructions|policies|policy|honor code|academic integrity|timing|logistics|overview|"
    r"before you begin|general information|format|submission|cover page)",
    re.I,
)

OPT_PATTERNS = [
    re.compile(r"^\s*(?:[-*]\s+)?(?:\*\*)?([A-Z])(?:\*\*)?[.)]\s+(.+?)\s*$", re.I),
    re.compile(r"^\s*\(([A-Z])\)\s+(.+?)\s*$", re.I),
    re.compile(r"^\s*([A-Z])\)\s+(.+?)\s*$", re.I),
]


def normalize_adjacent_markdown_headings(md: str) -> str:
    """Insert blank lines before ##–###### when glued to prior text (e.g. '...)).## Question 5')."""
    t = md.replace("\r\n", "\n")
    prev = None
    while prev != t:
        prev = t
        t = re.sub(r"([^\s\n#])(#{2,6}\s+)", r"\1\n\n\2", t)
    return t


def split_markdown_into_h2_pages(md: str) -> list[str]:
    t = md.strip()
    if not t:
        return []
    by_h2 = re.split(r"(?=^##\s+)", t, flags=re.MULTILINE)
    h2_parts = [p.strip() for p in by_h2 if p.strip()]
    if len(h2_parts) > 1:
        return h2_parts
    single = h2_parts[0] if h2_parts else t
    by_h1 = re.split(r"(?=^#\s+(?!#))", single, flags=re.MULTILINE)
    h1_parts = [p.strip() for p in by_h1 if p.strip()]
    if len(h1_parts) > 1:
        return h1_parts
    return h2_parts if h2_parts else [t]


def split_page_into_question_blocks(page_md: str) -> list[str]:
    t = page_md.strip()
    if not t:
        return []

    by_h3 = re.split(r"(?=^###\s+)", t, flags=re.MULTILINE)
    h3_parts = [p.strip() for p in by_h3 if p.strip()]
    if len(h3_parts) > 1:
        return h3_parts

    lead = t[:2000]
    first_h2 = re.search(r"^[^\S\n]*##\s+\*?\*?([^\n*]+)", lead, re.MULTILINE)
    h2_title = re.sub(r"\*+", "", first_h2.group(1) if first_h2 else "").strip().lower()
    looks_like_instructions = bool(
        re.match(r"^instructions\b", h2_title)
        or re.match(r"^polic(y|ies)\b", h2_title)
        or re.match(r"^honor\b", h2_title)
        or re.match(r"^academic integrity\b", h2_title)
        or re.match(r"^logistics\b", h2_title)
        or re.match(r"^cover page\b", h2_title)
    )

    if not looks_like_instructions:
        numbered_lines = re.findall(r"^\d+\.\s+", t, re.MULTILINE)
        if numbered_lines and len(numbered_lines) >= 2:
            by_num = [p.strip() for p in re.split(r"(?=^\d+\.\s+)", t, flags=re.MULTILINE)]
            by_num = [p for p in by_num if p]
            if len(by_num) > 1:
                return by_num

    return [t]


def is_instruction_block(block_md: str) -> bool:
    t = block_md.strip()
    if not t:
        return False
    first_line = t.split("\n")[0].strip()
    hm = re.match(r"^#{2,3}\s*\*?\*?(.+?)\*?\*?\s*$", first_line)
    if not hm:
        return False
    title = re.sub(r"\*+", "", hm.group(1)).strip()
    return bool(INSTRUCTION_TITLE.match(title))


def _match_option_line(line: str) -> tuple[str, str] | None:
    for pat in OPT_PATTERNS:
        m = pat.match(line)
        if m:
            return m.group(1).upper(), m.group(2).strip()
    return None


def _strip_trailing_option_lines(lines: list[str]) -> tuple[list[str], list[dict[str, str]]]:
    options: list[dict[str, str]] = []
    end = len(lines)
    while end > 0:
        while end > 0 and not (lines[end - 1] or "").strip():
            end -= 1
        if end <= 0:
            break
        line = lines[end - 1] or ""
        m = _match_option_line(line)
        if not m:
            break
        options.insert(0, {"id": m[0], "label": m[0], "text": m[1]})
        end -= 1
    return lines[:end], options


def _tf_norm(s: str) -> str:
    return re.sub(r"\*\*", "", s).replace(".", "").strip().lower()


def _is_true_false_options(options: list[dict[str, str]]) -> bool:
    if len(options) != 2:
        return False
    texts = {_tf_norm(o["text"]) for o in options}
    return texts == {"true", "false"}


_MULTIPART_OPTION_START = re.compile(
    r"^(?:\$[^$]{0,160}\$\s*)?"
    r"(?:compute|find|show|prove|explain|determine|justify|derive|evaluate|sketch|write|state|give|list|identify|"
    r"calculate|graph|plot|solve|set\s+up|use\s+the|apply|verify|demonstrate|let\s|suppose|assume|is\s+the|"
    r"are\s+these|are\s+the|what\s+is|how\s+many|sketch\s+the|plot\s+the|define|construct|derive\s+the)",
    re.I,
)


def _option_text_for_multipart_heuristic(text: str) -> str:
    t = text.strip()
    t = re.sub(r"^\$[^$]{0,160}\$\s*", "", t).strip()
    return t


def _lettered_options_look_like_multipart_tasks(options: list[dict[str, str]]) -> bool:
    if len(options) < 2 or _is_true_false_options(options):
        return False
    normalized = [_option_text_for_multipart_heuristic(o["text"]) for o in options]
    hits = [t for t in normalized if _MULTIPART_OPTION_START.match(t)]
    return len(hits) == len(options)


def _looks_like_short_answer_block(block_md: str) -> bool:
    t = block_md.strip()
    if not t:
        return False
    first_line = t.split("\n")[0].strip()

    h2 = re.match(r"^##\s+\*?\*?(.+?)\*?\*?\s*$", first_line)
    if h2:
        title = re.sub(r"\*+", "", h2.group(1)).strip()
        if re.match(r"^(question|problem|exercise|short\s*answer)\b", title, re.I):
            return True
        if re.match(r"^q\s*\d+", title, re.I):
            return True
        if re.match(r"^part\s+[ivxlcdm\d]", title, re.I):
            return True
        if re.search(r"\(\s*\d+\s*(?:pts?|points?)\s*\)", title, re.I):
            return True

    hm = re.match(r"^###\s*\*?\*?(.+?)\*?\*?\s*$", first_line)
    if hm:
        title = re.sub(r"\*+", "", hm.group(1)).strip()
        if re.match(r"^(question|problem|exercise)\b", title, re.I):
            return True
        if re.match(r"^short\s*answer\b", title, re.I):
            return True
        if re.match(r"^written|free\s*response\b", title, re.I):
            return True
        if re.match(r"^q\s*\d+", title, re.I):
            return True
        if re.match(r"^part\s+[ivxlcdm\d]", title, re.I):
            return True

    if re.match(r"^\d+\.\s", first_line) and "?" in t[:2500]:
        return True

    head = t[:1200]
    if re.search(
        r"short answer|show your work|briefly explain|prove that|derive |compute |evaluate |"
        r"find the |show that |explain why|justify|demonstrate that|sketch a proof",
        head,
        re.I,
    ):
        return True
    return False


ParsedKind = Literal["multiple_choice", "true_false", "short_answer", "prose"]


@dataclass
class ParsedBlock:
    kind: ParsedKind
    stem_md: str
    block_md: str


def _is_trailing_autograder_key_line(ln: str) -> bool:
    t = ln.strip()
    if not t:
        return False
    if "<!--" in t and "correct" in t.lower():
        return True
    if "(Correct:" in t or "**Correct" in t:
        return True
    if re.match(r"^\s*(?:Correct(?:\s+answer)?|Answer\s*key)\s*:", ln, re.I):
        return True
    if re.match(r"^\s*Answer\s*:\s*", ln, re.I):
        return True
    return False


def _drop_trailing_answer_key_lines(lines: list[str]) -> list[str]:
    """Remove autograder key lines at the end so option scanning sees A.–E. lines."""
    end = len(lines)
    while end > 0:
        while end > 0 and not (lines[end - 1] or "").strip():
            end -= 1
        if end <= 0:
            break
        ln = lines[end - 1] or ""
        if _is_trailing_autograder_key_line(ln):
            end -= 1
            continue
        break
    return lines[:end]


def parse_question_block(block_md: str) -> ParsedBlock:
    raw = block_md.replace("\r\n", "\n")
    lines = _drop_trailing_answer_key_lines(raw.split("\n"))
    stem_lines, options = _strip_trailing_option_lines(lines)
    stem_md = "\n".join(stem_lines).strip()
    full = block_md.strip()

    if len(options) >= 2:
        if _is_true_false_options(options):
            return ParsedBlock(kind="true_false", stem_md=stem_md, block_md=full)
        if _lettered_options_look_like_multipart_tasks(options):
            return ParsedBlock(kind="short_answer", stem_md=full, block_md=full)
        return ParsedBlock(kind="multiple_choice", stem_md=stem_md, block_md=full)

    if _looks_like_short_answer_block(block_md):
        return ParsedBlock(kind="short_answer", stem_md=full, block_md=full)

    return ParsedBlock(kind="prose", stem_md=full, block_md=full)


_CORRECT_PATTERNS = [
    re.compile(r"\*\*Correct\s*:\s*([A-Za-z]+)\s*\*\*", re.I),
    re.compile(r"\*\*\s*Correct\s*:\s*([A-Za-z]+)\s*\*\*", re.I),
    re.compile(r"\(Correct\s*:\s*([A-Za-z]+)\)", re.I),
    re.compile(r"<!--\s*correct\s*:\s*([A-Za-z]+)\s*-->", re.I),
]

_MULTI_VALUE_CORRECT_PATTERNS = [
    re.compile(r"\*\*Correct\s*:\s*(.+?)\s*\*\*", re.I),
    re.compile(r"\*\*\s*Correct\s*:\s*(.+?)\s*\*\*", re.I),
    re.compile(r"\(Correct\s*:\s*([^)]+)\)", re.I),
    re.compile(r"<!--\s*correct\s*:\s*([^>]+)\s*-->", re.I),
]


def _letter_or_tf_from_capture(v: str) -> str | None:
    v = v.strip()
    if not v:
        return None
    low = v.lower()
    if low in ("true", "false"):
        return "True" if low == "true" else "False"
    if len(v) == 1 and v.isalpha():
        return v.upper()
    m = re.search(r"\b([A-Z])\b", v, re.I)
    if m:
        return m.group(1).upper()
    return None


def extract_correct_value_raw(block_md: str) -> str | None:
    """Full text after Correct: / answer key (supports 'A, D' or 'E')."""
    for pat in _MULTI_VALUE_CORRECT_PATTERNS:
        m = pat.search(block_md)
        if m:
            raw = (m.group(1) or "").strip()
            if raw:
                return raw
    plain_lines: list[str] = []
    for line in block_md.replace("\r\n", "\n").split("\n"):
        t = line.strip()
        if not t:
            continue
        plain = re.sub(r"[*_`]+", "", t)
        plain_lines.append(plain)
    for plain in plain_lines:
        m = re.search(
            r"(?:^|\b)(?:Correct(?:\s+answer)?|Answer\s*key)\s*:\s*(.+)$",
            plain,
            re.I,
        )
        if m:
            return m.group(1).strip()
    for plain in plain_lines:
        m = re.search(r"(?:^|\b)Answer\s*:\s*(.+)$", plain, re.I)
        if m:
            return m.group(1).strip()
    return None


def extract_correct_letter_or_tf(block_md: str) -> str | None:
    for pat in _CORRECT_PATTERNS:
        m = pat.search(block_md)
        if m:
            got = _letter_or_tf_from_capture(m.group(1))
            if got:
                return got

    raw = extract_correct_value_raw(block_md)
    if raw:
        got = _letter_or_tf_from_capture(raw)
        if got:
            return got

    return None


def _lines_for_option_scan(block_md: str) -> list[str]:
    return _drop_trailing_answer_key_lines(block_md.replace("\r\n", "\n").split("\n"))


def mc_option_letters_from_block(block_md: str) -> frozenset[str]:
    _, options = _strip_trailing_option_lines(_lines_for_option_scan(block_md))
    return frozenset(o["id"].upper() for o in options if o.get("id"))


def mc_option_text_by_id(block_md: str) -> dict[str, str]:
    _, options = _strip_trailing_option_lines(_lines_for_option_scan(block_md))
    return {o["id"].upper(): (o.get("text") or "").strip() for o in options if o.get("id")}


def _snippet(s: str, max_len: int = 200) -> str:
    t = re.sub(r"\s+", " ", (s or "").strip())
    if len(t) <= max_len:
        return t
    return t[: max_len - 1] + "…"


def _mc_review_note(
    block_md: str,
    accept: frozenset[str],
    *,
    earned: float,
    max_pts: float,
    student_letter: str,
) -> str:
    by_id = mc_option_text_by_id(block_md)
    bits: list[str] = []
    for L in sorted(accept):
        body = _snippet(by_id.get(L, ""), 220)
        if body:
            bits.append(f"{L}. {body}")
        else:
            bits.append(L)
    key_detail = "; ".join(bits) if bits else ", ".join(sorted(accept))
    letters = ", ".join(sorted(accept))
    full = earned >= max_pts - 0.001
    if full:
        return (
            f"Full credit. Keyed answer: {letters}. {key_detail}"
            if key_detail
            else f"Full credit. Keyed answer: {letters}."
        )
    sel = f"You selected {student_letter}." if student_letter else "No answer selected."
    return f"{sel} Correct answer: {letters}. {key_detail}"


def _tf_review_note(
    *,
    earned: float,
    max_pts: float,
    correct_raw: str,
    student_raw: str,
) -> str:
    c = normalize_correct_tf(correct_raw)
    s_norm = normalize_student_tf(student_raw) if student_raw.strip() else ""
    full = earned >= max_pts - 0.001
    if full:
        return f"Full credit. The correct response is {c}."
    got = f"You answered {s_norm}." if s_norm else "No answer submitted."
    return f"{got} Correct answer: {c}."


def letters_from_correct_value(value: str, valid_ids: frozenset[str]) -> frozenset[str]:
    if not value:
        return frozenset()
    if value.strip().lower() in ("true", "false"):
        return frozenset()
    out: set[str] = set()
    for m in re.finditer(r"\b([A-Z])\b", value.upper()):
        L = m.group(1)
        if L in valid_ids:
            out.add(L)
    return frozenset(out)


def _option_implies_combo_of_letters(text: str, required: frozenset[str]) -> bool:
    """e.g. 'Both A and D are correct' when the rubric lists A and D."""
    if len(required) < 2:
        return False
    low = re.sub(r"\s+", " ", text.lower())
    if not any(
        p in low
        for p in (
            "both ",
            "both a",
            " all ",
            "all of",
            "and ",
            "are correct",
            "are equivalent",
            "are the same",
            "equivalent",
        )
    ):
        return False
    for L in required:
        if not re.search(
            rf"(?:^|[^a-z]){re.escape(L.lower())}(?:[^a-z]|$)",
            low,
        ):
            return False
    return True


def extract_mc_accept_set(block_md: str) -> frozenset[str] | None:
    valid = mc_option_letters_from_block(block_md)
    if len(valid) < 2:
        return None
    raw = extract_correct_value_raw(block_md)
    if not raw or raw.strip().lower() in ("true", "false"):
        return None
    letters = letters_from_correct_value(raw, valid)
    return letters if letters else None


def normalize_student_mc(s: str) -> str:
    t = (s or "").strip().upper()
    if not t:
        return ""
    if len(t) == 1 and t.isalpha():
        return t
    m = re.search(r"\b([A-Z])\b", s, re.I)
    if m:
        return m.group(1).upper()
    return t[:1] if t else ""


def normalize_student_tf(s: str) -> str:
    t = s.strip().lower()
    if t == "true":
        return "True"
    if t == "false":
        return "False"
    return s.strip()


def normalize_correct_tf(s: str) -> str:
    low = s.strip().lower()
    if low == "true":
        return "True"
    if low == "false":
        return "False"
    return s.strip()


_SA_REF_PATTERNS = [
    re.compile(r"<!--\s*sa-ref:\s*(.*?)\s*-->", re.I | re.DOTALL),
    re.compile(
        r"\*\*Sample answer\s*:\*\*\s*(.+?)(?=\n(?:#{1,3}\s|\*\*[A-Z])|\Z)",
        re.I | re.DOTALL,
    ),
    re.compile(
        r"\*\*Reference answer\s*:\*\*\s*(.+?)(?=\n(?:#{1,3}\s|\*\*[A-Z])|\Z)",
        re.I | re.DOTALL,
    ),
]


def extract_short_answer_reference(block_md: str) -> str:
    for pat in _SA_REF_PATTERNS:
        m = pat.search(block_md)
        if m:
            return m.group(1).strip()
    return ""


@dataclass
class GradableSlot:
    answer_key: str
    kind: Literal["multiple_choice", "true_false", "short_answer"]
    max_points: float
    block_md: str


def iter_gradable_slots(body_md: str) -> list[tuple[int, int, ParsedBlock]]:
    """(page_idx, block_idx, parsed) for blocks that are not instructions or prose-only."""
    out: list[tuple[int, int, ParsedBlock]] = []
    pages = split_markdown_into_h2_pages(normalize_adjacent_markdown_headings(body_md))
    if not pages:
        pages = [""]
    for pi, page in enumerate(pages):
        blocks = split_page_into_question_blocks(page)
        for bi, block in enumerate(blocks):
            if is_instruction_block(block):
                continue
            pb = parse_question_block(block)
            if pb.kind == "prose":
                continue
            out.append((pi, bi, pb))
    return out


def assign_points_per_slot(
    slots: list[GradableSlot],
    assessment_total: float,
    graded_item_points: list[float],
) -> None:
    n = len(slots)
    if n == 0:
        return
    gip = [float(x) for x in graded_item_points if x is not None and x > 0]
    if len(gip) == n and math.isfinite(sum(gip)):
        for i, s in enumerate(slots):
            s.max_points = gip[i]
        return
    each = assessment_total / n if n else 0.0
    for s in slots:
        s.max_points = each


def build_slots(body_md: str, assessment_total: float, graded_item_points: list[float]) -> list[GradableSlot]:
    slots: list[GradableSlot] = []
    for pi, bi, pb in iter_gradable_slots(body_md):
        if pb.kind not in ("multiple_choice", "true_false", "short_answer"):
            continue
        slots.append(
            GradableSlot(
                answer_key=f"{pi}-{bi}",
                kind=pb.kind,  # type: ignore[arg-type]
                max_points=0.0,
                block_md=pb.block_md,
            )
        )
    assign_points_per_slot(slots, assessment_total, graded_item_points)
    return slots


def _structured_slot_kind(
    item: AssessmentQuizItem,
) -> Literal["multiple_choice", "true_false", "short_answer"]:
    k = (item.kind or "").strip().lower()
    if k == "multiple_choice":
        return "multiple_choice"
    if k == "true_false":
        return "true_false"
    return "short_answer"


def item_to_synthetic_block_md(item: AssessmentQuizItem) -> str:
    """Rebuild markdown the parser + grader already understand, from structured fields."""
    k = (item.kind or "").strip().lower()
    if k == "multiple_choice":
        parts = [item.question_md.strip(), ""]
        for c in item.choices:
            raw_id = (str(c.id) or "A").strip().upper()
            lid = raw_id[0] if raw_id and raw_id[0].isalpha() else "A"
            parts.append(f"{lid}. {c.text_md}")
        ca = (item.correct_answer or "").strip()
        if ca:
            parts.append(f"**(Correct: {ca})**")
        return "\n".join(parts)
    if k == "true_false":
        lines = [
            item.question_md.strip(),
            "",
            "A. True",
            "B. False",
        ]
        ca = (item.correct_answer or "").strip()
        if ca:
            lines.extend(["", f"**(Correct: {ca})**"])
        return "\n".join(lines)
    q = item.question_md.strip()
    ref = (item.correct_answer or "").strip()
    if ref:
        return f"{q}\n\n**(Sample answer: {ref})**"
    return q


def slots_from_assessment_items(
    items: list[AssessmentQuizItem],
    assessment_total: float,
    graded_item_points: list[float],
) -> list[GradableSlot]:
    slots: list[GradableSlot] = []
    for i, item in enumerate(items):
        key = (item.id or "").strip() or f"q{i + 1}"
        sk = _structured_slot_kind(item)
        slots.append(
            GradableSlot(
                answer_key=key,
                kind=sk,
                max_points=0.0,
                block_md=item_to_synthetic_block_md(item),
            )
        )
    assign_points_per_slot(slots, assessment_total, graded_item_points)
    for i, item in enumerate(items):
        if item.points is None:
            continue
        try:
            p = float(item.points)
        except (TypeError, ValueError):
            continue
        if p > 0:
            slots[i].max_points = p
    return slots


_SA_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "scores": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "earned": {"type": "number"},
                    "note": {"type": "string"},
                },
                "required": ["index", "earned"],
            },
        }
    },
    "required": ["scores"],
}


async def _grade_short_answers_batch(
    *,
    items: list[dict[str, Any]],
    course_topic: str,
    assessment_title: str,
) -> dict[int, tuple[float, str]]:
    """index -> (earned, note)."""
    if not items:
        return {}
    client = get_gemini_client()
    default_model = get_gemini_model()
    model = env_model_or("GEMINI_MODEL_ASSESSMENT_GRADE", default_model)

    lines = []
    for it in items:
        lines.append(
            json.dumps(
                {
                    "index": it["index"],
                    "max_points": it["max_points"],
                    "question": it["question"][:6000],
                    "reference_answer": (it.get("reference") or "")[:4000],
                    "student_answer": (it.get("student") or "")[:8000],
                },
                ensure_ascii=False,
            )
        )
    user = (
        "You grade short-answer responses for a quiz/exam. For each object below, assign "
        "earned points between 0 and max_points (inclusive). Be fair: accept equivalent reasoning "
        "and correct conclusions even if wording differs from the reference. Partial credit is allowed. "
        "Return JSON only with shape {\"scores\": [{\"index\": int, \"earned\": number, \"note\": string}]}, "
        "one entry per input object, same index values.\n\n"
        "For each \"note\" (plain text, up to ~800 characters):\n"
        "- Summarize why the score is fair (what matched or what was missing).\n"
        "- If earned < max_points, include at least one concrete hint or the main correction needed.\n"
        "- If reference_answer is non-empty, state the essential correct result or method (do not paste the "
        "reference verbatim).\n"
        "- If earned == max_points, briefly confirm what was right.\n\n"
        f"Course context: {course_topic or 'general'}\n"
        f"Assessment: {assessment_title or 'Quiz/Exam'}\n\n"
        "Items (JSON lines):\n"
        + "\n".join(lines)
    )

    r = await client.aio.models.generate_content(
        model=model,
        contents=[
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=user)],
            )
        ],
        config=types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=8192,
            thinking_config=gemini_thinking_disabled(),
            response_mime_type="application/json",
            response_json_schema=_SA_JSON_SCHEMA,
        ),
    )
    raw = (r.text or "").strip()
    data = json.loads(raw)
    scores = data.get("scores") if isinstance(data, dict) else None
    out: dict[int, tuple[float, str]] = {}
    if not isinstance(scores, list):
        return out
    for row in scores:
        if not isinstance(row, dict):
            continue
        try:
            idx = int(row["index"])
        except (KeyError, TypeError, ValueError):
            continue
        try:
            earned = float(row.get("earned", 0))
        except (TypeError, ValueError):
            earned = 0.0
        note = str(row.get("note") or "")[:1500]
        out[idx] = (earned, note)
    return out


def _breakdown_sort_key(x: dict[str, Any]) -> tuple:
    k = str(x.get("key", ""))
    parts = k.split("-", 1)
    if (
        len(parts) == 2
        and parts[0].isdigit()
        and parts[1].isdigit()
    ):
        return (0, int(parts[0]), int(parts[1]))
    return (1, k)


async def _grade_slots_async(
    slots: list[GradableSlot],
    answers: dict[str, str],
    course_topic: str,
    assessment_title: str,
    total_fallback: float,
) -> dict[str, Any]:
    items_breakdown: list[dict[str, Any]] = []
    earned_total = 0.0
    max_total = 0.0

    sa_batch: list[dict[str, Any]] = []
    sa_index_map: list[tuple[int, GradableSlot]] = []

    for i, slot in enumerate(slots):
        max_total += slot.max_points
        student = (answers.get(slot.answer_key) or "").strip()

        if slot.kind in ("multiple_choice", "true_false"):
            correct = extract_correct_letter_or_tf(slot.block_md)
            note = ""
            pts = 0.0
            if slot.kind == "multiple_choice":
                stu = normalize_student_mc(student)
                valid_ids = mc_option_letters_from_block(slot.block_md)
                accept = extract_mc_accept_set(slot.block_md)
                if accept is None and correct and correct not in ("True", "False"):
                    one = normalize_student_mc(correct)
                    if one in valid_ids:
                        accept = frozenset({one})
                if accept:
                    if stu in accept:
                        pts = slot.max_points
                        note = _mc_review_note(
                            slot.block_md,
                            accept,
                            earned=pts,
                            max_pts=slot.max_points,
                            student_letter=stu,
                        )
                    elif (
                        len(accept) >= 2
                        and stu in valid_ids
                        and _option_implies_combo_of_letters(
                            mc_option_text_by_id(slot.block_md).get(stu, ""),
                            accept,
                        )
                    ):
                        pts = slot.max_points
                        note = _mc_review_note(
                            slot.block_md,
                            accept,
                            earned=pts,
                            max_pts=slot.max_points,
                            student_letter=stu,
                        )
                    else:
                        note = _mc_review_note(
                            slot.block_md,
                            accept,
                            earned=0.0,
                            max_pts=slot.max_points,
                            student_letter=stu,
                        )
                else:
                    note = (
                        "No answer key found in this question (no **(Correct: …)** / comment key). "
                        "Marked incorrect; compare with your instructor or materials."
                    )
            elif correct is None:
                note = (
                    "No True/False key in this question. Marked incorrect; check the posted answer key."
                )
            else:
                if normalize_student_tf(student) == normalize_correct_tf(correct):
                    pts = slot.max_points
                    note = _tf_review_note(
                        earned=pts,
                        max_pts=slot.max_points,
                        correct_raw=correct,
                        student_raw=student,
                    )
                else:
                    note = _tf_review_note(
                        earned=0.0,
                        max_pts=slot.max_points,
                        correct_raw=correct,
                        student_raw=student,
                    )
            earned_total += pts
            items_breakdown.append(
                {
                    "key": slot.answer_key,
                    "kind": slot.kind,
                    "earned": round(pts, 2),
                    "max": round(slot.max_points, 2),
                    "note": note,
                }
            )
        else:
            ref = extract_short_answer_reference(slot.block_md)
            sa_batch.append(
                {
                    "index": i,
                    "max_points": slot.max_points,
                    "question": slot.block_md,
                    "reference": ref,
                    "student": student,
                }
            )
            sa_index_map.append((i, slot))

    if sa_batch:
        try:
            sa_scores = await _grade_short_answers_batch(
                items=sa_batch,
                course_topic=course_topic,
                assessment_title=assessment_title,
            )
        except Exception as e:
            for i, slot in sa_index_map:
                items_breakdown.append(
                    {
                        "key": slot.answer_key,
                        "kind": "short_answer",
                        "earned": 0.0,
                        "max": round(slot.max_points, 2),
                        "note": f"Grading failed: {e!s}",
                    }
                )
        else:
            for i, slot in sa_index_map:
                earned_raw, gnote = sa_scores.get(i, (0.0, ""))
                capped = max(0.0, min(float(slot.max_points), float(earned_raw)))
                earned_total += capped
                items_breakdown.append(
                    {
                        "key": slot.answer_key,
                        "kind": "short_answer",
                        "earned": round(capped, 2),
                        "max": round(slot.max_points, 2),
                        "note": gnote,
                    }
                )

    items_breakdown.sort(key=_breakdown_sort_key)

    return {
        "score": round(earned_total, 2),
        "max_score": round(max_total, 2)
        if max_total > 0
        else round(total_fallback, 2),
        "items": items_breakdown,
    }


async def grade_quiz_or_exam(
    *,
    body_md: str,
    answers: dict[str, str],
    assessment_total_points: float,
    graded_item_points: list[float],
    assessment_title: str = "",
    course_topic: str = "",
    assessment_items: list[AssessmentQuizItem] | None = None,
) -> dict[str, Any]:
    """Return score, max_score, items breakdown."""
    total = float(assessment_total_points) if assessment_total_points > 0 else 20.0
    if assessment_items:
        slots = slots_from_assessment_items(
            list(assessment_items), total, graded_item_points
        )
    else:
        slots = build_slots(body_md, total, graded_item_points)
    if not slots:
        return {
            "score": 0.0,
            "max_score": round(total, 2),
            "items": [],
        }
    return await _grade_slots_async(
        slots, answers, course_topic, assessment_title, total
    )
