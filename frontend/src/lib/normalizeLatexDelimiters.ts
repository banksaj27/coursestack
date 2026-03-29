/**
 * remark-math only understands $ / $$ by default; models often emit \( \) and \[ \].
 * Convert those to $ / $$ outside fenced ``` code blocks so KaTeX can run.
 */
function transformMathDelimiters(segment: string): string {
  let s = segment;
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, body: string) => {
    const t = body.trim();
    return `\n$$\n${t}\n$$\n`;
  });
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_, body: string) => {
    const t = body.trim();
    return `$${t}$`;
  });
  return s;
}

export function normalizeLatexDelimiters(source: string): string {
  if (!source.includes("\\(") && !source.includes("\\[")) {
    return source;
  }
  const chunks = source.split(/(```[\s\S]*?```)/g);
  return chunks
    .map((chunk, i) => (i % 2 === 1 ? chunk : transformMathDelimiters(chunk)))
    .join("");
}
