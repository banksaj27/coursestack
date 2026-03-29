import type { WeekModule } from "@/types/weekModular";

const DEFAULT_TOTAL_BY_KIND: Partial<Record<WeekModule["kind"], number>> = {
  problem_set: 10,
  quiz: 20,
  exam: 100,
};

export function defaultAssessmentTotalPoints(
  kind: WeekModule["kind"],
): number | null {
  return DEFAULT_TOTAL_BY_KIND[kind] ?? null;
}

/** Total points for display and testing (uses saved value or kind default). */
export function effectiveAssessmentTotalPoints(m: WeekModule): number {
  if (
    m.assessment_total_points != null &&
    Number.isFinite(m.assessment_total_points)
  ) {
    return m.assessment_total_points;
  }
  const d = defaultAssessmentTotalPoints(m.kind);
  return d ?? 0;
}

/** Points for page `index` when body is split into `pageCount` sections. */
export function pointsForPage(
  m: WeekModule,
  pageIndex: number,
  pageCount: number,
): number {
  const total = effectiveAssessmentTotalPoints(m);
  const items = m.graded_item_points ?? [];
  if (
    pageCount > 0 &&
    items.length === pageCount &&
    items[pageIndex] != null
  ) {
    return items[pageIndex]!;
  }
  if (items[pageIndex] != null) return items[pageIndex]!;
  if (pageCount <= 0) return total;
  return total / pageCount;
}
