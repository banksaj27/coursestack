"use client";

import { useMemo, useState } from "react";
import type {
  AssessmentQuizItem,
  WeekModule,
} from "@/types/weekModular";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import {
  gradeQuizOrExamAssessment,
  type AssessmentGradeItem,
} from "@/lib/assessmentGradeApi";
import {
  effectiveAssessmentTotalPoints,
  pointsForPage,
} from "@/lib/gradedAssessmentDefaults";
import {
  extractAssessmentCorrectForReview,
  extractSampleAnswerExcerpt,
} from "@/lib/extractAssessmentCorrectForReview";
import { normalizeAdjacentMarkdownHeadings } from "@/lib/normalizeAssessmentMarkdown";
import { setModuleAssessmentCompletion } from "@/lib/moduleAssessmentCompletion";
import { splitMarkdownIntoH2Pages } from "@/lib/splitMarkdownByH2";
import { stripAnswerSpoilersForTesting } from "@/lib/stripAnswerSpoilersForTesting";
import { stripProblemSetDisplayPreamble } from "@/lib/stripProblemSetDisplayPreamble";
import {
  isInstructionBlock,
  parseQuestionBlock,
  splitPageIntoQuestionBlocks,
  type ParsedQuestion,
} from "@/lib/parseAssessmentQuestions";

export type GradedPanelMode = "testing" | "review";

type Props = {
  week: number;
  moduleId: string;
  module: WeekModule;
  /** Used to choose server autograding for quiz/exam vs local full credit for problem sets. */
  moduleKind: WeekModule["kind"];
  courseTopic?: string;
  onExit: () => void;
  mode?: GradedPanelMode;
  /** Review mode: saved responses from last submit. */
  initialAnswers?: Record<string, string>;
  /** Review mode: show recorded score in header. */
  savedScore?: { score: number; maxScore: number };
  /** Review mode: per-question breakdown from server grading. */
  gradeItems?: AssessmentGradeItem[];
};

function answerKey(pageIdx: number, blockIdx: number) {
  return `${pageIdx}-${blockIdx}`;
}

/** MC option line: LaTeX + markdown for answer text (stem already uses MarkdownMath). */
function MultipleChoiceOptionBody({
  label,
  text,
  variant,
  className = "",
}: {
  label: string;
  text: string;
  variant: "light" | "dark";
  className?: string;
}) {
  const src = `**${label}.** ${text}`.trim();
  return (
    <MarkdownMath
      source={src}
      variant={variant}
      uniformScale
      className={`max-w-none [&_p]:mb-0 ${className}`}
    />
  );
}

/** Keep long grader notes readable; trim only extreme cases. */
function formatReviewNote(note: string): string {
  const t = note.trim();
  if (!t) return "";
  const cap = 2200;
  if (t.length <= cap) return t;
  const slice = t.slice(0, cap);
  const end = Math.max(
    slice.lastIndexOf("."),
    slice.lastIndexOf("!"),
    slice.lastIndexOf("?"),
  );
  if (end >= 160) return `${slice.slice(0, end + 1)} …`;
  return `${slice.trim()}…`;
}

function buildMcAnswerKeyMarkdown(
  parsed: ParsedQuestion,
  rawBlockMd: string,
): string | null {
  if (parsed.kind !== "multiple_choice") return null;
  const hints = extractAssessmentCorrectForReview(rawBlockMd, "multiple_choice");
  if (!hints || hints.kind !== "mc" || hints.letters.size === 0) return null;
  const parts: string[] = [];
  for (const letter of [...hints.letters].sort()) {
    const opt = parsed.options.find((o) => o.id === letter);
    const body = opt?.text?.trim() ?? "";
    parts.push(body ? `**(${letter})** ${body}` : `**(${letter})**`);
  }
  return parts.join("\n\n");
}

