import type { Syllabus } from "./syllabus";
import type { WeekContextSummaryEntry } from "./weekShared";

export type WeekModuleKind = "lecture" | "project" | "problem_set" | "quiz";

export interface WeekModule {
  id: string;
  kind: WeekModuleKind;
  title: string;
  summary: string;
  body_md: string;
  estimated_minutes?: number | null;
  is_new?: boolean;
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
}
