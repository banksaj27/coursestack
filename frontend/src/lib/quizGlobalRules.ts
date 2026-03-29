const STORAGE_KEY = "yhack-quiz-global-house-rules-v1";

let cache = "";
let hydrated = false;

/** Hydrate from localStorage (call from hydrateWeekWorkspace on client). */
export function hydrateQuizGlobalRules(): void {
  if (typeof window === "undefined") return;
  try {
    cache = localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    cache = "";
  }
  hydrated = true;
}

/** House rules for every quiz (studio + week generation). */
export function getQuizGlobalRules(): string {
  if (typeof window !== "undefined" && !hydrated) {
    hydrateQuizGlobalRules();
  }
  return cache;
}

export function setQuizGlobalRules(text: string): void {
  cache = text;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    /* quota */
  }
}
