const STORAGE_KEY = "yhack-week-format-instructions-v1";

let cache = "";
let hydrated = false;

/** Fingerprint of global format text — used to invalidate saved week modules when rules change. */
export function getGlobalFormatRulesSignature(): string {
  const t = getGlobalFormatInstructions();
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${t.length}:${(h >>> 0).toString(36)}`;
}

export function hydrateWeekFormatInstructions(): void {
  if (typeof window === "undefined") return;
  try {
    cache = localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    cache = "";
  }
  hydrated = true;
}

export function getGlobalFormatInstructions(): string {
  if (typeof window !== "undefined" && !hydrated) {
    hydrateWeekFormatInstructions();
  }
  return cache;
}

/** Call on every edit so the next API request sees the latest text even before blur. */
export function setGlobalFormatInstructions(text: string): void {
  cache = text;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    /* quota */
  }
}

/** Idempotent: load from localStorage once before reads (used at API boundary). */
export function ensureWeekFormatHydrated(): void {
  if (typeof window !== "undefined" && !hydrated) {
    hydrateWeekFormatInstructions();
  }
}

/** Clear saved global format rules. */
export function resetGlobalFormatInstructions(): void {
  cache = "";
  hydrated = true;
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* quota */
  }
}
