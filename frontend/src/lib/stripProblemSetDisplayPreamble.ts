/**
 * Problem sets sometimes include syllabus-style boilerplate (due date, total points,
 * collaboration policy) before the first graded question. The app already shows
 * kind, week, and points in the panel header—strip this duplicate preamble for display.
 */
const FIRST_QUESTION_HEADING = /^##\s+Question\s+\d+/m;

/**
 * Drops everything before the first `## Question N` heading.
 * If there is no such heading, returns the string unchanged.
 */
export function stripProblemSetDisplayPreamble(bodyMd: string): string {
  const t = bodyMd.trim();
  if (!t) return t;
  const match = FIRST_QUESTION_HEADING.exec(t);
  if (!match || match.index === undefined || match.index === 0) {
    return t;
  }
  return t.slice(match.index).trimStart();
}
