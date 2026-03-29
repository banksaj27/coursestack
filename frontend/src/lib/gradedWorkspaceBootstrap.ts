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
  "Draft the complete quiz for this module now. Emit one JSON update block: fill **`assessment_items`** with every question—each object needs **`id`**, **`kind`** (`multiple_choice`, `true_false`, or `short_answer`), **`question_md`** (stem only for MC; no A/B/C lines there), **`choices`** for MC (`id` + `text_md` per option), and **`correct_answer`** (letter(s), True/False, or a concise reference for short answer). Put only instructions, timing, and policies in **`body_md`**. Set **`graded_item_points`** to match each item in order (summing to **assessment_total_points**).";

export const AUTO_GENERATE_EXAM_MESSAGE =
  "Draft the complete exam for this module now. Same JSON shape as quiz: non-empty **`assessment_items`** with real questions, **`body_md`** for instructions and logistics only, and **`graded_item_points`** aligned with each item (summing to **assessment_total_points**). Align content with midterm/final as appropriate for this module.";
