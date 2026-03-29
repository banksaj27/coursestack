"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCourseStore } from "@/store/useCourseStore";
import TimelineNode from "./TimelineNode";
import StatusBar from "./StatusBar";

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-[240px]">
        <div className="flex justify-center gap-1 mb-3">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-neutral-300"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Getting to know you
        </p>
      </div>
    </div>
  );
}

export default function CourseTimeline() {
  const router = useRouter();
  const weeks = useCourseStore((s) => s.planState.course_plan.weeks);
  const agentStatus = useCourseStore((s) => s.agentStatus);
  const phase = useCourseStore((s) => s.phase);
  const finalize = useCourseStore((s) => s.finalize);
  const isExporting = useCourseStore((s) => s.isExporting);
  const hasWeeks = weeks.length > 0;
  const isBusy = agentStatus !== "idle";
  const hasGeneratedCourse = phase === "weekly_plan";

  const handleFinalize = async () => {
    await finalize();
    if (useCourseStore.getState().phase === "weekly_plan") {
      router.push("/weekly-plan");
    }
  };

  const goToCourses = () => {
    router.push("/weekly-plan");
  };

  return (
    <div className="relative flex h-full flex-col bg-white">
      <StatusBar />

      <div className="flex-1 overflow-y-auto px-8 py-5">
        {!hasWeeks ? (
          <EmptyState />
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

      {hasWeeks && (
        <div className="border-t border-neutral-100 px-8 py-3">
          <button
            type="button"
            onClick={() =>
              hasGeneratedCourse ? goToCourses() : void handleFinalize()
            }
            disabled={!hasGeneratedCourse && (isBusy || isExporting)}
            className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white
                       transition-[opacity,background-color] duration-300 ease-out
                       hover:bg-neutral-800
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isExporting
              ? "Generating course..."
              : hasGeneratedCourse
                ? "View Course"
                : "Generate Course"}
          </button>
        </div>
      )}
    </div>
  );
}
