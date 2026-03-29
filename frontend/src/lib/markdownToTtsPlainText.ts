/**
 * Turn lecture markdown into plain text for TTS (drops LaTeX/code noise, keeps paragraph breaks).
 */

function stripBlock(block: string): string {
  let t = block;
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^[\s]*[-*+]\s+/gm, "");
  t = t.replace(/^\s*\d+\.\s+/gm, "");
  t = t.replace(/^---+$/gm, "");
  t = t.replace(/^:::+\s*\w*\s*$/gm, "");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/!\[[^\]]*]\([^)]*\)/g, " ");
  t = t.replace(/\[([^\]]+)]\([^)]*\)/g, "$1");
  t = t.replace(/\$\$[\s\S]*?\$\$/g, " [equation] ");
  t = t.replace(/\\\[([\s\S]*?)\\\]/g, " [equation] ");
  t = t.replace(/\\\(([\s\S]*?)\\\)/g, " [equation] ");
  t = t.replace(/\$[^$\n]+\$/g, " [equation] ");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/\*([^*]+)\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1");
  t = t.replace(/_([^_]+)_/g, "$1");
  t = t.replace(/\s+/g, " ");
  return t.trim();
}

export function markdownToTtsPlainText(md: string): string {
  let s = md.trim();
  s = s.replace(/```[\s\S]*?```/g, "\n\n");
  const blocks = s.split(/\n{2,}/);
  return blocks
    .map((b) => stripBlock(b))
    .filter(Boolean)
    .join("\n\n");
}

/** ElevenLabs request cap is 10k; stay under for safety. */
const TTS_CHUNK_CHARS = 9000;

/** First chunk kept short so TTS starts quickly; remaining text uses larger chunks. */
const TTS_FIRST_CHUNK_CHARS = 2000;

function takeLeadingChunk(text: string, maxLen: number): [string, string] {
  const t = text.trim();
  if (t.length <= maxLen) return [t, ""];
  const paras = t.split(/\n\n+/);
  let acc = "";
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i]!.trim();
    if (!p) continue;
    const candidate = acc ? `${acc}\n\n${p}` : p;
    if (candidate.length > maxLen) {
      if (acc) {
        const tail = paras
          .slice(i)
          .map((x) => x.trim())
          .filter(Boolean)
          .join("\n\n");
        return [acc, tail];
      }
      return [
        p.slice(0, maxLen).trim(),
        [p.slice(maxLen), ...paras.slice(i + 1)]
          .map((x) => String(x).trim())
          .filter(Boolean)
          .join("\n\n"),
      ];
    }
    acc = candidate;
  }
  return acc ? [acc, ""] : [t, ""];
}

/** Paragraph-aware split: quick first segment, then fewer large requests. */
export function splitPlainTextForTtsWithFastStart(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const [first, rest] = takeLeadingChunk(t, TTS_FIRST_CHUNK_CHARS);
  if (!rest) return first ? [first] : [];
  const tailChunks = splitPlainTextForTts(rest, TTS_CHUNK_CHARS);
  return [first, ...tailChunks];
}

export function splitPlainTextForTts(text: string, maxLen = TTS_CHUNK_CHARS): string[] {
  const t = text.trim();
  if (t.length <= maxLen) return t ? [t] : [];

  const paras = t.split(/\n\n+/);
  const chunks: string[] = [];
  let cur = "";

  const pushCur = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };

  for (const p of paras) {
    const para = p.trim();
    if (!para) continue;

    if (para.length > maxLen) {
      pushCur();
      for (let i = 0; i < para.length; i += maxLen) {
        chunks.push(para.slice(i, i + maxLen).trim());
      }
      continue;
    }

    const joined = cur ? `${cur}\n\n${para}` : para;
    if (joined.length <= maxLen) {
      cur = joined;
    } else {
      pushCur();
      cur = para;
    }
  }
  pushCur();
  return chunks;
}
