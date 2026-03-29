"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import LectureChatPanel from "@/components/lecture-studio/LectureChatPanel";
import LectureContentPanel from "@/components/lecture-studio/LectureContentPanel";
import { useModuleStudio } from "@/hooks/useModuleStudio";
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

  if (!Number.isFinite(week) || !moduleId) {
    return (
      <div className="flex h-screen items-center justify-center bg-white px-6">
        <p className="text-sm text-neutral-600">
          Invalid project link.{" "}
          <Link href="/weekly-plan" className="text-neutral-900 underline">
            Back to Weekly Plan
          </Link>
        </p>
      </div>
    );
  }

  if (!notFound && module && module.kind !== "project") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <p className="max-w-md text-sm text-neutral-600">
          This link is for <strong>project</strong> modules only. This item is
          a <strong>{module.kind.replace("_", " ")}</strong>.
        </p>
        <Link
          href="/weekly-plan"
          className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-800"
        >
          ← Weekly Plan
        </Link>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <p className="max-w-md text-sm text-neutral-600">
          This module isn&apos;t in your saved week data. Generate the week on{" "}
          <Link
            href="/weekly-plan"
            className="font-medium text-neutral-900 underline"
          >
            Weekly Plan
          </Link>{" "}
          first, then open a project from the timeline.
        </p>
        <Link
          href="/weekly-plan"
          className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-800"
        >
          ← Weekly Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-100 bg-white px-4 py-2">
        <Link
          href="/weekly-plan"
          className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-800"
        >
          ← Weekly Plan
        </Link>
        <span className="shrink-0 text-[10px] font-medium tracking-wide text-neutral-400">
          Project workspace
        </span>
      </header>

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
          />
        </div>
      </motion.div>
    </div>
  );
}