function ReviewRubricSection({
  reviewItem,
  parsed,
  rawBlockMd,
}: {
  reviewItem: AssessmentGradeItem;
  parsed: ParsedQuestion;
  rawBlockMd: string;
}) {
  const noteMd = formatReviewNote(reviewItem.note);
  const mcKeyMd = useMemo(
    () => buildMcAnswerKeyMarkdown(parsed, rawBlockMd),
    [parsed, rawBlockMd],
  );
  const sampleMd = useMemo(() => {
    if (parsed.kind !== "short_answer") return "";
    return extractSampleAnswerExcerpt(rawBlockMd);
  }, [parsed, rawBlockMd]);

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
        Score · {reviewItem.earned}/{reviewItem.max} pts
      </p>
      {noteMd ? (
        <MarkdownMath
          source={noteMd}
          variant="light"
          uniformScale
          className="max-w-none text-sm leading-relaxed text-slate-800 prose-neutral [&_p]:mb-2 [&_p:last-child]:mb-0"
        />
      ) : (
        <p className="text-sm text-slate-600">
          {reviewItem.earned >= reviewItem.max - 0.001
            ? "Full credit."
            : "No written feedback was returned for this item."}
        </p>
      )}
      {mcKeyMd ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Correct option(s)
          </p>
          <MarkdownMath
            source={mcKeyMd}
            variant="light"
            uniformScale
            className="max-w-none text-sm prose-neutral [&_p]:mb-1"
          />
        </div>
      ) : null}
      {sampleMd ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Reference answer
          </p>
          <MarkdownMath
            source={sampleMd}
            variant="light"
            uniformScale
            className="max-w-none text-sm prose-neutral [&_p]:mb-1"
          />
        </div>
      ) : null}
    </div>
  );
}

