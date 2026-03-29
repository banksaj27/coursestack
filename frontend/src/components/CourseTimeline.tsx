"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCourseStore } from "@/store/useCourseStore";
import TimelineNode from "./TimelineNode";
import StatusBar from "./StatusBar";

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-[200px]">
        <p className="text-xs text-neutral-400 leading-relaxed">
          Your syllabus will appear here as the course takes shape.
        </p>
        <div className="mt-6 space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.15, 0.3, 0.15] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
              className="flex items-center gap-2"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-neutral-200" />
              <div className="h-2.5 flex-1 rounded bg-neutral-100" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GeneratingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-[240px]">
        <div className="flex justify-center gap-1 mb-3">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-neutral-400"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Generating your course outline...
        </p>
      </div>
    </div>
  );
}

export default function CourseTimeline() {
  const weeks = useCourseStore((s) => s.planState.course_plan.weeks);
  const agentStatus = useCourseStore((s) => s.agentStatus);
  const phase = useCourseStore((s) => s.phase);
  const finalize = useCourseStore((s) => s.finalize);
  const isExporting = useCourseStore((s) => s.isExporting);
  const hasWeeks = weeks.length > 0;
  const isBusy = agentStatus !== "idle";
  const isDone = phase === "complete";

  return (
    <div className="relative flex h-full flex-col bg-white">
      <StatusBar />

      <div className="flex-1 overflow-y-auto px-8 py-5">
        {!hasWeeks ? (
          isBusy ? <GeneratingState /> : <EmptyState />
        ) : (
          <div className="relative">
            <AnimatePresence mode="popLayout">
              {weeks.map((week, idx) => (
                <TimelineNode
                  key={`week-${week.week}`}
                  week={week}
                  isFirst={idx === 0}
                  isLast={idx === weeks.length - 1}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {hasWeeks && !isDone && (
        <div className="border-t border-neutral-100 px-8 py-3">
          <button
            onClick={finalize}
            disabled={isBusy || isExporting}
            className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white
                       transition-colors hover:bg-neutral-800
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isExporting ? "Generating course..." : "Generate Course"}
          </button>
        </div>
      )}
    </div>
  );
}
