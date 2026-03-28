"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCourseStore } from "@/store/useCourseStore";
import TopicInput from "@/components/TopicInput";
import ChatPanel from "@/components/ChatPanel";
import CourseTimeline from "@/components/CourseTimeline";

export default function Home() {
  const phase = useCourseStore((s) => s.phase);

  return (
    <AnimatePresence mode="wait">
      {phase === "topic_input" ? (
        <TopicInput key="topic-input" />
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
