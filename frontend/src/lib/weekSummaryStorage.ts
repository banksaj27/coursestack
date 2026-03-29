const STORAGE_KEY = "yhack-week-context-summaries-v1";

export type WeekSummaryMap = Record<number, string>;

export function readWeekSummariesFromStorage(): WeekSummaryMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: WeekSummaryMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      const w = Number(k);
      if (!Number.isNaN(w) && typeof v === "string" && v.trim()) {
        out[w] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function persistWeekSummaries(map: WeekSummaryMap): void {
  if (typeof window === "undefined") return;
  try {
    const serial: Record<string, string> = {};
    for (const [k, v] of Object.entries(map)) {
      if (v.trim()) serial[String(k)] = v;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serial));
  } catch {
    /* ignore quota */
  }
}

export function defaultMaxHistoryMessages(): number | undefined {
  const v = process.env.NEXT_PUBLIC_WEEK_STUDIO_MAX_HISTORY_MESSAGES;
  if (v === undefined || v === "") return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
