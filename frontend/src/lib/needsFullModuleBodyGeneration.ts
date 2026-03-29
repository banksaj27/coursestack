import { WEEKLY_PLAN_BODY_MD_PLACEHOLDER } from "@/lib/weekModularBootstrap";

/** Weekly Plan placeholder / stub — full lecture notes are long; use a high word floor. */
export function needsFullModuleBodyGeneration(body: string): boolean {
  const t = body.trim();
  if (t.length < 120) return true;
  const words = t.split(/\s+/).filter(Boolean).length;
  return words < 3200;
}

/**
 * Problem sets are much shorter than lecture notes. Reusing the 3200-word lecture rule
 * would always treat a normal assignment as “incomplete” and re-run the pipeline forever.
 * Only treat as needing auto-generation when still a stub / weekly placeholder.
 */
export function needsFullProblemSetBodyGeneration(
  body: string,
  solutionMd?: string,
): boolean {
  const t = body.trim();
  if (t.length < 120) return true;
  if (t === WEEKLY_PLAN_BODY_MD_PLACEHOLDER) return true;
  const sol = (solutionMd ?? "").trim();
  if (sol.length < 80) return true;
  return false;
}
