import type { Syllabus } from "./syllabus";
import type { WeekContextSummaryEntry } from "./weekShared";

export type WeekModuleKind =
  | "lecture"
  | "project"
  | "problem_set"
  | "quiz"
  | "exam";

export type AssessmentQuizItemKind =
  | "multiple_choice"
  | "true_false"
  | "short_answer";

export interface AssessmentQuizChoice {
  id: string;
  text_md: string;
}

/** Quiz/exam question stored structurally (studio JSON); avoids parsing body_md. */
export interface AssessmentQuizItem {
  id: string;
  kind: AssessmentQuizItemKind;
  question_md: string;
  choices: AssessmentQuizChoice[];
  correct_answer: string;
  points?: number | null;
}

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
  /** Total points for graded modules (defaults: problem set 10, quiz 20, exam 100). */
  assessment_total_points?: number | null;
  /** Points per graded item: markdown path = order of `##` sections; structured path = order of `assessment_items`. */
  graded_item_points?: number[];
  /** When non-empty for quiz/exam, testing UI and grading use these instead of parsing body_md. */
  assessment_items?: AssessmentQuizItem[];
  /** Reference answer key (problem_set); hidden until after PDF grading. */
  solution_md?: string;
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
