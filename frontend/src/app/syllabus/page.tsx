"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCourseStore } from "@/store/useCourseStore";
import AppNav from "@/components/AppNav";
import ChatPanel from "@/components/ChatPanel";
import CourseTimeline from "@/components/CourseTimeline";
import { hydrateWeekWorkspace } from "@/lib/hydrateWeekWorkspace";

export default function SyllabusPage() {
  const router = useRouter();
  const [clientReady, setClientReady] = useState(false);
  const phase = useCourseStore((s) => s.phase);

  useLayoutEffect(() => {
    hydrateWeekWorkspace();
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (!clientReady) return;
    if (phase === "topic_input") {
      router.replace("/");
    }
  }, [phase, router, clientReady]);

  if (!clientReady) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-neutral-50/50 dark:bg-neutral-950">
        <AppNav />
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
          Loading…
        </div>
      </div>
    );
  }

  if (phase === "topic_input") {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-neutral-50/50 dark:bg-neutral-950">
        <AppNav />
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
          Redirecting…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50/50 dark:bg-neutral-950">
      <AppNav />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex min-h-0 flex-1"
      >
        <div className="w-[42%] border-r border-neutral-100 bg-white dark:bg-neutral-900">
          <ChatPanel />
        </div>
        <div className="w-[58%] min-w-0">
          <CourseTimeline />
        </div>
      </motion.div>
    </div>
  );
}
