export const MODULAR_BOOTSTRAP_API_MESSAGE = `Design this entire week as an ordered sequence of modules for the timeline panel.

Requirements:
1. Include multiple **lecture** modules that together teach all topics listed for this week (real body_md: definitions, proofs/sketches, worked examples, LaTeX math).
2. Add at least one **problem_set** module with numbered problems in body_md.
3. Add at least one **quiz** module (format, coverage, sample items or blueprint in body_md).
4. Add a **project** module if it fits the course (otherwise you may omit project or use a short "mini-lab" project).
5. Order modules as they would run across the week (earlier first). Unique snake_case **id** per module.
6. Fill **instructor_notes_md** for whole-week pacing and links between modules.

Do not use placeholders—every body_md must be substantive.`;

export const MODULAR_BOOTSTRAP_DISPLAY =
  "Building the weekly module timeline (lectures, project, problems, quiz)…";

/** User clicked Apply on global format rules — refresh modules for current week. */
export const APPLY_GLOBAL_FORMAT_MODULAR_API_MESSAGE = `The instructor clicked **Apply** after setting or editing the **global format & structure rules** (those rules are also injected in your system prompt).

Rebuild **all modules** for this selected week so every lecture, project, problem_set, and quiz strictly follows that house style: headings, numbering, tone, section order, and any notation conventions described there.

Keep the same syllabus topics and pedagogical intent; rewrite module titles/summaries/body_md and instructor_notes_md as needed for consistency. Preserve a sensible module order (you may reorder slightly if the format requires it). Output a complete :::WEEK_MODULES_UPDATE::: block.`;

export const APPLY_GLOBAL_FORMAT_MODULAR_DISPLAY =
  "Applying global format rules to this week's modules…";
