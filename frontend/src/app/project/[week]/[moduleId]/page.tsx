"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useWeekModuleNeighbors } from "@/hooks/useWeekModuleNeighbors";
import { motion } from "framer-motion";
import AppNav from "@/components/AppNav";
import {
  EmptyWorkspaceScreen,
  WorkspacePlaceholderLink,
  inlineLinkClass,
} from "@/components/shared/EmptyWorkspacePlaceholder";
import LectureChatPanel from "@/components/lecture-studio/LectureChatPanel";
import LectureContentPanel from "@/components/lecture-studio/LectureContentPanel";
import { useModuleStudio } from "@/hooks/useModuleStudio";
import { setLastCourseworkVisit } from "@/lib/courseworkNavigation";
import { hydrateWeekWorkspace } from "@/lib/hydrateWeekWorkspace";

export default function ProjectWorkspacePage() {
  const params = useParams();
  const weekRaw = params.week;
  const moduleIdRaw = params.moduleId;
  const week = Number(Array.isArray(weekRaw) ? weekRaw[0] : weekRaw);
  const moduleId = decodeURIComponent(
    String(Array.isArray(moduleIdRaw) ? moduleIdRaw[0] : moduleIdRaw ?? ""),
  );

  useEffect(() => {
    hydrateWeekWorkspace();
  }, []);

  const {
    syllabusTopic,
    module,
    messages,
    notFound,
    agentStatus,
    streamingContent,
    sendMessage,
    isBusy,
  } = useModuleStudio(week, moduleId);

  const moduleNeighbors = useWeekModuleNeighbors(week, moduleId, module);

  useEffect(() => {
    if (!Number.isFinite(week) || !moduleId || notFound) return;
    if (module?.kind === "project") {
      setLastCourseworkVisit(week, moduleId, "project");
    }
  }, [week, moduleId, notFound, module]);

  if (!Number.isFinite(week) || !moduleId) {
    return (
      <EmptyWorkspaceScreen title="Invalid link">
        <p>
          This URL is missing a valid week or module id.{" "}
          <WorkspacePlaceholderLink href="/weekly-plan">
            Back to Weekly Plan
          </WorkspacePlaceholderLink>
        </p>
      </EmptyWorkspaceScreen>
    );
  }

  if (!notFound && module && module.kind !== "project") {
    return (
      <EmptyWorkspaceScreen title="Not a project module">
        <p>
          This workspace is for{" "}
          <strong className="font-medium text-neutral-700">project</strong>{" "}
          modules only. This item is a{" "}
          <strong className="font-medium text-neutral-700">
            {module.kind.replace("_", " ")}
          </strong>
          .
        </p>
        <p>
          <WorkspacePlaceholderLink href="/weekly-plan">
            Go to Weekly Plan
          </WorkspacePlaceholderLink>
        </p>
      </EmptyWorkspaceScreen>
    );
  }

  if (notFound) {
    return (
      <EmptyWorkspaceScreen title="No saved module">
        <p>
          This module isn&apos;t in your saved week data. Generate the week on{" "}
          <Link href="/weekly-plan" className={inlineLinkClass}>
            Weekly Plan
          </Link>{" "}
          first, then open a project from the timeline.
        </p>
        <p>
          <WorkspacePlaceholderLink href="/weekly-plan">
            Go to Weekly Plan
          </WorkspacePlaceholderLink>
        </p>
      </EmptyWorkspaceScreen>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50/50">
      <AppNav />
      <div className="flex shrink-0 items-center justify-center border-b border-neutral-100 bg-white px-4 py-1.5">
        <span className="text-[10px] font-medium tracking-wide text-neutral-400">
          Project workspace
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex min-h-0 flex-1"
      >
        <div className="w-[42%] border-r border-neutral-100 bg-white">
          <LectureChatPanel
            workspace="project"
            week={week}
            moduleId={moduleId}
            moduleTitle={module?.title ?? ""}
            messages={messages}
            sendMessage={sendMessage}
            isBusy={isBusy}
            streamingContent={streamingContent}
            agentStatus={agentStatus}
          />
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-white">
          <LectureContentPanel
            workspace="project"
            week={week}
            courseTopic={syllabusTopic}
            module={module}
            moduleNeighbors={moduleNeighbors}
          />
        </div>
      </motion.div>
    </div>
  );
}
