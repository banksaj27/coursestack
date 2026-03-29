/** Single-line placeholder for all module kinds: full content is created in each module workspace. */
export const WEEKLY_PLAN_BODY_MD_PLACEHOLDER =
  "Content will be generated when you open this module's workspace.";

export const MODULAR_BOOTSTRAP_API_MESSAGE = `Design this entire week as an ordered sequence of modules for the timeline panel.

**Weekly Plan scope (critical):** This export is **timeline metadata only**. For **every** module, students see the real lecture notes, problem sets, quizzes, projects, and exams only after those workspaces run their generators or the instructor chat fills them. Here you output **short prose for the timeline**, not substantive curriculum in \`body_md\`.

**Per module you MUST:**
- **\`one_line_summary\`** — Exactly **one** plain sentence for the **collapsed** timeline row: a distinct hook (payoff, tension, or what students do). **Must not** repeat the opening of **\`summary\`**, echo **title**, or duplicate roadmap lists.
- **\`summary\`** — **One short paragraph only** (about **3–6 sentences**): scope, learning goals, and what this step covers—**no** enumerated section lists, no “Key concepts” blocks, no pasted \`body_md\`, no multi-part outlines.
- **\`body_md\`** — Use **exactly** this single line for **every** module (all kinds), verbatim: \`${WEEKLY_PLAN_BODY_MD_PLACEHOLDER}\`  
  Do **not** add headings, problems, quiz questions, project files, lecture notes, or any other substantive text to \`body_md\`.

Requirements:
1. Include multiple **lecture** modules that together cover this week’s syllabus topics at appropriate depth (titles + summaries describe the split; **no** long stubs in \`body_md\`).
2. Add at least one **problem_set** module. Set **assessment_total_points** to **10**. You may use **empty** \`graded_item_points\` []; per-problem weights are set when the problem set is written in the workspace.
3. Add at least one **quiz** module. Use **assessment_total_points** **20**; **graded_item_points** may be **[]** until quiz content exists in the workspace.
4. Include **at least one** \`project\` module when **GLOBAL FORMAT** rules require a weekly project (or similar). Otherwise add a **project** or short mini-lab when the topic fits; if global rules explicitly demand a project every week, **never** omit it.
5. Order modules as they would run across the week (earlier first). Unique snake_case **id** per module.
6. Fill **instructor_notes_md** for whole-week pacing and links between modules.
7. **Exam weeks:** If the selected week's syllabus JSON has \`"assessment": "midterm"\` or \`"assessment": "final"\`, the **last** module in \`modules\` **must** be **kind** \`exam\`—identified in **title** / **summary** as the midterm or final; use **assessment_total_points** **100** and **graded_item_points** \`[]\` or planned totals only. \`body_md\` remains the **same one-line placeholder** as other modules. No module may appear after it. When \`assessment\` is null, do **not** add an \`exam\` module.

Do **not** put substantive assessment or lecture content in \`body_md\` in this weekly export.`;

export const MODULAR_BOOTSTRAP_DISPLAY =
  "Building the weekly module timeline (lectures, project, problems, quiz)…";

/** User clicked Apply on global format rules — refresh modules for current week. */
export const APPLY_GLOBAL_FORMAT_MODULAR_API_MESSAGE = `Global format rules were just applied. Rebuild **all modules** for this week to match that house style (titles, tone, pacing). Keep syllabus topics and pedagogical intent.

**Weekly Plan scope:** Each module’s **\`body_md\`** must be **only** this exact one-line placeholder (verbatim for every kind): \`${WEEKLY_PLAN_BODY_MD_PLACEHOLDER}\`  
**\`summary\`** must stay **one short paragraph** (3–6 sentences)—scope and intent only, **no** section lists or full outlines. **\`one_line_summary\`** stays one distinct sentence for the collapsed row (must not duplicate **\`summary\`**’s opening).

**Enforce the global rules on the module list:** If the rules say **at least one project per week**, include **≥1** \`kind: project\` module. If they cap quizzes (e.g. one quiz per week), match that count. Do not ignore structural requirements from those rules.

If this week's syllabus has \`assessment\` **midterm** or **final**, keep **one** \`exam\` module as the **final** item in the list (placeholder \`body_md\` only; planned **assessment_total_points** **100**). Output a full :::WEEK_MODULES_UPDATE::: block.`;
export const APPLY_GLOBAL_FORMAT_MODULAR_DISPLAY =
  "Applying current rules to this week…";
