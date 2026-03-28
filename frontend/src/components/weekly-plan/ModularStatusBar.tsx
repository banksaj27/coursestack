"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useWeekModularStore } from "@/store/useWeekModularStore";

export default function ModularStatusBar() {
  const topic = useWeekModularStore((s) => s.syllabus.topic);
  const selectedWeek = useWeekModularStore((s) => s.selectedWeek);
  const weekTitle = useWeekModularStore((s) => {
    const w = s.syllabus.course_plan.weeks.find((x) => x.week === s.selectedWeek);
    return w?.title ?? "";
  });
  const count = useWeekModularStore((s) => s.generated.modules.length);
  const agentStatus = useWeekModularStore((s) => s.agentStatus);
  const isActive =
    agentStatus === "thinking" ||
    agentStatus === "streaming" ||
    agentStatus === "updating";

  return (
    <div className="border-b border-neutral-100 px-8 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {topic ? (
            <h2 className="truncate text-sm font-semibold text-neutral-900">
              {topic}
            </h2>
          ) : null}
          <p className="truncate text-[11px] text-neutral-500">
            Week {selectedWeek}
            {weekTitle ? ` · ${weekTitle}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400"
            />
          )}
          <AnimatePresence mode="wait">
            <motion.span
              key={`${count}-${isActive}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-[11px] text-neutral-400"
            >
              {count > 0
                ? `${count} module${count === 1 ? "" : "s"}`
                : "Building timeline"}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
