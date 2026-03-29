from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class UserProfile(BaseModel):
    background: str = ""
    goals: list[str] = Field(default_factory=list)
    constraints: dict = Field(default_factory=dict)
    learning_style: str = ""
    rigor_level: str = ""


class Week(BaseModel):
    week: int
    title: str
    topics: list[str] = Field(default_factory=list)
    has_homework: bool = False
    assessment: str | None = None  # "midterm" | "final" | None
    is_new: bool = False


class CoursePlan(BaseModel):
    weeks: list[Week] = Field(default_factory=list)


class ImageAttachment(BaseModel):
    base64: str = ""
    media_type: str = "image/png"


class PlanState(BaseModel):
    topic: str = ""
    user_profile: UserProfile = Field(default_factory=UserProfile)
    course_plan: CoursePlan = Field(default_factory=CoursePlan)
    conversation_history: list[dict] = Field(default_factory=list)
    agent_phase: str = "understanding"
    prior_syllabi: list[str] = Field(default_factory=list)
    image_attachments: list[ImageAttachment] = Field(default_factory=list)


class PlanRequest(BaseModel):
    message: str
    state: PlanState


class PlanResponse(BaseModel):
    agent_message: str
    state: PlanState
    is_complete: bool = False


class SyllabusSnapshot(BaseModel):
    """High-level syllabus JSON (topic, profile, weeks) sent from the frontend."""

    topic: str = ""
    user_profile: UserProfile = Field(default_factory=UserProfile)
    course_plan: CoursePlan = Field(default_factory=CoursePlan)


class WeekContextSummary(BaseModel):
    """Short memory of what was generated for another week (keeps tokens bounded)."""

    week: int
    summary: str = ""


class AssessmentQuizChoice(BaseModel):
    """One multiple-choice option (letter + markdown text)."""

    id: str = "A"
    text_md: str = ""


class AssessmentQuizItem(BaseModel):
    """One quiz/exam question stored structurally (no markdown parsing)."""

    id: str = ""
    kind: str = ""  # multiple_choice | true_false | short_answer
    question_md: str = ""
    choices: list[AssessmentQuizChoice] = Field(default_factory=list)
    correct_answer: str = ""
    points: float | None = None


def parse_assessment_items_from_payload(raw: object) -> list[AssessmentQuizItem]:
    """Coerce JSON list from studio / week modular into models."""
    if raw is None:
        return []
    if not isinstance(raw, list):
        return []
    out: list[AssessmentQuizItem] = []
    for i, row in enumerate(raw):
        if not isinstance(row, dict):
            continue
        kind = str(row.get("kind", "")).lower().strip()
        if kind not in ("multiple_choice", "true_false", "short_answer"):
            continue
        qid = str(row.get("id", "")).strip() or f"q{i + 1}"
        choices_in = row.get("choices")
        ch_list: list[AssessmentQuizChoice] = []
        if isinstance(choices_in, list):
            for c in choices_in:
                if not isinstance(c, dict):
                    continue
                cid = str(c.get("id", "A")).strip().upper()
                cid = cid[:1] if cid else "A"
                txt = str(c.get("text_md", c.get("text", "")))
                ch_list.append(AssessmentQuizChoice(id=cid, text_md=txt))
        pts_raw = row.get("points")
        pts: float | None = None
        if pts_raw is not None:
            try:
                pts = float(pts_raw)
            except (TypeError, ValueError):
                pts = None
        out.append(
            AssessmentQuizItem(
                id=qid,
                kind=kind,
                question_md=str(row.get("question_md", row.get("question", ""))),
                choices=ch_list,
                correct_answer=str(row.get("correct_answer", row.get("correct", ""))),
                points=pts,
            )
        )
    return out


class WeekModule(BaseModel):
    """One ordered block within a week: lecture, project, problem_set, quiz, or exam."""

    id: str = ""
    kind: str = "lecture"  # lecture | project | problem_set | quiz | exam
    title: str = ""
    one_line_summary: str = ""
    summary: str = ""
    body_md: str = ""
    estimated_minutes: int | None = None
    is_new: bool = False
    exam_specific_rules: str = Field(
        default="",
        description="Per-exam instructor rules (exam studio only); not a course-wide global.",
    )
    #: Target points for graded modules (problem_set=10, quiz=20, exam=100 when unset).
    assessment_total_points: int | None = None
    #: Points per numbered problem/question; should sum to assessment_total_points.
    graded_item_points: list[float] = Field(default_factory=list)
    #: When non-empty for quiz/exam, the app renders and grades from these fields instead of parsing body_md.
    assessment_items: list[AssessmentQuizItem] = Field(default_factory=list)
    #: Reference answer key (problem_set only); not shown to students until after grading.
    solution_md: str = ""


