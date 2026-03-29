export const MODULAR_BOOTSTRAP_API_MESSAGE = `Design this entire week as an ordered sequence of modules for the timeline panel.

**Lecture modules (non-negotiable):** Each **lecture** \`body_md\` must be **one textbook chapter** in scope: roughly **5–10 printed pages** of reading, built from **many long paragraphs** (not sparse bullets)—on the order of **~2,500–8,000+ words** of prose plus LaTeX and optional code. Use \`##\`/\`###\` sections; definitions and theorems with **proofs or proof sketches** at course rigor; **at least three** fully worked examples woven through the narrative; a substantive pitfalls/remarks section. For CS/stats/coding, include **fenced code blocks** and paragraphs of commentary. Prefer **fewer, longer** lecture modules over many thin ones when the week allows.

Requirements:
1. Include multiple **lecture** modules that together teach all topics listed for this week, at the depth above.
2. Add at least one **problem_set** module with numbered problems in body_md.
3. Add at least one **quiz** module whose body_md contains **real quiz questions**—**only multiple choice** (with options) **and/or short answer**—not a topic list or sample blueprint.
4. Add a **project** module if it fits the course (otherwise you may omit project or use a short "mini-lab" project).
5. Order modules as they would run across the week (earlier first). Unique snake_case **id** per module.
6. Fill **instructor_notes_md** for whole-week pacing and links between modules.

Do not use placeholders—every body_md must be substantive.`;

export const MODULAR_BOOTSTRAP_DISPLAY =
  "Building the weekly module timeline (lectures, project, problems, quiz)…";

/** User clicked Apply on global format rules — refresh modules for current week. */
export const APPLY_GLOBAL_FORMAT_MODULAR_API_MESSAGE = `Global format rules were just applied. Rebuild **all modules** for this week to match that house style (headings, tone, notation, section order). Keep syllabus topics and pedagogical intent; rewrite titles, summaries, body_md, and instructor_notes_md as needed.

For every **lecture**, keep **full chapter length (~5–10 pages, paragraph-dense)** plus proofs/sketches, **3+** worked examples, pitfalls, LaTeX, and code when relevant—do not collapse to summaries or thin outlines. Output a full :::WEEK_MODULES_UPDATE::: block.`;

export const APPLY_GLOBAL_FORMAT_MODULAR_DISPLAY =
  "Applying current rules to this week…";
