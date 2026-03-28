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


class PlanState(BaseModel):
    topic: str = ""
    user_profile: UserProfile = Field(default_factory=UserProfile)
    course_plan: CoursePlan = Field(default_factory=CoursePlan)
    conversation_history: list[dict] = Field(default_factory=list)
    agent_phase: str = "understanding"


class PlanRequest(BaseModel):
    message: str
    state: PlanState


class PlanResponse(BaseModel):
    agent_message: str
    state: PlanState
    is_complete: bool = False
