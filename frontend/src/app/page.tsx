"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCourseStore } from "@/store/useCourseStore";
import TopicInput from "@/components/TopicInput";
import ChatPanel from "@/components/ChatPanel";
import CourseTimeline from "@/components/CourseTimeline";
import WeekModularChatPanel from "@/components/weekly-plan/WeekModularChatPanel";
import WeekModulesTimeline from "@/components/weekly-plan/WeekModulesTimeline";
import { hydrateWeekWorkspace } from "@/lib/hydrateWeekWorkspace";

function WeeklyPlanView() {
  useEffect(() => {
    hydrateWeekWorkspace();
  }, []);

  return (
    <motion.div
      key="weekly-plan"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex h-screen"
    >
      <div className="w-[42%] border-r border-neutral-100 bg-white">
        <WeekModularChatPanel />
      </div>
      <div className="w-[58%] min-w-0">
        <WeekModulesTimeline />
      </div>
    </motion.div>
  );
}

export default function Home() {
  const phase = useCourseStore((s) => s.phase);

  return (
    <AnimatePresence mode="wait">
      {phase === "topic_input" ? (
        <TopicInput key="topic-input" />
      ) : phase === "weekly_plan" ? (
        <WeeklyPlanView key="weekly-plan" />
      ) : (
        <motion.div
          key="planning"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex h-screen"
        >
          <div className="w-[42%] border-r border-neutral-100 bg-white">
            <ChatPanel />
          </div>
          <div className="w-[58%]">
            <CourseTimeline />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
