const STORAGE_KEY = "yhack-week-format-instructions-v1";

let cache = "";
let hydrated = false;

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