class WeekModularGenerated(BaseModel):
    modules: list[WeekModule] = Field(default_factory=list)
    instructor_notes_md: str = ""


class WeekModularState(BaseModel):
    syllabus: SyllabusSnapshot
    selected_week: int = 1
    generated: WeekModularGenerated = Field(default_factory=WeekModularGenerated)
    conversation_history: list[dict] = Field(default_factory=list)
    week_summaries: list[WeekContextSummary] = Field(default_factory=list)
    max_conversation_messages: int | None = None
    global_format_instructions: str = Field(
        default="",
        description="Standing format rules for all weeks.",
    )
    problem_set_global_instructions: str = Field(
        default="",
        description="House rules for all problem_set modules (timeline + studio).",
    )
    quiz_global_instructions: str = Field(
        default="",
        description="House rules for all quiz modules (timeline + studio).",
    )


class WeekModularRequest(BaseModel):
    message: str
    state: WeekModularState


class LectureStudioState(BaseModel):
    """Single-module focus: refine one timeline block (lecture, quiz, etc.)."""

    syllabus: SyllabusSnapshot
    selected_week: int = 1
    module: WeekModule
    conversation_history: list[dict] = Field(default_factory=list)
    week_summaries: list[WeekContextSummary] = Field(default_factory=list)
    max_conversation_messages: int | None = None
    global_format_instructions: str = Field(default="")
    problem_set_global_instructions: str = Field(
        default="",
        description="House rules for all problem sets (same field as week modular).",
    )
    quiz_global_instructions: str = Field(
        default="",
        description="House rules for all quizzes (same field as week modular).",
    )


class LectureStudioRequest(BaseModel):
    message: str
    state: LectureStudioState


class LectureNotesGenerateRequest(BaseModel):
    """Trigger multi-step lecture body generation (outline → per-section → concat)."""

    state: LectureStudioState


class ProblemSetGenerateRequest(BaseModel):
    """Trigger multi-step problem set body generation (outline → per-problem → concat)."""

    state: LectureStudioState


class ProblemSetGradePayload(BaseModel):
    """Metadata for PDF grading (JSON in multipart form)."""

    syllabus_topic: str = ""
    module_title: str = ""
    body_md: str = ""
    solution_md: str = ""
    assessment_total_points: float = 10.0
    graded_item_points: list[float] = Field(default_factory=list)


class ProjectScaffoldRequest(BaseModel):
    """Extract ``=== file ===`` blocks from body_md and write real files to disk."""

    body_md: str
    project_name: str = "project"


class ProjectGradeRequest(BaseModel):
    """Submit student work for AI grading against the project spec."""

    body_md: str
    submission: str
    project_title: str = ""
    course_topic: str = ""


class LectureTtsRequest(BaseModel):
    """Plain text for ElevenLabs (client should strip markdown). Chunks stay under API limits."""

    text: str = Field(..., min_length=1, max_length=10_000)


class AssessmentGradeRequest(BaseModel):
    """`body_md` and/or structured `assessment_items` (with keys) + student responses."""

    kind: Literal["quiz", "exam"]
    title: str = ""
    course_topic: str = ""
    body_md: str = Field(default="", max_length=500_000)
    answers: dict[str, str] = Field(default_factory=dict)
    assessment_total_points: float | None = None
    graded_item_points: list[float] = Field(default_factory=list)
    assessment_items: list[AssessmentQuizItem] = Field(default_factory=list)

    @model_validator(mode="after")
    def _body_or_items(self):
        if self.assessment_items:
            return self
        if (self.body_md or "").strip():
            return self
        raise ValueError(
            "Provide non-empty body_md or at least one entry in assessment_items"
        )


class AssessmentGradeItem(BaseModel):
    key: str
    kind: str
    earned: float
    max: float
    note: str = ""


class AssessmentGradeResponse(BaseModel):
    score: float
    max_score: float
    items: list[AssessmentGradeItem] = Field(default_factory=list)
