import { ensureWeekFormatHydrated } from "@/lib/weekFormatInstructions";
import { clearAllLectureStudioMessages } from "@/lib/lectureStudioPersistence";
import { loadModularWeekPack } from "@/lib/weekModularPersistence";

const STORAGE_KEY = "yhack-last-lecture-studio-v1";

export type LastLectureStudio = { week: number; moduleId: string };

export function setLastOpenedLectureStudio(week: number, moduleId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ week, moduleId } satisfies LastLectureStudio),
    );
  } catch {
    /* quota */
  }
}

export function getLastOpenedLectureStudio(): LastLectureStudio | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { week?: unknown; moduleId?: unknown };
    const week = Number(p.week);
    const moduleId = typeof p.moduleId === "string" ? p.moduleId : "";
    if (!Number.isFinite(week) || week < 1 || !moduleId) return null;
    return { week, moduleId };
  } catch {
    return null;
  }
}

export function clearLastOpenedLectureStudio(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Lecture-studio chat history + last Coursework nav target; call when weekly modules are wiped or replaced. */
export function clearAllCourseworkCaches(): void {
  clearAllLectureStudioMessages();
  clearLastOpenedLectureStudio();
}

/** First lecture module in saved week 1, if any. */
function getFirstLectureModuleIdWeek1(): string | null {
  ensureWeekFormatHydrated();
  const pack = loadModularWeekPack(1);
  const first = pack?.generated.modules.find((m) => m.kind === "lecture");
  return first?.id?.trim() ? first.id : null;
}

/**
 * Where Coursework nav should open: last lecture studio visited, else week 1 / first
 * lecture module when saved data exists, else `/lecture/1/lecture-1`.
 */
export function getCourseworkDestinationHref(): string {
  if (typeof window === "undefined") {
    return "/lecture/1/lecture-1";
  }
  const last = getLastOpenedLectureStudio();
  if (last) {
    return `/lecture/${last.week}/${encodeURIComponent(last.moduleId)}`;
  }
  const id = getFirstLectureModuleIdWeek1();
  if (id) {
    return `/lecture/1/${encodeURIComponent(id)}`;
  }
  return "/lecture/1/lecture-1";
}
