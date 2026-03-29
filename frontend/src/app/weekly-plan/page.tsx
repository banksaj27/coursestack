"use client";

import { useLayoutEffect } from "react";
import { motion } from "framer-motion";
import AppNav from "@/components/AppNav";
import EmptyWorkspacePlaceholder, {
  WorkspacePlaceholderLink,
} from "@/components/shared/EmptyWorkspacePlaceholder";
import WeekModularChatPanel from "@/components/weekly-plan/WeekModularChatPanel";
import WeekModulesTimeline from "@/components/weekly-plan/WeekModulesTimeline";
import { hydrateWeekWorkspace } from "@/lib/hydrateWeekWorkspace";
import { useWeekModularStore } from "@/store/useWeekModularStore";

export default function WeeklyPlanPage() {
  const syllabus = useWeekModularStore((s) => s.syllabus);
  const hasCourse =
    syllabus.topic.trim().length > 0 && syllabus.course_plan.weeks.length > 0;

  useLayoutEffect(() => {
    hydrateWeekWorkspace();
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppNav />
      {hasCourse ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex min-h-0 flex-1"
        >
          <div className="w-[42%] border-r border-neutral-100 bg-background dark:border-neutral-700">
            <WeekModularChatPanel />
          </div>
          <div className="w-[58%] min-w-0">
            <WeekModulesTimeline />
          </div>
        </motion.div>
      ) : (
        <EmptyWorkspacePlaceholder title="No course exported yet">
          <p>
            Open{" "}
            <strong className="font-medium text-neutral-700">Syllabus</strong>
            , refine your plan, then click{" "}
            <strong className="font-medium text-neutral-700">
              Generate Course
            </strong>{" "}
            to load weeks here.
          </p>
          <p>
            <WorkspacePlaceholderLink href="/syllabus">
              Go to syllabus
            </WorkspacePlaceholderLink>
          </p>
        </EmptyWorkspacePlaceholder>
      )}
    </div>
  );
}
