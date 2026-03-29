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
    <div className="border-b border-neutral-200 bg-neutral-50/40 px-6 py-4 sm:px-8">
      <div className="flex flex-col gap-3">
        {topic ? (
          <h2 className="break-words text-sm font-semibold leading-snug text-neutral-900">
            {topic}
          </h2>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0 w-full flex-1 sm:max-w-xl">
            <label
              htmlFor="week-modular-week-select"
              className="text-[11px] font-bold uppercase tracking-wider text-neutral-700"
            >
              Week
            </label>
            <select
              id="week-modular-week-select"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              disabled={isActive}
              className="mt-1 w-full min-w-0 cursor-pointer rounded-xl border-2 border-neutral-300 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-neutral-900 shadow-sm outline-none transition-colors hover:border-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syllabus.course_plan.weeks.map((w) => (
                <option key={w.week} value={w.week}>
                  Week {w.week}: {w.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => void resetWeeklyPlanAndRegenerate()}
              disabled={isActive}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[11px] font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset &amp; regenerate
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
