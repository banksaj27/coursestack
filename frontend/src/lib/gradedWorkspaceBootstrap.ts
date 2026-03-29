import { WEEKLY_PLAN_BODY_MD_PLACEHOLDER } from "@/lib/weekModularBootstrap";

/** Weekly Plan uses a one-line placeholder; full assessment content is drafted in each workspace. */
export function needsGradedWorkspaceGeneration(body: string): boolean {
  const t = body.trim();
  if (!t) return true;
  return t === WEEKLY_PLAN_BODY_MD_PLACEHOLDER;
}

/** Initial user messages so the module studio emits a full :::LECTURE_MODULE_UPDATE::: (per kind). */
export const AUTO_GENERATE_PROBLEM_SET_MESSAGE =
  "Draft the complete problem set for this module now. Replace the placeholder in body_md with a full homework assignment aligned with the module title, summary, and this week's syllabus topics. Emit one JSON update block with graded_item_points matching each graded problem in order.";

export const AUTO_GENERATE_QUIZ_MESSAGE =
  "Draft the complete quiz for this module now. Replace the placeholder in body_md with real multiple-choice and short-answer questions aligned with the module title, summary, and this week's syllabus topics. Emit one JSON update block with graded_item_points matching each question in order.";

export const AUTO_GENERATE_EXAM_MESSAGE =
  "Draft the complete exam for this module now. Replace the placeholder in body_md with real multiple-choice and short-answer items aligned with the module title, summary, and this week's syllabus topics (midterm/final as appropriate). Emit one JSON update block with graded_item_points matching each question in order.";

/** Phase 1: core spec + short Starter Kit; output-deliverables section stays outline-only (saves output tokens). */
export const AUTO_GENERATE_PROJECT_PHASE1 =
  "Phase 1 of 2 — Replace the Weekly Plan placeholder in body_md with a complete student-facing project handout: goal, concrete deliverables, milestones, grading criteria or rubric, timeline, collaboration and submission expectations, aligned with the module title, summary, and this week's syllabus topics. Include a substantive ## Starter Kit (concrete but keep samples concise). Under ## Output deliverables (copy-paste files), put only a short bullet outline of which files you will add—do **not** include === path/file === blocks or long pasted file bodies yet (phase 2). Valid JSON only between :::LECTURE_MODULE_UPDATE::: and :::END_LECTURE_MODULE_UPDATE:::.";

/** Phase 2: full copy-paste file bundles after phase 1 body exists (second model call, separate output budget). */
export const AUTO_GENERATE_PROJECT_PHASE2 =
  "Phase 2 of 2 — The handout is already in body_md. Preserve all existing sections unless something must change for consistency. Replace the outline under ## Output deliverables (copy-paste files) with full === path/to/file.ext === blocks and complete file bodies per your instructions. Expand ## Starter Kit if it should match the final deliverables. Emit one JSON update with the full body_md; end with :::END_LECTURE_MODULE_UPDATE:::.";
