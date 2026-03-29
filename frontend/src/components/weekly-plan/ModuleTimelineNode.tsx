"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WeekModule } from "@/types/weekModular";
import { MarkdownMath } from "@/components/shared/MarkdownMath";

const KIND_META: Record<
  WeekModule["kind"],
  { label: string; dot: string; badge: string; borderNew: string }
> = {
  lecture: {
    label: "Lecture",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    borderNew: "border-indigo-300 bg-indigo-50/50",
  },
  project: {
    label: "Project",
    dot: "bg-violet-500",
    badge: "bg-violet-50 text-violet-900 border-violet-200",
    borderNew: "border-indigo-300 bg-indigo-50/50",
  },
  problem_set: {
    label: "Problem set",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-900 border-amber-200",
    borderNew: "border-indigo-300 bg-indigo-50/50",
  },
  quiz: {
    label: "Quiz",
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-900 border-sky-200",
    borderNew: "border-indigo-300 bg-indigo-50/50",
  },
};

interface Props {
  module: WeekModule;
  index: number;
  isLast: boolean;
  isFirst: boolean;
}

export default function ModuleTimelineNode({
  module: mod,
  isLast,
  isFirst,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const meta = KIND_META[mod.kind] ?? KIND_META.lecture;
  const onlyNode = isFirst && isLast;

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
          className="absolute w-px bg-neutral-200"
          style={{
            left: "7px",
            top: isFirst ? "20px" : "0px",
            ...(isLast ? { height: "20px" } : { bottom: "0px" }),
          }}
        />
      )}

      <div className="relative flex w-3.5 shrink-0 flex-col items-center">
        <div
          className={`relative z-10 mt-[13px] h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white shadow-sm ${meta.dot}`}
          style={{ marginLeft: "0.5px" }}
        />
      </div>

      <div
        className={`flex-1 cursor-pointer rounded-xl border transition-colors duration-300 ${
          mod.is_new ? meta.borderNew : "border-neutral-200 bg-white"
        }`}
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
            </div>
            <h3 className="truncate text-[13px] font-semibold text-neutral-900">
              {mod.title}
            </h3>
            {mod.summary ? (
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-neutral-500">
                {mod.summary}
              </p>
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
          {expanded && mod.body_md.trim().length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-t border-neutral-100 px-4 py-3">
                <MarkdownMath source={mod.body_md} variant="light" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
