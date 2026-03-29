"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useWeekModularStore } from "@/store/useWeekModularStore";

export default function ModularStatusBar() {
  const topic = useWeekModularStore((s) => s.syllabus.topic);
  const syllabus = useWeekModularStore((s) => s.syllabus);
  const selectedWeek = useWeekModularStore((s) => s.selectedWeek);
  const setSelectedWeek = useWeekModularStore((s) => s.setSelectedWeek);
  const resetWeeklyPlanAndRegenerate = useWeekModularStore(
    (s) => s.resetWeeklyPlanAndRegenerate,
  );
  const count = useWeekModularStore((s) => s.generated.modules.length);
  const agentStatus = useWeekModularStore((s) => s.agentStatus);
  const isActive =
    agentStatus === "thinking" ||
    agentStatus === "streaming" ||
    agentStatus === "updating";

  return (
    <div className="shrink-0 bg-white dark:bg-neutral-900">
      <div className="border-b border-neutral-100 px-8 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          {topic || "Timeline"}
        </h2>
      </div>

      <div className="border-b border-neutral-100 px-8 py-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xl">
            <label
              htmlFor="week-modular-week-select"
              className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
            >
              Week
            </label>
            <select
              id="week-modular-week-select"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              disabled={isActive}
              className="min-h-0 h-9 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white py-0 pl-3 pr-8 text-sm font-medium text-neutral-900 outline-none transition-colors hover:border-neutral-300 focus:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
            >
              {syllabus.course_plan.weeks.map((w) => (
                <option key={w.week} value={w.week}>
                  Week {w.week}: {w.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => void resetWeeklyPlanAndRegenerate()}
              disabled={isActive}
              className="h-9 shrink-0 rounded-lg border border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              Reset &amp; Regenerate
            </button>
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
    </div>
  );
}
