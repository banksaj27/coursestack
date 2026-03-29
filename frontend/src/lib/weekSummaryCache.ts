import {
  clearWeekSummariesStorage,
  persistWeekSummaries,
  readWeekSummariesFromStorage,
  type WeekSummaryMap,
} from "./weekSummaryStorage";

let cache: WeekSummaryMap = {};
let hydrated = false;

/** Call from client pages on mount so the first request includes saved summaries. */
export function hydrateWeekSummaryCache(): void {
  if (typeof window === "undefined") return;
  cache = { ...readWeekSummariesFromStorage() };
  hydrated = true;
}

export function getWeekSummaryCache(): WeekSummaryMap {
  if (typeof window !== "undefined" && !hydrated) {
    hydrateWeekSummaryCache();
  }
  return { ...cache };
}

/** Persist and share with Weekly Plan (and course planner context). */
export function setWeekSummaryForWeek(
  week: number,
  summary: string | null | undefined,
): void {
  if (typeof window === "undefined") return;
  const t = summary?.trim();
  if (!t) return;
  hydrateWeekSummaryCache();
  cache[week] = t;
  persistWeekSummaries(cache);
}

/** Payload field for the week-modular API. */
/** Drop all in-memory and stored week summaries (syllabus invalidated). */
export function clearAllWeekSummaries(): void {
  if (typeof window === "undefined") return;
  clearWeekSummariesStorage();
  cache = {};
  hydrated = true;
}

export function weekSummariesForApiPayload(): { week: number; summary: string }[] {
  const c = getWeekSummaryCache();
  return Object.entries(c)
    .filter(([, s]) => s.trim())
    .map(([w, s]) => ({ week: Number(w), summary: s.trim() }))
    .sort((a, b) => a.week - b.week);
}
