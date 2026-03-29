import type { ParsedQuestion } from "@/lib/parseAssessmentQuestions";

function extractRawCorrectPayload(blockMd: string): string | null {
  const t = blockMd.replace(/\r\n/g, "\n");
  const patterns: RegExp[] = [
    /\*\*Correct\s*:\s*([\s\S]+?)\s*\*\*/i,
    /\(Correct\s*:\s*([^)]+)\)/i,
    /<!--\s*correct\s*:\s*([^>]+)\s*-->/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    const v = m?.[1]?.trim();
    if (v) return v;
  }
  for (const line of t.split("\n")) {
    const plain = line.replace(/[*_`]+/g, "").trim();
    const am = plain.match(
      /^(?:Correct(?:\s+answer)?|Answer\s*key)\s*:\s*(.+)$/i,
    );
    if (am?.[1]) return am[1].trim();
    const am2 = plain.match(/^Answer\s*:\s*(.+)$/i);
    if (am2?.[1]) return am2[1].trim();
  }
  return null;
}

export type ReviewCorrectHints =
  | { kind: "mc"; letters: Set<string> }
  | { kind: "tf"; value: "True" | "False" };

/**
 * Parse autograding keys from the instructor `body_md` block so review mode can mark the correct
 * MC / T–F choice(s). Returns null if no key is found.
 */
export function extractAssessmentCorrectForReview(
  rawBlockMd: string,
  questionKind: ParsedQuestion["kind"],
): ReviewCorrectHints | null {
  if (!rawBlockMd.trim()) return null;

  if (questionKind === "true_false") {
    const t = rawBlockMd.replace(/\r\n/g, "\n");
    const tm = t.match(
      /(?:\(Correct\s*:\s*(True|False)\)|\*\*Correct\s*:\s*(True|False)\s*\*\*|<!--\s*correct\s*:\s*(True|False)\s*-->)/i,
    );
    if (tm) {
      const w = (tm[1] || tm[2] || tm[3] || "").toLowerCase();
      if (w === "true") return { kind: "tf", value: "True" };
      if (w === "false") return { kind: "tf", value: "False" };
    }
    const raw = extractRawCorrectPayload(rawBlockMd);
    if (raw) {
      const low = raw.trim().toLowerCase();
      if (low === "true") return { kind: "tf", value: "True" };
      if (low === "false") return { kind: "tf", value: "False" };
    }
    return null;
  }

  if (questionKind !== "multiple_choice") return null;

  const raw = extractRawCorrectPayload(rawBlockMd);
  if (!raw) return null;
  if (/^\s*(true|false)\s*$/i.test(raw) && !/\b[A-E]\b/i.test(raw)) {
    return null;
  }
  const letters = new Set<string>();
  for (const m of raw.matchAll(/\b([A-E])\b/gi)) {
    letters.add(m[1].toUpperCase());
  }
  return letters.size ? { kind: "mc", letters } : null;
}

/**
 * Pull instructor sample / reference answer text from raw `body_md` for review mode only
 * (same markers as autograding docs; not shown during testing).
 */
export function extractSampleAnswerExcerpt(
  blockMd: string,
  maxLen = 2800,
): string {
  const t = blockMd.replace(/\r\n/g, "\n");
  const patterns: RegExp[] = [
    /<!--\s*sa-ref:\s*([\s\S]*?)\s*-->/i,
    /\*\*\(\s*Sample answer\s*:\s*([\s\S]*?)\)\*\*/i,
    /\*\*Sample answer\s*:\s*\*\*\s*([\s\S]+?)(?=\n#{1,3}\s|\n\*\*\(Correct|\n\*\*Correct\s*:|$)/i,
    /\*\*Reference answer\s*:\s*\*\*\s*([\s\S]+?)(?=\n#{1,3}\s|\n\*\*\(Correct|\n\*\*Correct\s*:|$)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    const body = m?.[1]?.trim();
    if (!body) continue;
    if (body.length > maxLen) return `${body.slice(0, maxLen - 1)}…`;
    return body;
  }
  return "";
}
