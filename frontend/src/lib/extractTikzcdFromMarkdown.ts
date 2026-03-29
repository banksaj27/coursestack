/**
 * KaTeX (rehype-katex) does not support TikZ or tikz-cd; those blocks render as errors.
 * Move display-math segments that contain a tikzcd environment into fenced ```tikzcd blocks
 * so MarkdownMath can render them with TikZJax instead of KaTeX.
 */
export function extractTikzcdFromMarkdown(source: string): string {
  if (!source.includes("tikzcd")) {
    return source;
  }
  const chunks = source.split(/(```[\s\S]*?```)/g);
  return chunks
    .map((chunk, i) => (i % 2 === 1 ? chunk : replaceTikzcdInSegment(chunk)))
    .join("");
}

function replaceTikzcdInSegment(segment: string): string {
  return segment.replace(
    /\$\$([\s\S]*?\\begin\{tikzcd\}[\s\S]*?\\end\{tikzcd\}[\s\S]*?)\$\$/g,
    (_match, body: string) => {
      const trimmed = body.trim();
      return `\n\n\`\`\`tikzcd\n${trimmed}\n\`\`\`\n\n`;
    },
  );
}
