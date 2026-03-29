import type { Syllabus } from "./syllabus";
import type { WeekContextSummaryEntry } from "./weekShared";

export type WeekModuleKind =
  | "lecture"
  | "project"
  | "problem_set"
  | "quiz"
  | "exam";

export interface WeekModule {
  id: string;
  kind: WeekModuleKind;
  title: string;
  /** One plain sentence for the collapsed timeline row; must differ from the opening of `summary`. */
  one_line_summary?: string;
  summary: string;
  body_md: string;
  estimated_minutes?: number | null;
  is_new?: boolean;
  /** Per-exam notes (exam workspace only); not shared across exams. */
  exam_specific_rules?: string;
}

export interface WeekModularGenerated {
  modules: WeekModule[];
  instructor_notes_md: string;
}

export interface WeekModularStatePayload {
  syllabus: Syllabus;
  selected_week: number;
  generated: WeekModularGenerated;
  conversation_history: { role: string; content: string }[];
  week_summaries: WeekContextSummaryEntry[];
  max_conversation_messages?: number;
  global_format_instructions: string;
  /** House rules applied to every problem_set module when generating weeks. */
  problem_set_global_instructions: string;
  /** House rules applied to every quiz module when generating weeks. */
  quiz_global_instructions: string;
}
