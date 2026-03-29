import { normalizeAdjacentMarkdownHeadings } from "@/lib/normalizeAssessmentMarkdown";

/**
 * Split markdown into sections for testing mode (one section per “page”).
 * Prefers `## …` (problem set / quiz style). Falls back to top-level `# …` when
 * there are no `##` headings — common in exam drafts (`# Question 1`, `# Question 2`).
 */
export function splitMarkdownIntoH2Pages(md: string): string[] {
  const t = normalizeAdjacentMarkdownHeadings(md).trim();
  if (!t) return [];

  const byH2 = t.split(/(?=^##\s+)/m);
  const h2Parts = byH2.map((p) => p.trim()).filter(Boolean);
  if (h2Parts.length > 1) return h2Parts;

  const single = h2Parts[0] ?? t;
  /** Single `#` title line — not `##` (negative lookahead after optional spaces). */
  const byH1 = single.split(/(?=^#\s*(?!#))/m);
  const h1Parts = byH1.map((p) => p.trim()).filter(Boolean);
  if (h1Parts.length > 1) return h1Parts;

  return h2Parts.length ? h2Parts : [t];
}
