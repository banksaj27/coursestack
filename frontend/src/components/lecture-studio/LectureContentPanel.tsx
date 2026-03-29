"use client";

import { useRef } from "react";
import Link from "next/link";
import type { WeekModule } from "@/types/weekModular";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { effectiveAssessmentTotalPoints } from "@/lib/gradedAssessmentDefaults";
import { stripProblemSetDisplayPreamble } from "@/lib/stripProblemSetDisplayPreamble";
import { isGradedAssessmentKind } from "@/lib/moduleAssessmentCompletion";
import type { ModuleNavLink } from "@/lib/moduleWorkspaceNavigation";

const KIND_LABEL: Record<WeekModule["kind"], string> = {
  lecture: "Lecture",
  project: "Project",
  problem_set: "Problem set",
  quiz: "Quiz",
  exam: "Exam",
};

type WorkspaceKind = "lecture" | "problem_set" | "quiz" | "project" | "exam";

function previewKey(moduleId: string, bodyMd: string): string {
  let h = 0;
  for (let i = 0; i < bodyMd.length; i++) {
    h = (Math.imul(31, h) + bodyMd.charCodeAt(i)) | 0;
  }
  return `${moduleId}:${bodyMd.length}:${h}`;
}

/** Matches `MarkdownMath` boxed `##` (lecture notes) — used only for manual PS section titles. */
const PROBLEM_SET_SECTION_TITLE_CLASS =
  "mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-base font-semibold tracking-tight text-emerald-900 shadow-sm";

const EMPTY_BODY: Record<WorkspaceKind, string> = {
  lecture:
    "No body yet—use the professor on the left to generate content.",
  problem_set:
    "No problems yet—ask the professor to draft the assignment, or use the chat for hints and discussion once content exists.",
  quiz:
    "No questions yet—ask the professor to draft **multiple-choice** and **short-answer** items, or use the chat for discussion once the quiz exists.",
  project:
    "No project spec yet—ask the professor to draft deliverables and milestones, or use the chat for design discussion once a spec exists.",
  exam:
    "No exam content yet—ask the professor to draft the midterm/final (MC and short answer), or use the chat for discussion once it exists.",
};

type NotesProgress = {
  step: string;
  index: number;
  total: number;
  label: string;
};

type Props = {
  workspace: WorkspaceKind;
  week: number;
  courseTopic: string;
  module: WeekModule | null;
  /** Prev/next in this week’s module timeline (all kinds). */
  moduleNeighbors?: {
    prev: ModuleNavLink | null;
    next: ModuleNavLink | null;
  };
  /** Graded workspaces: actions + score in the description row. */
  gradedWorkspaceBar?: {
    onBeginTesting?: () => void;
    onViewAnswers?: () => void;
    onReattempt?: () => void;
    completedScore?: { score: number; maxScore: number } | null;
    /** When true, show View answers / Reattempt instead of Begin Testing. */
    hasGradedAttempt?: boolean;
  };
  /** Lecture workspace: toggle completion (top-right of the meta box). */
  lectureWorkspaceBar?: {
    isComplete: boolean;
    onToggleComplete?: () => void;
  };
  /** Lecture workspace: multi-step notes generation status */
  notesGenerating?: boolean;
  notesProgress?: NotesProgress | null;
  notesError?: string | null;
  onRetryLectureNotes?: () => void;
  /** Problem set workspace: multi-step assignment generation (mirror lecture notes pipeline). */
  problemSetGenerating?: boolean;
  problemSetProgress?: NotesProgress | null;
  problemSetError?: string | null;
  onRetryProblemSet?: () => void;
  /** Problem set: PDF grading + answer key (replaces in-panel testing mode). */
  problemSetBar?: {
    grading: boolean;
    gradeError: string | null;
    feedbackMd: string | null;
    hasAnswerKey: boolean;
    showAnswerKey: boolean;
    onToggleAnswerKey: () => void;
    onPdfSelected: (file: File) => void;
    hasGradedAttempt: boolean;
    canSubmitPdf: boolean;
  };
};

