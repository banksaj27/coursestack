"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WeekModule } from "@/types/weekModular";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { useModuleProgress } from "@/hooks/useModuleAssessmentCompletion";
import { effectiveAssessmentTotalPoints } from "@/lib/gradedAssessmentDefaults";
import { isGradedAssessmentKind } from "@/lib/moduleAssessmentCompletion";

const KIND_META: Record<
  WeekModule["kind"],
  { label: string; dot: string; badge: string; pulse: string }
> = {
  lecture: {
    label: "Lecture",
    dot: "bg-emerald-500",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    pulse: "bg-emerald-400",
  },
  project: {
    label: "Project",
    dot: "bg-violet-500",
    badge:
      "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200",
    pulse: "bg-violet-400",
  },
  problem_set: {
    label: "Problem set",
    dot: "bg-amber-500",
    badge:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    pulse: "bg-amber-400",
  },
  quiz: {
    label: "Quiz",
    dot: "bg-sky-500",
    badge:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
    pulse: "bg-sky-400",
  },
  exam: {
    label: "Exam",
    dot: "bg-rose-500",
    badge:
      "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
    pulse: "bg-rose-400",
  },
};

interface Props {
  week: number;
  module: WeekModule;
  index: number;
  isLast: boolean;
  isFirst: boolean;
}

export default function ModuleTimelineNode({
  week,
  module: mod,
  isLast,
  isFirst,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [highlight, setHighlight] = useState(!!mod.is_new);
  const meta = KIND_META[mod.kind] ?? KIND_META.lecture;
  const onlyNode = isFirst && isLast;
  const graded = isGradedAssessmentKind(mod.kind);
  const ptsTotal = graded ? effectiveAssessmentTotalPoints(mod) : 0;
  const progress = useModuleProgress(week, mod.id);

  useEffect(() => {
    if (mod.is_new) {
      setHighlight(true);
      const timer = setTimeout(() => setHighlight(false), 2000);
      return () => clearTimeout(timer);
    }
    setHighlight(false);
  }, [
    mod.is_new,
    mod.id,
    mod.title,
    mod.summary,
    mod.one_line_summary,
    mod.body_md,
  ]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="relative flex gap-4 pb-4"
    >
      {!onlyNode && (
        <div
          className="absolute w-px bg-neutral-200 dark:bg-neutral-600"
          style={{
            left: "7px",
            top: isFirst ? "20px" : "0px",
            ...(isLast ? { height: "20px" } : { bottom: "0px" }),
          }}
        />
      )}

      <div className="relative flex w-3.5 shrink-0 flex-col items-center">
        <div
          className="relative z-10 mt-[13px] h-3.5 w-3.5 shrink-0"
          style={{ marginLeft: "0.5px" }}
        >
          {mod.is_new && (
            <motion.div
              key={`pulse-${mod.id}-${mod.title}-${(mod.summary || "").slice(0, 40)}`}
              className={`absolute inset-0 rounded-full ${meta.pulse}`}
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}
          <div
            className={`h-full w-full rounded-full border-2 border-white shadow-sm dark:border-neutral-800 ${meta.dot}`}
          />
        </div>
      </div>

      <div
        className={`flex-1 cursor-pointer rounded-xl border ${
          highlight
            ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-950/50"
            : "border-neutral-200 bg-white dark:border-neutral-600 dark:bg-neutral-800"
        }`}
        style={{
          transition: highlight
            ? "none"
            : "background-color 600ms ease, border-color 600ms ease",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className={`shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider ${meta.badge}`}
              >
                {meta.label}
              </span>
              {mod.estimated_minutes != null && mod.estimated_minutes > 0 ? (
                <span className="text-[10px] text-neutral-400">
                  ~{mod.estimated_minutes} min
                </span>
              ) : null}
              {graded ? (
                <span className="text-[10px] font-medium text-neutral-600">
                  {ptsTotal} pts
                </span>
              ) : null}
              {mod.kind === "lecture" && progress.lectureComplete ? (
                <span className="inline-flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50/90 px-1.5 py-px text-[10px] font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200">
                  <span aria-hidden>✓</span>
                  Done
                </span>
              ) : null}
              {graded && progress.graded ? (
                <span className="inline-flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50/90 px-1.5 py-px text-[10px] font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200">
                  <span aria-hidden>✓</span>
                  {progress.graded.score}/{progress.graded.maxScore}
                </span>
              ) : null}
            </div>
            <h3 className="truncate text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
              {mod.title}
            </h3>
            {mod.one_line_summary?.trim() ? (
              <p
                className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-neutral-500 dark:text-neutral-400"
                title={mod.one_line_summary}
              >
                {mod.one_line_summary.trim()}
              </p>
            ) : null}
            {mod.kind === "lecture" && mod.id ? (
              <Link
                href={`/lecture/${week}/${encodeURIComponent(mod.id)}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-1.5 inline-block text-[11px] font-medium text-emerald-700 underline decoration-emerald-200 underline-offset-2 hover:text-emerald-900 dark:text-emerald-400 dark:decoration-emerald-700 dark:hover:text-emerald-300"
              >
                Open lecture workspace →
              </Link>
            ) : null}
            {mod.kind === "problem_set" && mod.id ? (
              <Link
                href={`/problem-set/${week}/${encodeURIComponent(mod.id)}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-1.5 inline-block text-[11px] font-medium text-amber-800 underline decoration-amber-200 underline-offset-2 hover:text-amber-950 dark:text-amber-300 dark:decoration-amber-700 dark:hover:text-amber-200"
              >
                Open problem set workspace →
              </Link>
            ) : null}
            {mod.kind === "quiz" && mod.id ? (
              <Link
                href={`/quiz/${week}/${encodeURIComponent(mod.id)}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-1.5 inline-block text-[11px] font-medium text-sky-800 underline decoration-sky-200 underline-offset-2 hover:text-sky-950 dark:text-sky-400 dark:decoration-sky-700 dark:hover:text-sky-300"
              >
                Open quiz workspace →
              </Link>
            ) : null}
            {mod.kind === "project" && mod.id ? (
              <Link
                href={`/project/${week}/${encodeURIComponent(mod.id)}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-1.5 inline-block text-[11px] font-medium text-violet-800 underline decoration-violet-200 underline-offset-2 hover:text-violet-950 dark:text-violet-400 dark:decoration-violet-700 dark:hover:text-violet-300"
              >
                Open project workspace →
              </Link>
            ) : null}
            {mod.kind === "exam" && mod.id ? (
              <Link
                href={`/exam/${week}/${encodeURIComponent(mod.id)}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-1.5 inline-block text-[11px] font-medium text-rose-800 underline decoration-rose-200 underline-offset-2 hover:text-rose-950 dark:text-rose-400 dark:decoration-rose-700 dark:hover:text-rose-300"
              >
                Open exam workspace →
              </Link>
            ) : null}
          </div>
          <motion.svg
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.15 }}
            className="h-3.5 w-3.5 shrink-0 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </motion.svg>
        </div>

        <AnimatePresence>
          {expanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-t border-neutral-100 px-4 py-3 dark:border-neutral-700">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  Summary
                </p>
                {mod.summary?.trim() ? (
                  <div className="mt-2">
                    <MarkdownMath
                      source={mod.summary}
                      variant="light"
                      className="text-neutral-700 dark:text-neutral-300"
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
                    No summary on the timeline yet. Open the workspace above to
                    view and edit the full module—body content stays there, not
                    here.
                  </p>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
