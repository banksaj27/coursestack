import type { Syllabus } from "@/types/syllabus";
import type { WeekModularGenerated } from "@/types/weekModular";

export function buildInitialModularWeek(
  syllabus: Syllabus,
  weekNum: number,
): WeekModularGenerated {
  const w = syllabus.course_plan.weeks.find((x) => x.week === weekNum);
  if (!w) {
    return { modules: [], instructor_notes_md: "" };
  }

  return {
    modules: [],
    instructor_notes_md: `**Week ${w.week}: ${w.title}** — modules will appear on the timeline after generation.

Topics: ${w.topics.join("; ")}.`,
  };
}
