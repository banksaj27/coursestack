"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Week } from "@/types/course";
import { useWeekAllModulesComplete } from "@/hooks/useWeekAllModulesComplete";

interface TimelineNodeProps {
  week: Week;
  isLast: boolean;
  isFirst: boolean;
}

export default function TimelineNode({ week, isLast, isFirst }: TimelineNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [highlight, setHighlight] = useState(week.is_new);
  const weekAllDone = useWeekAllModulesComplete(week.week);
  const onlyNode = isFirst && isLast;
  const isExamWeek =
    week.assessment === "midterm" || week.assessment === "final";

  useEffect(() => {
    if (week.is_new) {
      setHighlight(true);
      const timer = setTimeout(() => setHighlight(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setHighlight(false);
    }
  }, [week.is_new, week.title, week.topics]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="relative flex gap-4 pb-4"
    >
      {/* Single continuous line — placed on the outer div so it spans through pb-4 padding */}
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

      {/* Dot column */}
      <div className="relative flex flex-col items-center w-3.5 shrink-0">
        <div className="relative z-10 mt-[13px] h-3.5 w-3.5 shrink-0" style={{ marginLeft: "0.5px" }}>
          {week.is_new && !weekAllDone && (
            <motion.div
              key={`pulse-${week.week}-${week.title}-${week.topics.join(",")}`}
              className="absolute inset-0 rounded-full bg-emerald-400"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}
          <div
            className={`h-full w-full rounded-full border-2 border-white shadow-sm dark:border-neutral-800 ${
              weekAllDone ? "bg-neutral-400" : "bg-emerald-500"
            }`}
          />
        </div>
      </div>

      {/* Card */}
      <div
        className={`flex-1 cursor-pointer rounded-xl border ${
          highlight
            ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-950/50"
            : weekAllDone
              ? "border-neutral-200 bg-neutral-100/70 dark:border-neutral-600 dark:bg-neutral-800/80"
              : "border-neutral-200 bg-white dark:border-neutral-600 dark:bg-transparent"
        }`}
        style={{
          transition: highlight
            ? "none"
            : "background-color var(--theme-transition-duration) ease, border-color var(--theme-transition-duration) ease",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider shrink-0 ${
                weekAllDone && !highlight ? "text-neutral-500" : "text-neutral-400"
              }`}
            >
              Week {week.week}
            </span>
            <h3
              className={`truncate text-[13px] font-semibold ${
                weekAllDone && !highlight
                  ? "text-neutral-600 dark:text-neutral-400"
                  : "text-neutral-900 dark:text-neutral-100"
              }`}
            >
              {week.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {week.assessment && (
              <span
                className={`rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wider ${
                  isExamWeek
                    ? "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
                    : "border border-neutral-200 text-neutral-500 dark:border-neutral-600 dark:text-neutral-400"
                }`}
              >
                {week.assessment === "midterm" ? "Midterm" : "Final"}
              </span>
            )}
            {weekAllDone && (
              <span className="inline-flex shrink-0 items-center rounded border border-emerald-200 bg-emerald-50/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200">
                ✓ Done
              </span>
            )}
            <motion.svg
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.15 }}
              className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </motion.svg>
          </div>
        </div>

        {/* Expanded topics */}
        <AnimatePresence>
          {expanded && week.topics.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="border-t border-neutral-100 px-4 py-2.5 dark:border-neutral-700">
                <ul className="space-y-1">
                  {week.topics.map((topic) => (
                    <li
                      key={topic}
                      className="flex items-start gap-2 text-[12px] leading-snug text-neutral-600 dark:text-neutral-400"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-500" />
                      {topic}
                    </li>
                  ))}
                </ul>
                {week.has_homework && (
                  <p className="mt-2 text-[10px] text-neutral-400">
                    Problem set
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
