import { WEEKLY_PLAN_BODY_MD_PLACEHOLDER } from "@/lib/weekModularBootstrap";

/** Weekly Plan uses a one-line placeholder; full assessment content is drafted in each workspace. */
export function needsGradedWorkspaceGeneration(body: string): boolean {
  const t = body.trim();
  if (!t) return true;
  return t === WEEKLY_PLAN_BODY_MD_PLACEHOLDER;
}

/** Initial user message so the module studio emits a full :::LECTURE_MODULE_UPDATE::: for problem sets. */
export const AUTO_GENERATE_PROBLEM_SET_MESSAGE =
  "Draft the complete problem set for this module now. Replace the placeholder in body_md with a full homework assignment aligned with the module title, summary, and this week's syllabus topics. Emit one JSON update block with graded_item_points matching each graded problem in order.";

export const AUTO_GENERATE_QUIZ_MESSAGE =
  "Draft the complete quiz for this module now. Replace the placeholder in body_md with real multiple-choice and short-answer questions aligned with the module title, summary, and this week's syllabus topics. Emit one JSON update block with graded_item_points matching each question in order.";

export const AUTO_GENERATE_EXAM_MESSAGE =
  "Draft the complete exam for this module now. Replace the placeholder in body_md with real multiple-choice and short-answer items aligned with the module title, summary, and this week's syllabus topics (midterm/final as appropriate). Emit one JSON update block with graded_item_points matching each question in order.";
