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
    """One ordered block within a week: lecture, project, problem_set, or quiz."""

    id: str = ""
    kind: str = "lecture"  # lecture | project | problem_set | quiz
    title: str = ""
    summary: str = ""
    body_md: str = ""
    estimated_minutes: int | None = None
    is_new: bool = False


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
