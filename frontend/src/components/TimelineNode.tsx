"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Week } from "@/types/course";

interface TimelineNodeProps {
  week: Week;
  isLast: boolean;
  isFirst: boolean;
}

export default function TimelineNode({ week, isLast, isFirst }: TimelineNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const onlyNode = isFirst && isLast;

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
          className="absolute w-px bg-neutral-200"
          style={{
            left: "7px",
            top: isFirst ? "20px" : "0px",
            ...(isLast ? { height: "20px" } : { bottom: "0px" }),
          }}
        />
      )}

      {/* Dot column */}
      <div className="relative flex flex-col items-center w-3.5 shrink-0">
        <div className="relative z-10 mt-[13px] h-3.5 w-3.5 shrink-0">
          {week.is_new && (
            <motion.div
              className="absolute inset-0 rounded-full bg-emerald-400"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}
          <div className="h-full w-full rounded-full border-2 border-white shadow-sm bg-emerald-500" />
        </div>
      </div>

      {/* Card */}
      <div
        className={`flex-1 rounded-xl border cursor-pointer transition-colors duration-300 ${
          week.is_new
            ? "border-indigo-300 bg-indigo-50/50"
            : "border-neutral-200 bg-white"
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider shrink-0">
              Week {week.week}
            </span>
            <h3 className="text-[13px] font-semibold text-neutral-900 truncate">
              {week.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {week.assessment && (
              <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider border border-neutral-200 rounded px-1.5 py-px">
                {week.assessment === "midterm" ? "Midterm" : "Final"}
              </span>
            )}
            <motion.svg
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.15 }}
              className="h-3.5 w-3.5 text-neutral-400"
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
              <div className="border-t border-neutral-100 px-4 py-2.5">
                <ul className="space-y-1">
                  {week.topics.map((topic) => (
                    <li
                      key={topic}
                      className="text-[12px] text-neutral-600 leading-snug flex items-start gap-2"
                    >
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-neutral-300 shrink-0" />
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