function QuestionInteraction({
  parsed,
  value,
  onChange,
  readOnly,
  reviewItem,
  rawBlockMd,
}: {
  parsed: ParsedQuestion;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  /** Server-graded row for this question (review mode). */
  reviewItem?: AssessmentGradeItem | null;
  /** Unstripped block from `module.body_md` (review only) — used to find correct MC / T–F key. */
  rawBlockMd?: string;
}) {
  if (parsed.kind === "prose") {
    return null;
  }

  if (parsed.kind === "short_answer") {
    return (
      <div className="mt-4">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Your answer
        </label>
        <textarea
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          placeholder={readOnly ? "" : "Type your answer…"}
          rows={5}
          className={`w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 ${
            readOnly
              ? "cursor-default bg-neutral-100/90 text-neutral-800"
              : "bg-neutral-50/50"
          }`}
        />
        {readOnly && reviewItem ? (
          <ReviewRubricSection
            reviewItem={reviewItem}
            parsed={parsed}
            rawBlockMd={rawBlockMd ?? ""}
          />
        ) : null}
      </div>
    );
  }

  if (parsed.kind === "true_false") {
    if (readOnly) {
      const hints = rawBlockMd
        ? extractAssessmentCorrectForReview(rawBlockMd, "true_false")
        : null;
      const correctTf = hints?.kind === "tf" ? hints.value : null;
      return (
        <div className="mt-4 space-y-2">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Your attempt
          </p>
          {(["True", "False"] as const).map((opt) => {
            const selected = value === opt;
            const isCorrect = correctTf === opt;
            return (
              <div
                key={opt}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  isCorrect
                    ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
                    : selected
                      ? "border-slate-400 bg-slate-100/90 text-slate-900"
                      : "border-neutral-100 bg-neutral-50/50 text-neutral-500"
                }`}
              >
                {isCorrect ? (
                  <span
                    className="text-emerald-600"
                    aria-label="Correct answer"
                    title="Correct answer"
                  >
                    ✓
                  </span>
                ) : selected ? (
                  <span className="text-slate-600" title="Your answer">
                    ●
                  </span>
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span>{opt}</span>
              </div>
            );
          })}
          {reviewItem ? (
            <ReviewRubricSection
              reviewItem={reviewItem}
              parsed={parsed}
              rawBlockMd={rawBlockMd ?? ""}
            />
          ) : null}
        </div>
      );
    }
    return (
      <div
        role="radiogroup"
        aria-label="True or false"
        className="mt-4 space-y-2"
      >
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Select True or False
        </p>
        {(["True", "False"] as const).map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selected
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 text-[10px] ${
                  selected
                    ? "border-white bg-white text-neutral-900"
                    : "border-neutral-300 bg-white"
                }`}
                aria-hidden
              >
                {selected ? "✓" : ""}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (readOnly) {
    if (parsed.kind !== "multiple_choice") return null;
    const hints = rawBlockMd
      ? extractAssessmentCorrectForReview(rawBlockMd, "multiple_choice")
      : null;
    const correctLetters = hints?.kind === "mc" ? hints.letters : null;
    return (
      <div className="mt-4 space-y-2">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Your attempt
        </p>
        {parsed.options.map((o) => {
          const selected = value === o.id;
          const isCorrect = correctLetters?.has(o.id) ?? false;
          return (
            <div
              key={o.id}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                isCorrect
                  ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
                  : selected
                    ? "border-slate-400 bg-slate-100/90 text-slate-900"
                    : "border-neutral-100 bg-neutral-50/50 text-neutral-500"
              }`}
            >
              {isCorrect ? (
                <span
                  className="mt-0.5 shrink-0 text-emerald-600"
                  aria-label="Correct answer"
                  title="Correct answer"
                >
                  ✓
                </span>
              ) : selected ? (
                <span
                  className="mt-0.5 w-4 shrink-0 text-slate-600"
                  title="Your answer"
                >
                  ●
                </span>
              ) : (
                <span className="mt-0.5 w-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1 [&_.katex]:text-[0.95em]">
                <MultipleChoiceOptionBody
                  label={o.label}
                  text={o.text}
                  variant="light"
                  className={
                    isCorrect
                      ? "prose-neutral"
                      : selected
                        ? "prose-neutral"
                        : "[&_p]:text-neutral-500 [&_strong]:text-neutral-600 [&_.katex]:text-neutral-500"
                  }
                />
              </div>
            </div>
          );
        })}
        {reviewItem ? (
          <ReviewRubricSection
            reviewItem={reviewItem}
            parsed={parsed}
            rawBlockMd={rawBlockMd ?? ""}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Multiple choice"
      className="mt-4 space-y-2"
    >
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Select one answer
      </p>
      {parsed.options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              selected
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 text-[10px] ${
                selected
                  ? "border-white bg-white text-neutral-900"
                  : "border-neutral-300 bg-white"
              }`}
              aria-hidden
            >
              {selected ? "✓" : ""}
            </span>
            <div className="min-w-0 flex-1 [&_.katex]:text-[0.95em]">
              <MultipleChoiceOptionBody
                label={o.label}
                text={o.text}
                variant={selected ? "dark" : "light"}
                className={selected ? "" : "prose-neutral"}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function structuredItemKey(item: AssessmentQuizItem, index: number): string {
  const id = item.id?.trim();
  return id && id.length > 0 ? id : `q${index + 1}`;
}

function pointsForStructuredItem(
  module: WeekModule,
  index: number,
  n: number,
  item: AssessmentQuizItem,
): number {
  if (item.points != null && item.points > 0) return item.points;
  const gip = module.graded_item_points;
  if (gip && gip[index] != null && gip[index]! > 0) return gip[index]!;
  const total = effectiveAssessmentTotalPoints(module);
  return n > 0 ? total / n : total;
}

function mcCorrectLettersFromItem(item: AssessmentQuizItem): Set<string> {
  const valid = new Set(
    item.choices
      .map((c) => (c.id || "A").trim().toUpperCase().charAt(0))
      .filter((x) => /[A-Z]/.test(x)),
  );
  const out = new Set<string>();
  const raw = (item.correct_answer || "").trim().toUpperCase();
  for (const m of raw.matchAll(/\b([A-Z])\b/g)) {
    const L = m[1];
    if (valid.has(L)) out.add(L);
  }
  if (out.size === 0 && raw.length === 1 && valid.has(raw)) out.add(raw);
  return out;
}

function tfCorrectFromItem(item: AssessmentQuizItem): "True" | "False" | null {
  const t = (item.correct_answer || "").trim().toLowerCase();
  if (t === "true" || t === "t") return "True";
  if (t === "false" || t === "f") return "False";
  return null;
}

function buildStructuredMcKeyMd(item: AssessmentQuizItem): string | null {
  if (item.kind !== "multiple_choice") return null;
  const letters = mcCorrectLettersFromItem(item);
  if (letters.size === 0) return null;
  const parts: string[] = [];
  for (const letter of [...letters].sort()) {
    const opt = item.choices.find(
      (c) => (c.id || "").trim().toUpperCase().charAt(0) === letter,
    );
    const body = (opt?.text_md ?? "").trim();
    parts.push(body ? `**(${letter})** ${body}` : `**(${letter})**`);
  }
  return parts.join("\n\n");
}

function StructuredReviewRubric({
  item,
  reviewItem,
}: {
  item: AssessmentQuizItem;
  reviewItem: AssessmentGradeItem;
}) {
  const noteMd = formatReviewNote(reviewItem.note);
  const mcKeyMd =
    item.kind === "multiple_choice" ? buildStructuredMcKeyMd(item) : null;
  const sampleMd =
    item.kind === "short_answer" && (item.correct_answer || "").trim()
      ? item.correct_answer.trim()
      : "";

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
        Score · {reviewItem.earned}/{reviewItem.max} pts
      </p>
      {noteMd ? (
        <MarkdownMath
          source={noteMd}
          variant="light"
          uniformScale
          className="max-w-none text-sm leading-relaxed text-slate-800 prose-neutral [&_p]:mb-2 [&_p:last-child]:mb-0"
        />
      ) : (
        <p className="text-sm text-slate-600">
          {reviewItem.earned >= reviewItem.max - 0.001
            ? "Full credit."
            : "No written feedback was returned for this item."}
        </p>
      )}
      {mcKeyMd ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Correct option(s)
          </p>
          <MarkdownMath
            source={mcKeyMd}
            variant="light"
            uniformScale
            className="max-w-none text-sm prose-neutral [&_p]:mb-1"
          />
        </div>
      ) : null}
      {sampleMd ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Reference answer
          </p>
          <MarkdownMath
            source={sampleMd}
            variant="light"
            uniformScale
            className="max-w-none text-sm prose-neutral [&_p]:mb-1"
          />
        </div>
      ) : null}
    </div>
  );
}

function StructuredItemInteraction({
  item,
  value,
  onChange,
  readOnly,
  reviewItem,
}: {
  item: AssessmentQuizItem;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  reviewItem?: AssessmentGradeItem | null;
}) {
  const kind = item.kind;

  if (kind === "short_answer" || !kind) {
    return (
      <div className="mt-4">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Your answer
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          rows={6}
          className={`w-full rounded-lg border px-3 py-2 text-sm ${
            readOnly
              ? "cursor-default border-neutral-200 bg-neutral-50/80 text-neutral-800"
              : "border-neutral-200 bg-white text-neutral-900 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
          }`}
        />
        {readOnly && reviewItem ? (
          <StructuredReviewRubric item={item} reviewItem={reviewItem} />
        ) : null}
      </div>
    );
  }

  if (kind === "true_false") {
    if (readOnly) {
      const correctTf = tfCorrectFromItem(item);
      return (
        <div className="mt-4 space-y-2">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Your attempt
          </p>
          {(["True", "False"] as const).map((opt) => {
            const selected = value === opt;
            const isCorrect = correctTf === opt;
            return (
              <div
                key={opt}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  isCorrect
                    ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
                    : selected
                      ? "border-slate-400 bg-slate-100/90 text-slate-900"
                      : "border-neutral-100 bg-neutral-50/50 text-neutral-500"
                }`}
              >
                {isCorrect ? (
                  <span
                    className="text-emerald-600"
                    aria-label="Correct answer"
                    title="Correct answer"
                  >
                    ✓
                  </span>
                ) : selected ? (
                  <span className="text-slate-600" title="Your answer">
                    ●
                  </span>
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span>{opt}</span>
              </div>
            );
          })}
          {reviewItem ? (
            <StructuredReviewRubric item={item} reviewItem={reviewItem} />
          ) : null}
        </div>
      );
    }
    return (
      <div
        role="radiogroup"
        aria-label="True or false"
        className="mt-4 space-y-2"
      >
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Select True or False
        </p>
        {(["True", "False"] as const).map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selected
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 text-[10px] ${
                  selected
                    ? "border-white bg-white text-neutral-900"
                    : "border-neutral-300 bg-white"
                }`}
                aria-hidden
              >
                {selected ? "✓" : ""}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (kind === "multiple_choice") {
    const opts = item.choices.length
      ? item.choices.map((c) => ({
          id: (c.id || "A").trim().toUpperCase().charAt(0) || "A",
          label: (c.id || "A").trim().toUpperCase().charAt(0) || "A",
          text: c.text_md,
        }))
      : [];

    if (readOnly) {
      const correctLetters = mcCorrectLettersFromItem(item);
      return (
        <div className="mt-4 space-y-2">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Your attempt
          </p>
          {opts.map((o) => {
            const selected = value === o.id;
            const isCorrect = correctLetters.has(o.id);
            return (
              <div
                key={o.id}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  isCorrect
                    ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
                    : selected
                      ? "border-slate-400 bg-slate-100/90 text-slate-900"
                      : "border-neutral-100 bg-neutral-50/50 text-neutral-500"
                }`}
              >
                {isCorrect ? (
                  <span
                    className="mt-0.5 shrink-0 text-emerald-600"
                    aria-label="Correct answer"
                    title="Correct answer"
                  >
                    ✓
                  </span>
                ) : selected ? (
                  <span
                    className="mt-0.5 w-4 shrink-0 text-slate-600"
                    title="Your answer"
                  >
                    ●
                  </span>
                ) : (
                  <span className="mt-0.5 w-4 shrink-0" />
                )}
                <div className="min-w-0 flex-1 [&_.katex]:text-[0.95em]">
                  <MultipleChoiceOptionBody
                    label={o.label}
                    text={o.text}
                    variant="light"
                    className={
                      isCorrect
                        ? "prose-neutral"
                        : selected
                          ? "prose-neutral"
                          : "[&_p]:text-neutral-500 [&_strong]:text-neutral-600 [&_.katex]:text-neutral-500"
                    }
                  />
                </div>
              </div>
            );
          })}
          {reviewItem ? (
            <StructuredReviewRubric item={item} reviewItem={reviewItem} />
          ) : null}
        </div>
      );
    }

    return (
      <div
        role="radiogroup"
        aria-label="Multiple choice"
        className="mt-4 space-y-2"
      >
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Select one answer
        </p>
        {opts.map((o) => {
          const selected = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.id)}
              className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selected
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 text-[10px] ${
                  selected
                    ? "border-white bg-white text-neutral-900"
                    : "border-neutral-300 bg-white"
                }`}
                aria-hidden
              >
                {selected ? "✓" : ""}
              </span>
              <div className="min-w-0 flex-1 [&_.katex]:text-[0.95em]">
                <MultipleChoiceOptionBody
                  label={o.label}
                  text={o.text}
                  variant={selected ? "dark" : "light"}
                  className={selected ? "" : "prose-neutral"}
                />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return null;
}

function StructuredGradedTestingModePanel({
  week,
  moduleId,
  module,
  moduleKind,
  courseTopic = "",
  onExit,
  mode = "testing",
  initialAnswers = {},
  savedScore,
  gradeItems,
}: Props) {
  const isReview = mode === "review";
  const items = module.assessment_items ?? [];
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const answers = isReview ? initialAnswers : draftAnswers;
  const setAnswer = (k: string, v: string) => {
    if (isReview) return;
    setDraftAnswers((prev) => ({ ...prev, [k]: v }));
  };

  const totalPts = effectiveAssessmentTotalPoints(module);
  const usesServerGrading =
    moduleKind === "quiz" || moduleKind === "exam";

  const itemsByKey = useMemo(() => {
    const m: Record<string, AssessmentGradeItem> = {};
    for (const it of gradeItems ?? []) {
      m[it.key] = it;
    }
    return m;
  }, [gradeItems]);

  const sectionGradeTotals = useMemo(() => {
    if (!gradeItems?.length) return null;
    let earned = 0;
    let max = 0;
    for (const it of gradeItems) {
      earned += it.earned;
      max += it.max;
    }
    return max > 0 ? { earned, max } : null;
  }, [gradeItems]);

  const introMd = stripAnswerSpoilersForTesting(module.body_md);

  const submit = () => {
    if (usesServerGrading) {
      setGradeError(null);
      setSubmitting(true);
      void (async () => {
        try {
          const kind = moduleKind === "exam" ? "exam" : "quiz";
          const result = await gradeQuizOrExamAssessment({
            kind,
            title: module.title ?? "",
            course_topic: courseTopic,
            body_md: module.body_md ?? "",
            answers: draftAnswers,
            assessment_total_points: module.assessment_total_points ?? null,
            graded_item_points: module.graded_item_points ?? [],
            assessment_items: module.assessment_items,
          });
          setModuleAssessmentCompletion(
            week,
            moduleId,
            result.score,
            result.max_score,
            draftAnswers,
            result.items,
          );
          onExit();
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "Could not grade this attempt.";
          setGradeError(msg);
        } finally {
          setSubmitting(false);
        }
      })();
      return;
    }
    setModuleAssessmentCompletion(week, moduleId, totalPts, totalPts, draftAnswers);
    onExit();
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-white">
      <div
        className={`shrink-0 border-b px-6 py-3 ${
          isReview
            ? "border-slate-200 bg-slate-50/95"
            : "border-amber-200 bg-amber-50/90"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                isReview ? "text-slate-700" : "text-amber-900/80"
              }`}
            >
              {isReview ? "Review your attempt" : "Testing mode"}
            </p>
            <p
              className={`mt-0.5 text-xs ${
                isReview ? "text-slate-800" : "text-amber-950/80"
              }`}
            >
              {isReview
                ? savedScore
                  ? `Recorded score: ${savedScore.score}/${savedScore.maxScore}. Green ✓ marks the correct choice where the answer key is available; ● is your selection.`
                  : "Your saved answers are shown below."
                : "Chat and edits are hidden until you exit. Answer each question below, then submit."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onExit()}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm ${
              isReview
                ? "border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
                : "border-amber-300 bg-white text-amber-950 hover:bg-amber-100/80"
            }`}
          >
            {isReview ? "Back to assignment" : "Exit testing mode"}
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-neutral-100 px-8 py-2">
        <p className="text-xs text-neutral-600">
          <span className="font-medium text-neutral-900">{module.title}</span>
          <span className="text-neutral-400"> · </span>
          {items.length} question{items.length === 1 ? "" : "s"}
          <span className="text-neutral-400"> · </span>
          {isReview && sectionGradeTotals
            ? `Score: ${sectionGradeTotals.earned.toFixed(1)}/${sectionGradeTotals.max.toFixed(1)} pts · Total ${totalPts} pts`
            : `Total ${totalPts} pts`}
        </p>
      </div>

      {gradeError ? (
        <div className="shrink-0 border-b border-rose-100 bg-rose-50/95 px-8 py-2">
          <p className="text-xs text-rose-800">{gradeError}</p>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl space-y-10">
          {introMd.trim().length > 0 ? (
            <div className="border-b border-neutral-100 pb-10">
              <MarkdownMath
                source={introMd}
                variant="light"
                uniformScale
                className="prose-neutral max-w-none"
              />
            </div>
          ) : null}
          {items.map((item, idx) => {
            const k = structuredItemKey(item, idx);
            const pts = pointsForStructuredItem(module, idx, items.length, item);
            const val = answers[k] ?? "";
            const reviewItem = isReview ? itemsByKey[k] ?? null : null;
            return (
              <div
                key={k}
                className="border-b border-neutral-100 pb-10 last:border-b-0 last:pb-0"
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Question {idx + 1} · {pts.toFixed(1)} pts
                </p>
                {item.question_md.trim().length > 0 ? (
                  <MarkdownMath
                    source={item.question_md}
                    variant="light"
                    uniformScale
                    className="prose-neutral max-w-none"
                  />
                ) : null}
                <StructuredItemInteraction
                  item={item}
                  value={val}
                  onChange={(v) => setAnswer(k, v)}
                  readOnly={isReview}
                  reviewItem={reviewItem}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-neutral-100 bg-white px-8 py-4">
        <div className="flex max-w-3xl flex-wrap items-center justify-end gap-3">
          {isReview ? (
            <button
              type="button"
              onClick={() => onExit()}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
            >
              Back to assignment
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Grading…"
                : usesServerGrading
                  ? "Submit for grading"
                  : `Submit and record (${totalPts}/${totalPts} pts)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GradedTestingModePanel(props: Props) {
  const n = props.module.assessment_items?.length ?? 0;
  if (
    (props.moduleKind === "quiz" || props.moduleKind === "exam") &&
    n > 0
  ) {
    return <StructuredGradedTestingModePanel {...props} />;
  }
  return <GradedTestingModePanelMarkdown {...props} />;
}

function GradedTestingModePanelMarkdown({
  week,
  moduleId,
  module,
  moduleKind,
  courseTopic = "",
  onExit,
  mode = "testing",
  initialAnswers = {},
  savedScore,
  gradeItems,
}: Props) {
  const isReview = mode === "review";
  const displayBodyMd = useMemo(() => {
    let raw = module.body_md;
    if (module.kind === "problem_set") {
      raw = stripProblemSetDisplayPreamble(raw);
    }
    if (isReview) return raw;
    return stripAnswerSpoilersForTesting(raw);
  }, [isReview, module.body_md, module.kind]);

  const pages = useMemo(() => {
    const p = splitMarkdownIntoH2Pages(displayBodyMd);
    if (p.length) return p;
    const t = displayBodyMd.trim();
    return t ? [t] : [""];
  }, [displayBodyMd]);
  const [idx, setIdx] = useState(0);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const answers = isReview ? initialAnswers : draftAnswers;
  const setAnswer = (k: string, v: string) => {
    if (isReview) return;
    setDraftAnswers((prev) => ({ ...prev, [k]: v }));
  };

  const totalPts = effectiveAssessmentTotalPoints(module);
  const n = Math.max(pages.length, 1);
  const multiPage = pages.length > 1;
  const safeIdx = Math.min(idx, n - 1);
  const pagePts = pointsForPage(module, safeIdx, pages.length);

  const questionBlocks = useMemo(() => {
    const page = pages[safeIdx] ?? "";
    return splitPageIntoQuestionBlocks(page);
  }, [pages, safeIdx]);

  const rawQuestionBlocks = useMemo(() => {
    const rawPages = splitMarkdownIntoH2Pages(
      normalizeAdjacentMarkdownHeadings(module.body_md),
    );
    const rawPage = rawPages[safeIdx] ?? "";
    return splitPageIntoQuestionBlocks(rawPage);
  }, [module.body_md, safeIdx]);

  const itemsByKey = useMemo(() => {
    const m: Record<string, AssessmentGradeItem> = {};
    for (const it of gradeItems ?? []) {
      m[it.key] = it;
    }
    return m;
  }, [gradeItems]);

  const sectionGradeTotals = useMemo(() => {
    if (!gradeItems?.length) return null;
    let earned = 0;
    let max = 0;
    const prefix = `${safeIdx}-`;
    for (const it of gradeItems) {
      if (it.key.startsWith(prefix)) {
        earned += it.earned;
        max += it.max;
      }
    }
    if (max <= 0) return null;
    return { earned, max };
  }, [gradeItems, safeIdx]);

  const usesServerGrading =
    moduleKind === "quiz" || moduleKind === "exam";

  const submit = () => {
    if (usesServerGrading) {
      setGradeError(null);
      setSubmitting(true);
      void (async () => {
        try {
          const kind = moduleKind === "exam" ? "exam" : "quiz";
          const result = await gradeQuizOrExamAssessment({
            kind,
            title: module.title ?? "",
            course_topic: courseTopic,
            body_md: module.body_md,
            answers: draftAnswers,
            assessment_total_points: module.assessment_total_points ?? null,
            graded_item_points: module.graded_item_points ?? [],
          });
          setModuleAssessmentCompletion(
            week,
            moduleId,
            result.score,
            result.max_score,
            draftAnswers,
            result.items,
          );
          onExit();
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "Could not grade this attempt.";
          setGradeError(msg);
        } finally {
          setSubmitting(false);
        }
      })();
      return;
    }
    setModuleAssessmentCompletion(week, moduleId, totalPts, totalPts, draftAnswers);
    onExit();
  };

  const bodyPage = pages[safeIdx] ?? "";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-white">
      <div
        className={`shrink-0 border-b px-6 py-3 ${
          isReview
            ? "border-slate-200 bg-slate-50/95"
            : "border-amber-200 bg-amber-50/90"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                isReview ? "text-slate-700" : "text-amber-900/80"
              }`}
            >
              {isReview ? "Review your attempt" : "Testing mode"}
            </p>
            <p
              className={`mt-0.5 text-xs ${
                isReview ? "text-slate-800" : "text-amber-950/80"
              }`}
            >
              {isReview
                ? savedScore
                  ? `Recorded score: ${savedScore.score}/${savedScore.maxScore}. Green ✓ marks the correct choice where the answer key is available; ● is your selection.`
                  : "Your saved answers are shown below."
                : multiPage
                  ? "Chat and edits are hidden until you exit. Answer each question below; use Next section when you are ready."
                  : "Chat and edits are hidden until you exit. Answer each question below, then submit."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onExit()}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm ${
              isReview
                ? "border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
                : "border-amber-300 bg-white text-amber-950 hover:bg-amber-100/80"
            }`}
          >
            {isReview ? "Back to assignment" : "Exit testing mode"}
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-neutral-100 px-8 py-2">
        <p className="text-xs text-neutral-600">
          <span className="font-medium text-neutral-900">{module.title}</span>
          <span className="text-neutral-400"> · </span>
          Section {safeIdx + 1} of {pages.length || 1}
          <span className="text-neutral-400"> · </span>
          {isReview && sectionGradeTotals
            ? `This section: ${sectionGradeTotals.earned.toFixed(1)}/${sectionGradeTotals.max.toFixed(1)} pts · Assignment total ${totalPts} pts`
            : `${pagePts.toFixed(1)} pts (of ${totalPts} total)`}
        </p>
      </div>

      {gradeError ? (
        <div className="shrink-0 border-b border-rose-100 bg-rose-50/95 px-8 py-2">
          <p className="text-xs text-rose-800">{gradeError}</p>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl space-y-10">
          {bodyPage.trim().length === 0 ? (
            <p className="text-sm text-neutral-400">No content for this page.</p>
          ) : (
            questionBlocks.map((block, bIdx) => {
              const k = answerKey(safeIdx, bIdx);
              if (isInstructionBlock(block)) {
                return (
                  <div
                    key={k}
                    className="border-b border-neutral-100 pb-10 last:border-b-0 last:pb-0"
                  >
                    <MarkdownMath
                      source={block}
                      variant="light"
                      uniformScale
                      className="prose-neutral max-w-none"
                    />
                  </div>
                );
              }
              const parsed = parseQuestionBlock(block);
              const val = answers[k] ?? "";
              if (parsed.kind === "prose") {
                return (
                  <div
                    key={k}
                    className="border-b border-neutral-100 pb-10 last:border-b-0 last:pb-0"
                  >
                    <MarkdownMath
                      source={parsed.stemMd}
                      variant="light"
                      uniformScale
                      className="prose-neutral max-w-none"
                    />
                  </div>
                );
              }
              return (
                <div
                  key={k}
                  className="border-b border-neutral-100 pb-10 last:border-b-0 last:pb-0"
                >
                  {parsed.stemMd.trim().length > 0 ? (
                    <MarkdownMath
                      source={parsed.stemMd}
                      variant="light"
                      uniformScale
                      className="prose-neutral max-w-none"
                    />
                  ) : null}
                  <QuestionInteraction
                    parsed={parsed}
                    value={val}
                    onChange={(v) => setAnswer(k, v)}
                    readOnly={isReview}
                    reviewItem={isReview ? itemsByKey[k] ?? null : null}
                    rawBlockMd={
                      isReview ? (rawQuestionBlocks[bIdx] ?? "") : undefined
                    }
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-neutral-100 bg-white px-8 py-4">
        <div
          className={`flex max-w-3xl flex-wrap items-center gap-3 ${
            multiPage ? "justify-between" : "justify-end"
          }`}
        >
          {multiPage ? (
            <>
              <button
                type="button"
                disabled={safeIdx <= 0}
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-neutral-50"
              >
                Previous
              </button>
              {safeIdx < n - 1 ? (
                <button
                  type="button"
                  onClick={() => setIdx((i) => Math.min(n - 1, i + 1))}
                  className="rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  Next section
                </button>
              ) : isReview ? (
                <button
                  type="button"
                  onClick={() => onExit()}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
                >
                  Back to assignment
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submit}
                  className="rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Grading…"
                    : usesServerGrading
                      ? "Submit for grading"
                      : `Submit and record (${totalPts}/${totalPts} pts)`}
                </button>
              )}
            </>
          ) : isReview ? (
            <button
              type="button"
              onClick={() => onExit()}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
            >
              Back to assignment
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Grading…"
                : usesServerGrading
                  ? "Submit for grading"
                  : `Submit and record (${totalPts}/${totalPts} pts)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
