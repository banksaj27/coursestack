import { snapshotGlobalKeys } from "@/lib/classesStorage";
import { useCourseStore } from "@/store/useCourseStore";
import { useWeekModularStore } from "@/store/useWeekModularStore";

/**
 * Per-course snapshots must reflect **in-memory** Zustand state, not only localStorage.
 * `coursePlannerPersistence` may clear `yhack-course-planner-v1` from storage while the
 * planner store still holds a completed syllabus; `saveCourseData` would otherwise
 * persist null for that key and switching courses would lose the plan.
 */
export function snapshotGlobalKeysWithLiveStores(): Record<string, string | null> {
  const snap = snapshotGlobalKeys();

  const cs = useCourseStore.getState();
  snap["yhack-course-planner-v1"] = JSON.stringify({
    phase: cs.phase,
    planState: cs.planState,
    messages: cs.messages,
    isComplete: cs.isComplete,
    hasExportedToWeekly: cs.hasExportedToWeekly,
  });

  const ws = useWeekModularStore.getState();
  if (ws.syllabus.topic.trim() && ws.syllabus.course_plan.weeks.length > 0) {
    snap["yhack-week-modular-syllabus-snapshot-v1"] = JSON.stringify({
      syllabus: ws.syllabus,
      selectedWeek: ws.selectedWeek,
    });
  } else {
    snap["yhack-week-modular-syllabus-snapshot-v1"] = null;
  }

  return snap;
}
