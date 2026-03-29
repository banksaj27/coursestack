import type { Syllabus } from "@/types/syllabus";

const KEY = "yhack-week-modular-syllabus-snapshot-v1";

export function saveWeekModularSnapshot(
  syllabus: Syllabus,
  selectedWeek: number,
): void {
  if (typeof window === "undefined") return;
  if (!syllabus.topic.trim() || syllabus.course_plan.weeks.length === 0) {
    clearWeekModularSnapshot();
    return;
  }
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ syllabus, selectedWeek } satisfies {
        syllabus: Syllabus;
        selectedWeek: number;
      }),
    );
  } catch {
    /* quota */
  }
}

export function loadWeekModularSnapshot(): {
  syllabus: Syllabus;
  selectedWeek: number;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as {
      syllabus?: Syllabus;
      selectedWeek?: unknown;
    };
    if (!p?.syllabus || typeof p.selectedWeek !== "number") return null;
    const s = p.syllabus;
    if (
      typeof s.topic !== "string" ||
      !s.course_plan ||
      !Array.isArray(s.course_plan.weeks)
    ) {
      return null;
    }
    return { syllabus: s, selectedWeek: p.selectedWeek };
  } catch {
    return null;
  }
}

export function clearWeekModularSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
