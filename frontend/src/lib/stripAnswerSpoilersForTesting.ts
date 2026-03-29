/**
 * Remove likely answer keys / solutions from assessment markdown while the student
 * is taking an attempt. Review mode uses the raw module body (after submit).
 */
export function stripAnswerSpoilersForTesting(md: string): string {
  let s = md.replace(/\r\n/g, "\n");
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  s = s.replace(
    /```[\w_-]*\s*(?:answer|solution|key|rubric)[\w_-]*\s*\n[\s\S]*?```/gi,
    "",
  );

  const lines = s.split("\n");
  const out: string[] = [];
  let skip = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const answerHeader =
      /^\s*(?:\*\*)?\s*(Answer(?:\s+key)?|Solution|Correct(?:\s+answer)?|Key)\s*(?:\*\*)?\s*:/i;
    if (answerHeader.test(trimmed) || /^\s*(?:\*\*)?Grading\s*(?:\*\*)?\s*:/i.test(trimmed)) {
      skip = true;
      continue;
    }

    if (skip) {
      if (!trimmed || trimmed.startsWith("#")) {
        skip = false;
        if (trimmed.startsWith("#")) out.push(line);
      }
      continue;
    }

    if (
      /\(Correct\s*:\s*[A-E]\)/i.test(trimmed) ||
      /\*\*Correct\s*:\s*[A-E]\*\*/i.test(trimmed)
    ) {
      continue;
    }

    out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
