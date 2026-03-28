"use client";

import Link from "next/link";
import { useEffect } from "react";
import { motion } from "framer-motion";
import WeekModularChatPanel from "@/components/weekly-plan/WeekModularChatPanel";
import WeekModulesTimeline from "@/components/weekly-plan/WeekModulesTimeline";
import { hydrateWeekWorkspace } from "@/lib/hydrateWeekWorkspace";

export default function WeeklyPlanPage() {
  useEffect(() => {
    hydrateWeekWorkspace();
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-100 bg-white px-4 py-2">
        <Link
          href="/"
          className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-800"
        >
          ← Course planner
        </Link>
        <span className="shrink-0 text-[10px] font-medium tracking-wide text-neutral-400">
          Weekly Plan
        </span>
      </header>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex min-h-0 flex-1"
      >
        <div className="w-[42%] border-r border-neutral-100 bg-white">
          <WeekModularChatPanel />
        </div>
        <div className="w-[58%] min-w-0">
          <WeekModulesTimeline />
        </div>
      </motion.div>
    </div>
  );
}
