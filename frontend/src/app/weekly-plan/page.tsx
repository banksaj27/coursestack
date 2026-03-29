"use client";

import { useLayoutEffect } from "react";
import { motion } from "framer-motion";
import AppNav from "@/components/AppNav";
import WeekModularChatPanel from "@/components/weekly-plan/WeekModularChatPanel";
import WeekModulesTimeline from "@/components/weekly-plan/WeekModulesTimeline";
import { hydrateWeekWorkspace } from "@/lib/hydrateWeekWorkspace";

export default function WeeklyPlanPage() {
  useLayoutEffect(() => {
    hydrateWeekWorkspace();
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50/50">
      <AppNav />
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
