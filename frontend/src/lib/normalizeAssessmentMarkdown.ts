/**
 * Fix common model mistakes in assessment `body_md` before split/render.
 */

/**
 * Models sometimes emit `...text.## Question 5` without a newline; markdown then treats `##` as
 * plain text. Break apart so `##`–`######` headings start their own paragraph.
 */
export function normalizeAdjacentMarkdownHeadings(md: string): string {
  let s = md.replace(/\r\n/g, "\n");
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(/([^\s\n#])(#{2,6}\s+)/g, "$1\n\n$2");
  }
  return s;
}