function NeighborCard({
  side,
  link,
  emptyLabel,
}: {
  side: "prev" | "next";
  link: ModuleNavLink | null;
  emptyLabel: string;
}) {
  const align = side === "next" ? "text-right" : "text-left";
  const flexAlign = side === "next" ? "sm:ml-auto" : "";
  if (link) {
    return (
      <Link
        href={link.href}
        className={`flex min-w-0 flex-1 flex-col rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2 transition-colors hover:border-neutral-300 hover:bg-neutral-100/80 sm:max-w-[48%] ${flexAlign}`}
      >
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider text-neutral-400 ${align}`}
        >
          {side === "prev" ? "Previous" : "Next"}
        </span>
        <span className={`truncate text-sm font-medium text-neutral-900 ${align}`}>
          {link.title}
        </span>
        <span className={`text-[11px] text-neutral-500 ${align}`}>
          {link.kindLabel}
        </span>
      </Link>
    );
  }
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col rounded-lg border border-dashed border-neutral-200 bg-neutral-50/40 px-3 py-2 opacity-60 sm:max-w-[48%] ${flexAlign}`}
    >
      <span
        className={`text-[10px] font-semibold uppercase tracking-wider text-neutral-400 ${align}`}
      >
        {side === "prev" ? "Previous" : "Next"}
      </span>
      <span className={`text-sm text-neutral-400 ${align}`}>{emptyLabel}</span>
    </div>
  );
}

