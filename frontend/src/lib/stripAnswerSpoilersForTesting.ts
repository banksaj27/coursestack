/**
 * Remove answer keys, sample/reference answers, and solution blocks from assessment
 * markdown for student-facing views (testing mode, review, and the main quiz/exam/PS preview).
 */

import { normalizeAdjacentMarkdownHeadings } from "@/lib/normalizeAssessmentMarkdown";

function isMarkdownHeadingLine(trimmed: string): boolean {
  return /^#{1,6}\s/.test(trimmed);
}

function nextNonEmptyLineIndex(lines: string[], from: number): number {
  let j = from;
  while (j < lines.length && !lines[j].trim()) j += 1;
  return j;
}

function lineStartsMcOption(raw: string): boolean {
  return /^\s*[A-E][.)]\s/.test(raw);
}

/** If sample markers appear in a heading-delimited chunk and MC options do not follow, drop the tail. */
function stripSampleRegionsUpToHeading(md: string): string {
  const chunks = md.split(/(?=^#{1,6}\s)/m);
  return chunks
    .map((chunk) => {
      const paren = chunk.search(/\*\*\(\s*Sample answer\s*:/i);
      const bold = chunk.search(/\*\*Sample answer\s*:/i);
      const cands = [paren, bold].filter((i) => i >= 0);
      const cut = cands.length ? Math.min(...cands) : -1;
      if (cut < 0) return chunk;
      const tail = chunk.slice(cut);
      let optLines = 0;
      for (const ln of tail.split("\n")) {
        if (/^\s*[A-E][.)]\s+\S/.test(ln)) optLines += 1;
      }
      if (optLines >= 2) return chunk;
      return chunk.slice(0, cut).replace(/\s+$/u, "");
    })
    .join("");
}

export function stripAnswerSpoilersForTesting(md: string): string {
  let s = normalizeAdjacentMarkdownHeadings(md);
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  s = stripSampleRegionsUpToHeading(s);

  // Inline bold keys (often on the same line as the stem).
  s = s.replace(/\*\*\(Correct\s*:\s*[^)]+\)\*\*/gi, "");
  s = s.replace(/\*\*\(Sample answer\s*:[\s\S]*?\)\*\*/gi, "");
  s = s.replace(
    /\*\*Correct\s*:\s*(?:[A-E](?:\s*,\s*[A-E])*|True|False)\s*\*\*/gi,
    "",
  );
  // Plain parenthesis keys (machine-readable lines).
  s = s.replace(
    /\(\s*Correct\s*:\s*(?:True|False|[A-E](?:\s*,\s*[A-E])*)\s*\)/gi,
    "",
  );

  s = s.replace(
    /```[\w_-]*\s*(?:answer|solution|key|rubric)[\w_-]*\s*\n[\s\S]*?```/gi,
    "",
  );

  const lines = s.split("\n");
  const out: string[] = [];
  let skip = false;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (skip) {
      if (isMarkdownHeadingLine(trimmed)) {
        skip = false;
        out.push(line);
        i += 1;
        continue;
      }
      if (!trimmed) {
        const j = nextNonEmptyLineIndex(lines, i + 1);
        if (j >= lines.length) {
          i += 1;
          continue;
        }
        const nextRaw = lines[j] ?? "";
        const nextTrim = nextRaw.trim();
        if (
          isMarkdownHeadingLine(nextTrim) ||
          lineStartsMcOption(nextRaw)
        ) {
          skip = false;
          i = j;
          continue;
        }
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    if (
      /^\s*\*\*\)\s*$/i.test(trimmed) ||
      /^\s*\)\*\*\s*$/i.test(trimmed) ||
      /^\s*\*{2,}\)\s*$/i.test(trimmed)
    ) {
      i += 1;
      continue;
    }

    const answerHeader =
      /^\s*(?:\*\*)?\s*(Answer(?:\s+key)?|Solution|Correct(?:\s+answer)?|Key)\s*(?:\*\*)?\s*:/i;
    const solutionishHeading =
      /^\s*#{1,6}\s*(?:solution|worked\s+solution|detailed\s+solution|explanation|answer\s+key)\b/i.test(
        trimmed,
      );
    const solutionishLine =
      /^\s*(?:\*\*)?(?:Worked\s+solution|Detailed\s+solution|Explanation)\s*(?:\*\*)?\s*:/i.test(
        trimmed,
      );

    if (
      answerHeader.test(trimmed) ||
      solutionishHeading ||
      solutionishLine ||
      /^\s*(?:\*\*)?Grading\s*(?:\*\*)?\s*:/i.test(trimmed) ||
      /^\s*\*\*Sample answer\s*:/i.test(trimmed) ||
      /^\s*\*\*\(Sample answer\s*:/i.test(trimmed) ||
      /^\s*\*\*Reference answer\s*:/i.test(trimmed) ||
      /^\s*Sample answer\s*:/i.test(trimmed)
    ) {
      skip = true;
      i += 1;
      continue;
    }

    if (
      /\(Correct\s*:\s*[A-E]\)/i.test(trimmed) ||
      /\*\*Correct\s*:\s*[A-E]\*\*/i.test(trimmed) ||
      /\(Correct\s*:\s*(?:True|False)\)/i.test(trimmed) ||
      /\*\*Correct\s*:\s*(?:True|False)\*\*/i.test(trimmed)
    ) {
      i += 1;
      continue;
    }

    if (
      /^\s*Correct(?:\s+answer)?\s*:\s*[A-E]\b/i.test(trimmed) ||
      /^\s*Answer\s*key\s*:\s*[A-E]\b/i.test(trimmed) ||
      /^\s*Answer\s*:\s*[A-E]\b/i.test(trimmed) ||
      /^\s*Correct(?:\s+answer)?\s*:\s*(?:True|False)\b/i.test(trimmed)
    ) {
      i += 1;
      continue;
    }

    out.push(
      line
        .replace(/\*\*\)\s*$/g, "")
        .replace(/\)\*\*\s*$/g, ""),
    );
    i += 1;
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
