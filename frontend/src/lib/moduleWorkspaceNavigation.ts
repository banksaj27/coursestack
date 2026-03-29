import type { WeekModule, WeekModuleKind } from "@/types/weekModular";

const KIND_LABEL: Record<WeekModuleKind, string> = {
  lecture: "Lecture",
  project: "Project",
  problem_set: "Problem set",
  quiz: "Quiz",
  exam: "Exam",
};

export function moduleWorkspaceHref(
  week: number,
  kind: WeekModuleKind,
  id: string,
): string {
  const enc = encodeURIComponent(id);
  const paths: Record<WeekModuleKind, string> = {
    lecture: `/lecture/${week}/${enc}`,
    problem_set: `/problem-set/${week}/${enc}`,
    quiz: `/quiz/${week}/${enc}`,
    project: `/project/${week}/${enc}`,
    exam: `/exam/${week}/${enc}`,
  };
  return paths[kind];
}

export type ModuleNavLink = {
  href: string;
  title: string;
  kindLabel: string;
};

function toNavLink(week: number, m: WeekModule): ModuleNavLink {
  return {
    href: moduleWorkspaceHref(week, m.kind, m.id),
    title: m.title,
    kindLabel: KIND_LABEL[m.kind] ?? m.kind,
  };
}

/** Prev/next in weekly timeline order (all module kinds). */
export function getWeekModuleNeighbors(
  week: number,
  modules: WeekModule[],
  currentModuleId: string,
): { prev: ModuleNavLink | null; next: ModuleNavLink | null } {
  const list = modules.filter((m) => Boolean(m.id?.trim()));
  const i = list.findIndex((m) => m.id === currentModuleId);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? toNavLink(week, list[i - 1]) : null,
    next: i < list.length - 1 ? toNavLink(week, list[i + 1]) : null,
  };
}
