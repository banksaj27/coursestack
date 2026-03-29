export const MODULAR_BOOTSTRAP_API_MESSAGE = `Design this entire week as an ordered sequence of modules for the timeline panel.

**Lecture modules (non-negotiable):** Each **lecture** \`body_md\` in this weekly export is a **structured stub** (~500–2,500 words): \`##\`/\`###\` roadmap with short paragraphs or bullets saying what each section will teach (not the full chapter). **Full** textbook-style notes are generated when the instructor opens the **Lecture workspace** (multi-step pipeline). Still include LaTeX where needed, name key definitions/theorems, and sketch **at least three** example *topics* the full chapter will work through.

Requirements:
1. Include multiple **lecture** modules that together teach all topics listed for this week, at the depth above.
2. Add at least one **problem_set** module with numbered problems in body_md. Set **assessment_total_points** to **10** and **graded_item_points** so the values sum to 10 (one entry per problem).
3. Add at least one **quiz** module whose body_md contains **real quiz questions**—**only multiple choice** (with options) **and/or short answer**—not a topic list or sample blueprint. Use **assessment_total_points** **20** and **graded_item_points** summing to 20.
4. Include **at least one** \`project\` module when **GLOBAL FORMAT** rules require a weekly project (or similar). Otherwise add a **project** or short mini-lab when the topic fits; if global rules explicitly demand a project every week, **never** omit it.
5. Order modules as they would run across the week (earlier first). Unique snake_case **id** per module.
6. Every module needs **two** timeline strings: **\`one_line_summary\`** — **one** plain sentence for the **collapsed** timeline row (a distinct hook: payoff, tension, or what students do)—**must not** repeat the opening of **\`summary\`** or duplicate **title**; and **\`summary\`** — **~one paragraph** (about **4–10 sentences**) for the **expanded** timeline panel only. For **lecture** modules, **\`summary\`** must **list the major \`##\`/\`###\` section titles in order** (matching \`body_md\`) and summarize scope; after **Sections include:** (or similar), use **lowercase** section labels separated by **commas** (not semicolons, not Title Case for that list). For **problem_set**, **quiz**, **exam**, and **project**, **\`summary\`** covers structure and what students do—without pasting full \`body_md\`.
7. Fill **instructor_notes_md** for whole-week pacing and links between modules.
8. **Exam weeks:** If the selected week's syllabus JSON has \`"assessment": "midterm"\` or \`"assessment": "final"\`, the **last** module in \`modules\` **must** be **kind** \`exam\`—a full **midterm** or **final** handout (instructions, coverage, timing, integrity; **only** multiple-choice with options and/or short-answer items, all complete and gradable—like a longer quiz). Use **assessment_total_points** **100** and **graded_item_points** summing to 100. No module may appear after it. When \`assessment\` is null, do **not** add an \`exam\` module.

Do not use placeholders—every body_md must be substantive.`;

export const MODULAR_BOOTSTRAP_DISPLAY =
  "Building the weekly module timeline (lectures, project, problems, quiz)…";

/** User clicked Apply on global format rules — refresh modules for current week. */
export const APPLY_GLOBAL_FORMAT_MODULAR_API_MESSAGE = `Global format rules were just applied. Rebuild **all modules** for this week to match that house style (headings, tone, notation, section order). Keep syllabus topics and pedagogical intent; rewrite titles, **\`one_line_summary\`**, **\`summary\`**, body_md, and instructor_notes_md as needed.

**Enforce the global rules on the module list:** If the rules say **at least one project per week**, include **≥1** \`kind: project\` module. If they cap quizzes (e.g. one quiz per week), match that count. Do not ignore structural requirements from those rules.

For every **lecture**, keep a **substantial stub** (roadmap + goals per section, ~500–2,500 words)—not a bare outline, but not the full chapter (that expands in Lecture workspace). Refresh **\`one_line_summary\`** (one sentence, collapsed row, distinct from **\`summary\`**'s opening) and **\`summary\`** (**~one paragraph** for the expanded panel); for lectures, **\`summary\`** must **enumerate major \`##\`/\`###\` section titles in reading order** with **lowercase** comma-separated labels after **Sections include:** (no semicolons, no Title Case in that list). If this week's syllabus has \`assessment\` **midterm** or **final**, keep **one** \`exam\` module as the **final** item in the list. Output a full :::WEEK_MODULES_UPDATE::: block.`;
export const APPLY_GLOBAL_FORMAT_MODULAR_DISPLAY =
  "Applying current rules to this week…";
