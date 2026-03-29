import { initCoursePlannerPersistence } from "@/lib/coursePlannerPersistence";
import { useCourseStore } from "@/store/useCourseStore";
import { useWeekModularStore } from "@/store/useWeekModularStore";
import { loadWeekModularSnapshot } from "./weekModularSyllabusPersistence";
import { hydrateProblemSetGlobalRules } from "./problemSetGlobalRules";
import { hydrateQuizGlobalRules } from "./quizGlobalRules";
import { hydrateWeekFormatInstructions } from "./weekFormatInstructions";
import { hydrateWeekSummaryCache } from "./weekSummaryCache";

let didHydrateCoursePlanner = false;
let didHydrateModularSyllabus = false;

/** Restore localStorage-backed planner + week editor state (summaries, format rules, syllabus chat). */
export function hydrateWeekWorkspace(): void {
  hydrateWeekSummaryCache();
  hydrateWeekFormatInstructions();
  hydrateProblemSetGlobalRules();
  hydrateQuizGlobalRules();

  if (typeof window === "undefined") return;

  if (!didHydrateCoursePlanner) {
    didHydrateCoursePlanner = true;
    initCoursePlannerPersistence(useCourseStore);
  }

  if (didHydrateModularSyllabus) return;
  didHydrateModularSyllabus = true;
  const snap = loadWeekModularSnapshot();
  if (snap) {
    useWeekModularStore.getState().applyPersistedSnapshot(snap.syllabus, snap.selectedWeek);
  }
}
