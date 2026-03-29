"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useWeekModularStore } from "@/store/useWeekModularStore";
import ModularStatusBar from "./ModularStatusBar";
import ModuleTimelineNode from "./ModuleTimelineNode";
import { MarkdownMath } from "@/components/shared/MarkdownMath";

function EmptyModulesState({ busy }: { busy: boolean }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-[260px] text-center">
        {busy ? (
          <>
            <div className="mb-3 flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-neutral-400"
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
            <p className="text-xs leading-relaxed text-neutral-400">
              Laying out lectures, projects, problem sets, and quizzes on the
              timeline…
            </p>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-neutral-400">
            Modules for this week will appear here. The professor chat is
            generating them automatically.
          </p>
        )}
      </div>
    </div>
  );
}

export default function WeekModulesTimeline() {
  const modules = useWeekModularStore((s) => s.generated.modules);
  const instructorNotes = useWeekModularStore(
    (s) => s.generated.instructor_notes_md,
  );
  const agentStatus = useWeekModularStore((s) => s.agentStatus);
  const busy = agentStatus !== "idle";
  const hasModules = modules.length > 0;

  return (
    <div className="relative flex h-full flex-col bg-white">
      <ModularStatusBar />

      <div className="flex-1 overflow-y-auto px-8 py-5">
        {!hasModules ? (
          <EmptyModulesState busy={busy} />
        ) : (
          <div className="relative">
            <AnimatePresence mode="popLayout">
              {modules.map((mod, idx) => (
                <ModuleTimelineNode
                  key={mod.id || `mod-${idx}`}
                  module={mod}
                  index={idx}
                  isFirst={idx === 0}
                  isLast={idx === modules.length - 1}
                />
              ))}
            </AnimatePresence>

            {instructorNotes.trim().length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3"
              >
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Instructor notes
                </p>
                <MarkdownMath source={instructorNotes} variant="light" />
              </motion.div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
