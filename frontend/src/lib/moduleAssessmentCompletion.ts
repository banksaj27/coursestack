import type { AssessmentGradeItem } from "@/lib/assessmentGradeApi";
import type { WeekModule } from "@/types/weekModular";
import { loadModularWeekPack } from "@/lib/weekModularPersistence";

const STORAGE_KEY = "yhack-module-assessment-completion-v1";

type StoredEntry = {
  completedAt?: number;
  score?: number;
  maxScore?: number;
  lectureComplete?: boolean;
  /** Saved responses from testing mode, keyed `pageIdx-blockIdx`. */
  gradedAnswers?: Record<string, string>;
  /** Per-question results from server grading (quiz/exam). */
  gradedItems?: AssessmentGradeItem[];
  /** Problem set: model feedback after PDF grading. */
  gradedFeedbackMd?: string;
  /** Problem set: once true, stays true (module stays “complete” on timeline). */
  problemSetCompleted?: boolean;
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
  /** Populated after quiz/exam API grading; used in review UI. */
  items?: AssessmentGradeItem[];
  feedbackMd?: string;
};

export type ModuleProgress = {
  lectureComplete: boolean;
  graded: GradedAttempt | null;
  /** Problem set: sticky after first successful PDF grade. */
  problemSetCompleted: boolean;
};

function parseGradeItems(raw: unknown): AssessmentGradeItem[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: AssessmentGradeItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (typeof o.key !== "string" || typeof o.kind !== "string") continue;
    const earned = Number(o.earned);
    const max = Number(o.max);
    if (!Number.isFinite(earned) || !Number.isFinite(max)) continue;
    out.push({
      key: o.key,
      kind: o.kind,
      earned,
      max,
      note: typeof o.note === "string" ? o.note : "",
    });
  }
  return out.length ? out : undefined;
}

function toGradedAttempt(v: StoredEntry): GradedAttempt | null {
  if (typeof v.score !== "number" || typeof v.maxScore !== "number") {
    return null;
  }
  const answers =
    v.gradedAnswers && typeof v.gradedAnswers === "object"
      ? { ...v.gradedAnswers }
      : {};
  const feedbackMd =
    typeof v.gradedFeedbackMd === "string" && v.gradedFeedbackMd.trim()
      ? v.gradedFeedbackMd
      : undefined;
  return {
    score: v.score,
    maxScore: v.maxScore,
    completedAt:
      typeof v.completedAt === "number" ? v.completedAt : Date.now(),
    answers,
    items: parseGradeItems(v.gradedItems),
    ...(feedbackMd ? { feedbackMd } : {}),
  };
}

export function getModuleProgress(week: number, moduleId: string): ModuleProgress {
  const k = key(week, moduleId);
  const root = readRoot();
  const v = root[k];
  if (!v || typeof v !== "object") {
    return { lectureComplete: false, graded: null, problemSetCompleted: false };
  }
  return {
    lectureComplete: v.lectureComplete === true,
    graded: toGradedAttempt(v),
    problemSetCompleted: v.problemSetCompleted === true,
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
  gradeItems?: AssessmentGradeItem[],
): void {
  const root = readRoot();
  const k = key(week, moduleId);
  const prev = root[k];
  const next: StoredEntry = {
    ...(prev && typeof prev === "object" ? prev : {}),
    score,
    maxScore,
    gradedAnswers: answers,
    completedAt: Date.now(),
  };
  if (gradeItems && gradeItems.length > 0) {
    next.gradedItems = gradeItems;
  } else {
    delete next.gradedItems;
  }
  root[k] = next;
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
  delete next.gradedItems;
  delete next.gradedFeedbackMd;
  // problemSetCompleted is preserved for problem sets (sticky completion).
  root[k] = next;
  writeRoot(root);
}

/** Record PDF grading for a problem set; sets sticky `problemSetCompleted`. */
export function setProblemSetPdfGrade(
  week: number,
  moduleId: string,
  score: number,
  maxScore: number,
  feedbackMd: string,
): void {
  const root = readRoot();
  const k = key(week, moduleId);
  const prev = root[k];
  root[k] = {
    ...(prev && typeof prev === "object" ? prev : {}),
    score,
    maxScore,
    gradedFeedbackMd: feedbackMd,
    problemSetCompleted: true,
    gradedAnswers: {},
    completedAt: Date.now(),
  };
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

/** Same predicate as Weekly Plan module rows (`ModuleTimelineNode` “done”). */
export function isModuleCompleteForWeeklyPlan(
  mod: WeekModule,
  progress: ModuleProgress,
): boolean {
  const graded = isGradedAssessmentKind(mod.kind);
  return (
    (mod.kind === "lecture" && progress.lectureComplete) ||
    (graded && progress.graded != null) ||
    (mod.kind === "problem_set" && progress.problemSetCompleted)
  );
}

/** True when every module in the saved week pack is complete per `isModuleCompleteForWeeklyPlan`. */
export function isWeekAllModulesComplete(week: number): boolean {
  if (typeof window === "undefined") return false;
  const pack = loadModularWeekPack(week);
  const modules = pack?.generated.modules ?? [];
  if (modules.length === 0) return false;
  for (const mod of modules) {
    if (!mod.id) return false;
    const p = getModuleProgress(week, mod.id);
    if (!isModuleCompleteForWeeklyPlan(mod, p)) return false;
  }
  return true;
}
