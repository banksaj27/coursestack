import { ensureWeekFormatHydrated } from "@/lib/weekFormatInstructions";
import { clearAllLectureStudioMessages } from "@/lib/lectureStudioPersistence";
import { clearAllModuleAssessmentCompletions } from "@/lib/moduleAssessmentCompletion";
import { moduleWorkspaceHref } from "@/lib/moduleWorkspaceNavigation";
import { loadModularWeekPack } from "@/lib/weekModularPersistence";
import type { WeekModuleKind } from "@/types/weekModular";

const STORAGE_KEY = "yhack-last-coursework-v1";
const LEGACY_LECTURE_KEY = "yhack-last-lecture-studio-v1";

export type LastCourseworkVisit = {
  week: number;
  moduleId: string;
  kind: WeekModuleKind;
};

function normalizeKind(k: string): WeekModuleKind {
  if (
    k === "project" ||
    k === "problem_set" ||
    k === "quiz" ||
    k === "exam" ||
    k === "lecture"
  ) {
    return k;
  }
  return "lecture";
}

export function setLastCourseworkVisit(
  week: number,
  moduleId: string,
  kind: WeekModuleKind,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ week, moduleId, kind } satisfies LastCourseworkVisit),
    );
  } catch {
    /* quota */
  }
}

/** @deprecated Use setLastCourseworkVisit(week, moduleId, "lecture"). */
export function setLastOpenedLectureStudio(week: number, moduleId: string): void {
  setLastCourseworkVisit(week, moduleId, "lecture");
}

export function getLastCourseworkVisit(): LastCourseworkVisit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as {
        week?: unknown;
        moduleId?: unknown;
        kind?: unknown;
      };
      const week = Number(p.week);
      const moduleId = typeof p.moduleId === "string" ? p.moduleId : "";
      const kind = normalizeKind(
        typeof p.kind === "string" ? p.kind : "lecture",
      );
      if (!Number.isFinite(week) || week < 1 || !moduleId) return null;
      return { week, moduleId, kind };
    }
    const leg = localStorage.getItem(LEGACY_LECTURE_KEY);
    if (leg) {
      const p = JSON.parse(leg) as { week?: unknown; moduleId?: unknown };
      const week = Number(p.week);
      const moduleId = typeof p.moduleId === "string" ? p.moduleId : "";
      if (!Number.isFinite(week) || week < 1 || !moduleId) return null;
      return { week, moduleId, kind: "lecture" };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearLastCourseworkVisit(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_LECTURE_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated Use clearLastCourseworkVisit. */
export function clearLastOpenedLectureStudio(): void {
  clearLastCourseworkVisit();
}

/** Lecture-studio chat history + last Coursework nav target; call when weekly modules are wiped or replaced. */
export function clearAllCourseworkCaches(): void {
  clearAllLectureStudioMessages();
  clearLastCourseworkVisit();
  clearAllModuleAssessmentCompletions();
}

/** First module in saved week 1 timeline (any kind), if any. */
function getFirstModuleWeek1(): { id: string; kind: WeekModuleKind } | null {
  ensureWeekFormatHydrated();
  const pack = loadModularWeekPack(1);
  const first = pack?.generated.modules.find((m) => m.id?.trim());
  if (!first?.id) return null;
  return { id: first.id, kind: normalizeKind(first.kind) };
}

/**
 * Where Coursework nav should open: last visited module workspace (any kind),
 * else week 1 first module, else `/lecture/1/lecture-1`.
 */
export function getCourseworkDestinationHref(): string {
  if (typeof window === "undefined") {
    return "/lecture/1/lecture-1";
  }
  const last = getLastCourseworkVisit();
  if (last) {
    return moduleWorkspaceHref(last.week, last.kind, last.moduleId);
  }
  const first = getFirstModuleWeek1();
  if (first) {
    return moduleWorkspaceHref(1, first.kind, first.id);
  }
  return "/lecture/1/lecture-1";
}
