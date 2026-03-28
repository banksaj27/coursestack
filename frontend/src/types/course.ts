export interface UserProfile {
  background: string;
  goals: string[];
  constraints: Record<string, string>;
  learning_style: string;
  rigor_level: string;
}

export interface Week {
  week: number;
  title: string;
  topics: string[];
  has_homework: boolean;
  assessment: "midterm" | "final" | null;
  is_new: boolean;
}

export interface CoursePlan {
  weeks: Week[];
}

export interface PlanState {
  topic: string;
  user_profile: UserProfile;
  course_plan: CoursePlan;
  conversation_history: { role: string; content: string }[];
  agent_phase: "understanding" | "refining" | "finalizing";
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type AgentStatus = "idle" | "thinking" | "streaming" | "updating_plan";

export type AppPhase = "topic_input" | "planning" | "complete";
