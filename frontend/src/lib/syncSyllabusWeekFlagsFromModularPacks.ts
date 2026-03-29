import { loadModularWeekPack } from "@/lib/weekModularPersistence";
import { saveWeekModularSnapshot } from "@/lib/weekModularSyllabusPersistence";
import { useCourseStore } from "@/store/useCourseStore";
import { useWeekModularStore } from "@/store/useWeekModularStore";
import type { Week } from "@/types/course";
import type { Syllabus, SyllabusWeek } from "@/types/syllabus";
import type { WeekModularGenerated, WeekModule } from "@/types/weekModular";

function examText(m: WeekModule): string {
  return `${m.title}\n${m.summary}\n${m.one_line_summary ?? ""}`;
}

/** Last exam in module order is the assessment slot (matches weekly bootstrap rules). */
function inferExamAssessment(exams: WeekModule[]): "midterm" | "final" | null {
  if (exams.length === 0) return null;
  const last = exams[exams.length - 1];
  const text = examText(last).toLowerCase();
  const hasMid = /\bmidterm\b/.test(text);
  const hasFinal = /\bfinal\b/.test(text);
  if (hasFinal && !hasMid) return "final";
  if (hasMid && !hasFinal) return "midterm";
  if (hasFinal && hasMid) {
    const ti = last.title.toLowerCase();
    if (ti.includes("final")) return "final";
    if (ti.includes("midterm")) return "midterm";
    return "final";
  }
  return null;
}

function mergeWeekFlagsFromPack(
  base: SyllabusWeek,
  generated: WeekModularGenerated | null,
): Pick<SyllabusWeek, "has_homework" | "assessment"> {
  if (!generated) {
    return {
      has_homework: base.has_homework,
      assessment: base.assessment,
    };
  }
  const m = generated.modules;
  if (m.length === 0) {
    return { has_homework: false, assessment: null };
  }
  const hasProblemSet = m.some((x) => x.kind === "problem_set");
  const exams = m.filter((x) => x.kind === "exam");
  const assessment =
    exams.length === 0 ? null : inferExamAssessment(exams);
  return {
    has_homework: hasProblemSet,
    assessment,
  };
}

function toCourseAssessment(
  a: string | null | undefined,
): Week["assessment"] {
  if (a === "midterm" || a === "final") return a;
  return null;
}

/**
 * Derive `has_homework` / `assessment` from saved week packs (problem_set / exam modules)
 * and push into the weekly-plan syllabus + syllabus timeline (course planner) when exported.
 */
export function syncWeekFlagsFromModularPacks(): void {
  if (typeof window === "undefined") return;
  const wm = useWeekModularStore.getState();
  const syl = wm.syllabus;
  if (!syl.topic.trim() || syl.course_plan.weeks.length === 0) return;

  let changed = false;
  const nextWeeks = syl.course_plan.weeks.map((w) => {
    const stored = loadModularWeekPack(w.week);
    const flags = mergeWeekFlagsFromPack(w, stored?.generated ?? null);
    const a = flags.assessment ?? null;
    const b = w.assessment ?? null;
    if (w.has_homework === flags.has_homework && a === b) {
      return w;
    }
    changed = true;
    return { ...w, ...flags };
  });

  if (changed) {
    const nextSyllabus: Syllabus = {
      ...syl,
      course_plan: { weeks: nextWeeks },
    };
    useWeekModularStore.setState({ syllabus: nextSyllabus });
    saveWeekModularSnapshot(nextSyllabus, wm.selectedWeek);
  }
  maybePatchCourseStoreWeekFlags(nextWeeks);
}

function maybePatchCourseStoreWeekFlags(nextWeeks: SyllabusWeek[]): void {
  const cs = useCourseStore.getState();
  if (cs.phase !== "weekly_plan") return;
  const cur = cs.planState.course_plan.weeks;
  if (cur.length !== nextWeeks.length) return;

  let patch = false;
  const patched = cur.map((w) => {
    const fw = nextWeeks.find((x) => x.week === w.week);
    if (!fw) return w;
    const nextHw = fw.has_homework;
    const nextA = toCourseAssessment(fw.assessment);
    if (w.has_homework === nextHw && w.assessment === nextA) return w;
    patch = true;
    return {
      ...w,
      has_homework: nextHw,
      assessment: nextA,
    };
  });
  if (!patch) return;
  useCourseStore.setState({
    planState: {
      ...cs.planState,
      course_plan: { weeks: patched },
    },
  });
}

let didInitPackListener = false;

/** Subscribe once: any saved week pack re-derives syllabus flags for both weekly plan + syllabus timeline. */
export function initWeekPackFlagSyncListener(): void {
  if (typeof window === "undefined" || didInitPackListener) return;
  didInitPackListener = true;
  window.addEventListener("week-modular-pack-updated", () => {
    queueMicrotask(() => syncWeekFlagsFromModularPacks());
  });
}
