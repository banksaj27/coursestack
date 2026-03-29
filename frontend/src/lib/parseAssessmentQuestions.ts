/**
 * Split one markdown page into sub-questions (### headings), numbered items, or a single block.
 */
export function splitPageIntoQuestionBlocks(pageMd: string): string[] {
  const t = pageMd.trim();
  if (!t) return [];

  const byH3 = t.split(/(?=^###\s+)/m);
  const h3Parts = byH3.map((p) => p.trim()).filter(Boolean);
  if (h3Parts.length > 1) return h3Parts;

  const lead = t.slice(0, 2000);
  const firstH2 = lead.match(/^[^\S\n]*##\s+\*?\*?([^\n*]+)/m);
  const h2Title = (firstH2?.[1] ?? "").replace(/\*+/g, "").trim().toLowerCase();
  const looksLikeInstructions =
    /^instructions\b/.test(h2Title) ||
    /^polic(y|ies)\b/.test(h2Title) ||
    /^honor\b/.test(h2Title) ||
    /^academic integrity\b/.test(h2Title) ||
    /^logistics\b/.test(h2Title) ||
    /^cover page\b/.test(h2Title);

  if (!looksLikeInstructions) {
    const numberedLines = t.match(/^\d+\.\s+/gm);
    if (numberedLines && numberedLines.length >= 2) {
      const byNum = t
        .split(/(?=^\d+\.\s+)/m)
        .map((p) => p.trim())
        .filter(Boolean);
      if (byNum.length > 1) return byNum;
    }
  }

  return [t];
}

export type ParsedQuestion =
  | {
      kind: "multiple_choice";
      stemMd: string;
      options: { id: string; label: string; text: string }[];
    }
  | { kind: "true_false"; stemMd: string }
  | { kind: "short_answer"; stemMd: string }
  /** Reading / stem only — no answer UI. */
  | { kind: "prose"; stemMd: string };

/** Lettered option line: A. text, **a.** text, (A) text, A) text, - A. text — case-insensitive letter. */
const OPT_PATTERNS = [
  /^\s*(?:[-*]\s+)?(?:\*\*)?([A-Z])(?:\*\*)?[.)]\s+(.+?)\s*$/i,
  /^\s*\(([A-Z])\)\s+(.+?)\s*$/i,
  /^\s*([A-Z])\)\s+(.+?)\s*$/i,
];

function matchOptionLine(line: string) {
  for (const re of OPT_PATTERNS) {
    const m = line.match(re);
    if (m)
      return { id: m[1].toUpperCase(), text: m[2].trim() };
  }
  return null;
}

function stripTrailingOptionLines(lines: string[]): {
  stemLines: string[];
  options: { id: string; label: string; text: string }[];
} {
  const options: { id: string; label: string; text: string }[] = [];
  let end = lines.length;
  while (end > 0) {
    while (end > 0 && !(lines[end - 1] ?? "").trim()) {
      end -= 1;
    }
    if (end <= 0) break;
    const line = lines[end - 1] ?? "";
    const m = matchOptionLine(line);
    if (!m) break;
    options.unshift({
      id: m.id,
      label: m.id,
      text: m.text,
    });
    end -= 1;
  }
  return { stemLines: lines.slice(0, end), options };
}

function tfNorm(s: string) {
  return s
    .replace(/\*\*/g, "")
    .replace(/\.$/, "")
    .trim()
    .toLowerCase();
}

function isTrueFalseOptions(
  options: { id: string; text: string }[],
): boolean {
  if (options.length !== 2) return false;
  const set = new Set(options.map((o) => tfNorm(o.text)));
  return set.has("true") && set.has("false");
}

const INSTRUCTION_TITLE =
  /^(instructions|policies|policy|honor code|academic integrity|timing|logistics|overview|before you begin|general information|format|submission|cover page)/i;

/** Non-question sections (instructions, policies, etc.) — markdown only, no answer UI. */
export function isInstructionBlock(blockMd: string): boolean {
  const t = blockMd.trim();
  if (!t) return false;
  const firstLine = t.split("\n")[0]?.trim() ?? "";
  const hm = firstLine.match(/^#{2,3}\s*\*?\*?(.+?)\*?\*?\s*$/);
  if (!hm) return false;
  const title = hm[1].replace(/\*+/g, "").trim();
  return INSTRUCTION_TITLE.test(title);
}

function looksLikeShortAnswerBlock(blockMd: string): boolean {
  const t = blockMd.trim();
  if (!t) return false;
  const firstLine = t.split("\n")[0]?.trim() ?? "";

  const h2 = firstLine.match(/^##\s+\*?\*?(.+?)\*?\*?\s*$/);
  if (h2) {
    const title = h2[1].replace(/\*+/g, "").trim();
    if (/^(question|problem|exercise|short\s*answer)\b/i.test(title)) return true;
    if (/^q\s*\d+/i.test(title)) return true;
    if (/^part\s+[ivxlcdm\d]/i.test(title)) return true;
    if (/\(\s*\d+\s*(?:pts?|points?)\s*\)/i.test(title)) return true;
  }

  const hm = firstLine.match(/^###\s*\*?\*?(.+?)\*?\*?\s*$/);
  if (hm) {
    const title = hm[1].replace(/\*+/g, "").trim();
    if (/^(question|problem|exercise)\b/i.test(title)) return true;
    if (/^short\s*answer\b/i.test(title)) return true;
    if (/^written|free\s*response\b/i.test(title)) return true;
    if (/^q\s*\d+/i.test(title)) return true;
    if (/^part\s+[ivxlcdm\d]/i.test(title)) return true;
  }
  if (/^\d+\.\s/.test(firstLine) && /\?/.test(t.slice(0, 2500))) return true;
  const head = t.slice(0, 1200);
  if (
    /short answer|show your work|briefly explain|prove that|derive |compute |evaluate |find the |show that |explain why|justify|demonstrate that|sketch a proof/i.test(
      head,
    )
  ) {
    return true;
  }
  return false;
}

/** Classify one block: MC, T/F, short answer, or prose (no answer UI). */
export function parseQuestionBlock(blockMd: string): ParsedQuestion {
  const lines = blockMd.replace(/\r\n/g, "\n").split("\n");
  const { stemLines, options } = stripTrailingOptionLines(lines);
  const stemMd = stemLines.join("\n").trim();

  if (options.length >= 2) {
    if (isTrueFalseOptions(options)) {
      return { kind: "true_false", stemMd };
    }
    return {
      kind: "multiple_choice",
      stemMd,
      options: options.map((o) => ({
        id: o.id,
        label: o.label,
        text: o.text,
      })),
    };
  }

  if (looksLikeShortAnswerBlock(blockMd)) {
    return { kind: "short_answer", stemMd: blockMd.trim() };
  }

  return { kind: "prose", stemMd: blockMd.trim() };
}
