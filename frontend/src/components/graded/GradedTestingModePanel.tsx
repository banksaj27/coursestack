"use client";

import { useMemo, useState } from "react";
import type { WeekModule } from "@/types/weekModular";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import {
  effectiveAssessmentTotalPoints,
  pointsForPage,
} from "@/lib/gradedAssessmentDefaults";
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
  onExit: () => void;
  mode?: GradedPanelMode;
  /** Review mode: saved responses from last submit. */
  initialAnswers?: Record<string, string>;
  /** Review mode: show recorded score in header. */
  savedScore?: { score: number; maxScore: number };
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

function QuestionInteraction({
  qKey,
  parsed,
  value,
  onChange,
  readOnly,
}: {
  qKey: string;
  parsed: ParsedQuestion;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
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
      </div>
    );
  }

  if (parsed.kind === "true_false") {
    return (
      <div
        role="radiogroup"
        aria-label={readOnly ? "Your selection" : "True or false"}
        className="mt-4 space-y-2"
      >
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          {readOnly ? "Your selection" : "Select True or False"}
        </p>
        {(["True", "False"] as const).map((opt) => {
          const selected = value === opt;
          if (readOnly) {
            return (
              <div
                key={opt}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  selected
                    ? "border-emerald-400 bg-emerald-50/90 text-emerald-950"
                    : "border-neutral-100 bg-neutral-50/50 text-neutral-400"
                }`}
              >
                {selected ? (
                  <span className="text-emerald-700" aria-hidden>
                    ✓
                  </span>
                ) : (
                  <span className="w-4" />
                )}
                <span>{opt}</span>
              </div>
            );
          }
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

  return (
    <div
      role="radiogroup"
      aria-label={readOnly ? "Your selection" : "Multiple choice"}
      className="mt-4 space-y-2"
    >
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {readOnly ? "Your selection" : "Select one answer"}
      </p>
      {parsed.options.map((o) => {
        const selected = value === o.id;
        if (readOnly) {
          return (
            <div
              key={o.id}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                selected
                  ? "border-emerald-400 bg-emerald-50/90 text-emerald-950"
                  : "border-neutral-100 bg-neutral-50/50 text-neutral-400"
              }`}
            >
              {selected ? (
                <span className="mt-0.5 text-emerald-700" aria-hidden>
                  ✓
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
                    selected
                      ? "prose-neutral"
                      : "[&_p]:text-neutral-400 [&_strong]:text-neutral-500 [&_.katex]:text-neutral-400"
                  }
                />
              </div>
            </div>
          );
        }
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

export default function GradedTestingModePanel({
  week,
  moduleId,
  module,
  onExit,
  mode = "testing",
  initialAnswers = {},
  savedScore,
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

  const submit = () => {
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
                  ? `Recorded score: ${savedScore.score}/${savedScore.maxScore}. Your answers are shown below.`
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
          {pagePts.toFixed(1)} pts (of {totalPts} total)
        </p>
      </div>

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
                    qKey={k}
                    parsed={parsed}
                    value={val}
                    onChange={(v) => setAnswer(k, v)}
                    readOnly={isReview}
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
                  onClick={submit}
                  className="rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                >
                  Submit and record ({totalPts}/{totalPts} pts)
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
              onClick={submit}
              className="rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Submit and record ({totalPts}/{totalPts} pts)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
