from __future__ import annotations

from pydantic import BaseModel, Field


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


class RuntimeApiKeysRequest(BaseModel):
    """Apply keys to the running backend process (local dev). Empty strings leave values from backend/.env."""

    google_api_key: str = ""
    elevenlabs_api_key: str = ""
