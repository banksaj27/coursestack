const STORAGE_KEY = "yhack-problem-set-global-house-rules-v1";

let cache = "";
let hydrated = false;

/** Hydrate from localStorage (call from hydrateWeekWorkspace on client). */
export function hydrateProblemSetGlobalRules(): void {
  if (typeof window === "undefined") return;
  try {
    cache = localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    cache = "";
  }
  hydrated = true;
}

/** House rules for every problem set (studio + week generation). */
export function getProblemSetGlobalRules(): string {
  if (typeof window !== "undefined" && !hydrated) {
    hydrateProblemSetGlobalRules();
  }
  return cache;
}

export function setProblemSetGlobalRules(text: string): void {
  cache = text;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    /* quota */
  }
}
