import type { WeekModule } from "@/types/weekModular";

const STORAGE_KEY = "yhack-module-assessment-completion-v1";

type StoredEntry = {
  completedAt?: number;
  score?: number;
  maxScore?: number;
  lectureComplete?: boolean;
  /** Saved responses from testing mode, keyed `pageIdx-blockIdx`. */
  gradedAnswers?: Record<string, string>;
};

type Root = Record<string, StoredEntry>;

function key(week: number, moduleId: string) {
  return `${week}::${moduleId}`;
}

function readRoot(): Root {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Root;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeRoot(root: Root) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new Event("module-assessment-completion"));
}

export type GradedAttempt = {
  score: number;
  maxScore: number;
  completedAt: number;
  answers: Record<string, string>;
};

export type ModuleProgress = {
  lectureComplete: boolean;
  graded: GradedAttempt | null;
};

function toGradedAttempt(v: StoredEntry): GradedAttempt | null {
  if (typeof v.score !== "number" || typeof v.maxScore !== "number") {
    return null;
  }
  const answers =
    v.gradedAnswers && typeof v.gradedAnswers === "object"
      ? { ...v.gradedAnswers }
      : {};
  return {
    score: v.score,
    maxScore: v.maxScore,
    completedAt:
      typeof v.completedAt === "number" ? v.completedAt : Date.now(),
    answers,
  };
}

export function getModuleProgress(week: number, moduleId: string): ModuleProgress {
  const k = key(week, moduleId);
  const root = readRoot();
  const v = root[k];
  if (!v || typeof v !== "object") {
    return { lectureComplete: false, graded: null };
  }
  return {
    lectureComplete: v.lectureComplete === true,
    graded: toGradedAttempt(v),
  };
}

export function getModuleAssessmentCompletion(
  week: number,
  moduleId: string,
): { score: number; maxScore: number; completedAt: number } | null {
  const g = getModuleProgress(week, moduleId).graded;
  if (!g) return null;
  return {
    score: g.score,
    maxScore: g.maxScore,
    completedAt: g.completedAt,
  };
}

export function setModuleAssessmentCompletion(
  week: number,
  moduleId: string,
  score: number,
  maxScore: number,
  answers: Record<string, string> = {},
): void {
  const root = readRoot();
  const k = key(week, moduleId);
  const prev = root[k];
  root[k] = {
    ...(prev && typeof prev === "object" ? prev : {}),
    score,
    maxScore,
    gradedAnswers: answers,
    completedAt: Date.now(),
  };
  writeRoot(root);
}

/** Clears graded attempt so the student can start again (keeps lecture completion if any). */
export function clearGradedModuleAttempt(week: number, moduleId: string): void {
  const root = readRoot();
  const k = key(week, moduleId);
  const prev = root[k];
  if (!prev || typeof prev !== "object") return;
  const next: StoredEntry = { ...prev };
  delete next.score;
  delete next.maxScore;
  delete next.gradedAnswers;
  root[k] = next;
  writeRoot(root);
}

export function setLectureModuleComplete(
  week: number,
  moduleId: string,
  complete: boolean = true,
): void {
  const root = readRoot();
  const k = key(week, moduleId);
  const prev = root[k];
  const base = prev && typeof prev === "object" ? prev : {};
  if (complete) {
    root[k] = {
      ...base,
      lectureComplete: true,
      completedAt: Date.now(),
    };
  } else {
    const next: StoredEntry = { ...base };
    delete next.lectureComplete;
    root[k] = next;
  }
  writeRoot(root);
}

export function clearAllModuleAssessmentCompletions(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("module-assessment-completion"));
}

export function isGradedAssessmentKind(k: WeekModule["kind"]): boolean {
  return k === "problem_set" || k === "quiz" || k === "exam";
}
