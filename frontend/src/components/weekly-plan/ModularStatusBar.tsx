"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useWeekModularStore } from "@/store/useWeekModularStore";

export default function ModularStatusBar() {
  const topic = useWeekModularStore((s) => s.syllabus.topic);
  const syllabus = useWeekModularStore((s) => s.syllabus);
  const selectedWeek = useWeekModularStore((s) => s.selectedWeek);
  const setSelectedWeek = useWeekModularStore((s) => s.setSelectedWeek);
  const count = useWeekModularStore((s) => s.generated.modules.length);
  const agentStatus = useWeekModularStore((s) => s.agentStatus);
  const isActive =
    agentStatus === "thinking" ||
    agentStatus === "streaming" ||
    agentStatus === "updating";

  return (
    <div className="border-b border-neutral-200 bg-neutral-50/40 px-6 py-4 sm:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          {topic ? (
            <h2 className="truncate text-sm font-semibold text-neutral-900">
              {topic}
            </h2>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[280px] lg:max-w-md">
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
            className="w-full cursor-pointer rounded-xl border-2 border-neutral-300 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-neutral-900 shadow-sm outline-none transition-colors hover:border-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syllabus.course_plan.weeks.map((w) => (
              <option key={w.week} value={w.week}>
                Week {w.week}: {w.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 lg:pl-2">
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
