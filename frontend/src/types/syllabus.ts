/** Matches syllabus.json / course plan schema used by the planner. */
export interface SyllabusUserProfile {
  background: string;
  goals: string[];
  constraints: Record<string, unknown>;
  learning_style: string;
  rigor_level: string;
}

export interface SyllabusWeek {
  week: number;
  title: string;
  topics: string[];
  has_homework: boolean;
  assessment: string | null;
}

export interface Syllabus {
  topic: string;
  user_profile: SyllabusUserProfile;
  course_plan: { weeks: SyllabusWeek[] };
}
