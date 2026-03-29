import type { Week } from "@/types/course";
import type { SyllabusWeek } from "@/types/syllabus";

/** Same week count and same week numbers in order — safe to merge planner edits without wiping packs. */
export function structuralWeeksMatch(
  oldWeeks: SyllabusWeek[],
  newWeeks: Week[],
): boolean {
  if (oldWeeks.length !== newWeeks.length) return false;
  for (let i = 0; i < oldWeeks.length; i++) {
    if (oldWeeks[i].week !== newWeeks[i].week) return false;
  }
  return true;
}
