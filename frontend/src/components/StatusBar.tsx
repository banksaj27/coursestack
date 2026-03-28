"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCourseStore } from "@/store/useCourseStore";

const PHASE_LABELS: Record<string, string> = {
  understanding: "Understanding your background",
  refining: "Refining syllabus",
  finalizing: "Confirming details",
};

export default function StatusBar() {
  const agentPhase = useCourseStore((s) => s.planState.agent_phase);
  const agentStatus = useCourseStore((s) => s.agentStatus);
  const topic = useCourseStore((s) => s.planState.topic);
  const weekCount = useCourseStore((s) => s.planState.course_plan.weeks.length);

  const phaseLabel = PHASE_LABELS[agentPhase] || PHASE_LABELS.understanding;
  const isActive = agentStatus === "thinking" || agentStatus === "streaming";

  return (
    <div className="border-b border-neutral-100 px-8 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {topic && (
            <h2 className="text-sm font-semibold text-neutral-900 truncate">
              {topic}
            </h2>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-pulse"
            />
          )}
          <AnimatePresence mode="wait">
            <motion.span
              key={agentPhase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-[11px] text-neutral-400"
            >
              {phaseLabel}
              {weekCount > 0 && ` \u00b7 ${weekCount} weeks`}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
