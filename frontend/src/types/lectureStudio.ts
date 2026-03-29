import type { Syllabus } from "./syllabus";
import type { WeekContextSummaryEntry } from "./weekShared";
import type { WeekModule } from "./weekModular";

export interface LectureStudioStatePayload {
  syllabus: Syllabus;
  selected_week: number;
  module: WeekModule;
  conversation_history: { role: string; content: string }[];
  week_summaries: WeekContextSummaryEntry[];
  max_conversation_messages?: number;
  global_format_instructions: string;
  /** Global house rules for all problem sets (studio + generation). */
  problem_set_global_instructions?: string;
  /** Global house rules for all quizzes (studio + generation). */
  quiz_global_instructions?: string;
}