export default function LectureContentPanel({
  workspace,
  week,
  courseTopic,
  module,
  moduleNeighbors,
  gradedWorkspaceBar,
  lectureWorkspaceBar,
  notesGenerating = false,
  notesProgress = null,
  notesError = null,
  onRetryLectureNotes,
  problemSetGenerating = false,
  problemSetProgress = null,
  problemSetError = null,
  onRetryProblemSet,
  problemSetBar,
}: Props) {
  const pdfInputRef = useRef<HTMLInputElement>(null);

  if (!module) {
    return (
      <div className="flex h-full items-center justify-center bg-white px-8">
        <p className="text-center text-sm text-neutral-500">
          No module loaded.
        </p>
      </div>
    );
  }

  const kindLabel = KIND_LABEL[module.kind] ?? module.kind;
  const graded = isGradedAssessmentKind(module.kind);
  const ptsTotal = graded ? effectiveAssessmentTotalPoints(module) : 0;
  const displayBodyMd =
    workspace === "problem_set"
      ? stripProblemSetDisplayPreamble(module.body_md)
      : module.body_md;
  const displaySolutionMd =
    workspace === "problem_set" && (module.solution_md ?? "").trim()
      ? stripProblemSetDisplayPreamble(module.solution_md ?? "")
      : "";

  return (
    <div className="flex h-full min-w-0 flex-col bg-white">
      <div className="shrink-0 border-b border-neutral-100 px-8 py-3">
        <h2 className="text-sm font-semibold text-neutral-900 truncate">
          {module.title}
        </h2>
      </div>

      <div className="shrink-0 border-b border-neutral-100 px-8 py-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-semibold text-neutral-700">
                {kindLabel}
              </span>
              <span className="text-xs text-neutral-500">Week {week}</span>
              {module.estimated_minutes != null && module.estimated_minutes > 0 ? (
                <span className="text-xs text-neutral-500">
                  ~{module.estimated_minutes} min
                </span>
              ) : null}
              {graded ? (
                <span className="text-xs font-medium text-neutral-700">
                  {ptsTotal} pts total
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {graded && gradedWorkspaceBar?.completedScore ? (
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                  Score: {gradedWorkspaceBar.completedScore.score}/
                  {gradedWorkspaceBar.completedScore.maxScore}
                </span>
              ) : null}
              {workspace === "lecture" && lectureWorkspaceBar ? (
                <button
                  type="button"
                  aria-pressed={lectureWorkspaceBar.isComplete}
                  onClick={lectureWorkspaceBar.onToggleComplete}
                  className={
                    lectureWorkspaceBar.isComplete
                      ? "rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-100/90"
                      : "rounded-xl border-2 border-emerald-700 bg-emerald-700 px-5 py-2 text-sm font-semibold tracking-wide text-white shadow-sm transition-colors hover:bg-emerald-800"
                  }
                >
                  {lectureWorkspaceBar.isComplete
                    ? "✓ Marked Complete"
                    : "Mark complete"}
                </button>
              ) : null}
              {workspace === "problem_set" && problemSetBar ? (
                <div className="flex flex-col items-end gap-2">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) problemSetBar.onPdfSelected(f);
                    }}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    {problemSetBar.hasGradedAttempt && problemSetBar.hasAnswerKey ? (
                      <button
                        type="button"
                        onClick={problemSetBar.onToggleAnswerKey}
                        className="rounded-xl border-2 border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50"
                      >
                        {problemSetBar.showAnswerKey ? "Hide answer key" : "Show answer key"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={
                        problemSetBar.grading ||
                        !problemSetBar.canSubmitPdf
                      }
                      className="rounded-xl border-2 border-neutral-800 bg-neutral-900 px-5 py-2 text-sm font-semibold tracking-wide text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {problemSetBar.hasGradedAttempt
                        ? "Re-submit PDF"
                        : "Submit PDF for grading"}
                    </button>
                  </div>
                  {problemSetBar.gradeError ? (
                    <p className="max-w-xs text-right text-xs text-red-600">
                      {problemSetBar.gradeError}
                    </p>
                  ) : null}
                </div>
              ) : graded && gradedWorkspaceBar ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                  {gradedWorkspaceBar.hasGradedAttempt ? (
                    <>
                      {gradedWorkspaceBar.onViewAnswers ? (
                        <button
                          type="button"
                          onClick={gradedWorkspaceBar.onViewAnswers}
                          className="rounded-xl border-2 border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50"
                        >
                          View answers
                        </button>
                      ) : null}
                      {gradedWorkspaceBar.onReattempt ? (
                        <button
                          type="button"
                          onClick={gradedWorkspaceBar.onReattempt}
                          className="rounded-xl border-2 border-rose-200 bg-rose-50 px-5 py-2 text-sm font-semibold text-rose-900 shadow-sm transition-colors hover:bg-rose-100/90"
                        >
                          Reattempt
                        </button>
                      ) : null}
                    </>
                  ) : gradedWorkspaceBar.onBeginTesting ? (
                    <button
                      type="button"
                      onClick={gradedWorkspaceBar.onBeginTesting}
                      className="rounded-xl border-2 border-neutral-800 bg-neutral-900 px-5 py-2 text-sm font-semibold tracking-wide text-white shadow-sm transition-colors hover:bg-neutral-800"
                    >
                      Begin Testing
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {module.summary ? (
            <p className="text-xs leading-relaxed text-neutral-500">
              {module.summary}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {notesError && workspace === "lecture" ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
            <p className="font-medium">Couldn&apos;t finish auto-generated notes</p>
            <p className="mt-1 text-amber-900/90">{notesError}</p>
            {onRetryLectureNotes ? (
              <button
                type="button"
                onClick={onRetryLectureNotes}
                className="mt-2 text-sm font-medium text-amber-900 underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        {problemSetError && workspace === "problem_set" ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
            <p className="font-medium">Couldn&apos;t finish auto-generated problem set</p>
            <p className="mt-1 text-amber-900/90">{problemSetError}</p>
            {onRetryProblemSet ? (
              <button
                type="button"
                onClick={onRetryProblemSet}
                className="mt-2 text-sm font-medium text-amber-900 underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        {workspace === "problem_set" &&
        problemSetBar?.feedbackMd &&
        problemSetBar.feedbackMd.trim().length > 0 ? (
          <div className="mb-6 max-w-3xl border-b border-neutral-100 pb-6">
            <h2 className={PROBLEM_SET_SECTION_TITLE_CLASS}>Grading Feedback</h2>
            <MarkdownMath
              key={`${module.id}-feedback`}
              source={problemSetBar.feedbackMd}
              variant="light"
              uniformScale
              className="max-w-3xl text-sm"
            />
          </div>
        ) : null}

        {workspace === "problem_set" && displayBodyMd.trim().length > 0 ? (
          <div className="mb-6 max-w-3xl">
            <h2 className={PROBLEM_SET_SECTION_TITLE_CLASS}>Problems</h2>
            <MarkdownMath
              key={previewKey(module.id, displayBodyMd)}
              source={displayBodyMd}
              variant="light"
              uniformScale
              className="max-w-3xl"
            />
          </div>
        ) : displayBodyMd.trim().length > 0 ? (
          <MarkdownMath
            key={previewKey(module.id, displayBodyMd)}
            source={displayBodyMd}
            variant="light"
            uniformScale
            boxedSectionHeadings={workspace === "lecture"}
            className="max-w-3xl"
          />
        ) : (
          <p className="text-sm text-neutral-400">{EMPTY_BODY[workspace]}</p>
        )}

        {workspace === "problem_set" &&
        problemSetBar?.showAnswerKey &&
        displaySolutionMd.trim().length > 0 ? (
          <div className="mt-8 max-w-3xl border-t border-neutral-100 pt-6">
            <h2 className={PROBLEM_SET_SECTION_TITLE_CLASS}>Answer Key</h2>
            <MarkdownMath
              key={previewKey(`${module.id}-sol`, displaySolutionMd)}
              source={displaySolutionMd}
              variant="light"
              uniformScale
              className="max-w-3xl"
            />
          </div>
        ) : null}

        {notesGenerating && workspace === "lecture" ? (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/75 px-6 backdrop-blur-[1px]"
            aria-live="polite"
          >
            <div className="max-w-md rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Building lecture notes
              </p>
              <p className="mt-2 text-sm font-medium text-neutral-900">
                {notesProgress?.label ?? "Working…"}
              </p>
              {notesProgress && notesProgress.total > 0 && notesProgress.step === "section" ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Section {notesProgress.index} of {notesProgress.total}
                </p>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                Outlining sections, then writing each part—this can take a minute.
              </p>
            </div>
          </div>
        ) : null}

        {problemSetGenerating && workspace === "problem_set" ? (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/75 px-6 backdrop-blur-[1px]"
            aria-live="polite"
          >
            <div className="max-w-md rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Building problem set
              </p>
              <p className="mt-2 text-sm font-medium text-neutral-900">
                {problemSetProgress?.label ?? "Working…"}
              </p>
              {problemSetProgress &&
              problemSetProgress.total > 0 &&
              problemSetProgress.step === "problem" ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Problem {problemSetProgress.index} of {problemSetProgress.total}
                </p>
              ) : null}
              {problemSetProgress &&
              problemSetProgress.total > 0 &&
              problemSetProgress.step === "solution" ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Solution {problemSetProgress.index} of {problemSetProgress.total}
                </p>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                Planning problems, writing questions, then the answer key—this can take a minute.
              </p>
            </div>
          </div>
        ) : null}

        {workspace === "problem_set" && problemSetBar?.grading ? (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/75 px-6 backdrop-blur-[1px]"
            aria-live="polite"
          >
            <div className="max-w-md rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Grading your PDF
              </p>
              <p className="mt-2 text-sm text-neutral-600">
                Comparing your work to the assignment and answer key…
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {moduleNeighbors ? (
        <div className="shrink-0 border-t border-neutral-100 bg-white px-8 py-3">
          <div className="flex max-w-3xl flex-wrap items-stretch justify-between gap-3">
            <NeighborCard
              side="prev"
              link={moduleNeighbors.prev}
              emptyLabel="First in week"
            />
            <NeighborCard
              side="next"
              link={moduleNeighbors.next}
              emptyLabel="Last in week"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
