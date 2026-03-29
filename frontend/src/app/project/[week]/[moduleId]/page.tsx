"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
import ProjectSubmissionPanel from "@/components/project/ProjectSubmissionPanel";
import { useGradedWorkspaceBootstrap } from "@/hooks/useGradedWorkspaceBootstrap";
import { useModuleStudio } from "@/hooks/useModuleStudio";
import { setLastCourseworkVisit } from "@/lib/courseworkNavigation";
import { hydrateWeekWorkspace } from "@/lib/hydrateWeekWorkspace";
import { scaffoldProject, type ScaffoldResult } from "@/lib/projectScaffoldApi";

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

  useGradedWorkspaceBootstrap(week, moduleId, module, notFound, sendMessage);

  const moduleNeighbors = useWeekModuleNeighbors(week, moduleId, module);

  const [scaffolding, setScaffolding] = useState(false);
  const [scaffoldResult, setScaffoldResult] = useState<ScaffoldResult | null>(null);
  const [scaffoldError, setScaffoldError] = useState<string | null>(null);

  const hasDeliverables = !!(module?.body_md && /^={3,}\s+.+\s+={3,}/m.test(module.body_md));

  const handleScaffold = useCallback(async () => {
    if (!module?.body_md) return;
    setScaffolding(true);
    setScaffoldError(null);
    setScaffoldResult(null);
    try {
      const name = (module.title || "project").replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
      const result = await scaffoldProject(module.body_md, name);
      setScaffoldResult(result);
    } catch (err) {
      setScaffoldError(err instanceof Error ? err.message : String(err));
    } finally {
      setScaffolding(false);
    }
  }, [module]);

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
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppNav />
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-100 bg-background px-4 py-1.5 dark:border-neutral-700 sm:px-6">
        <span className="text-[10px] font-medium tracking-wide text-neutral-400">
          Project workspace
        </span>

        <div className="flex items-center gap-2">
          {scaffoldResult && scaffoldResult.files.length > 0 ? (
            <span className="text-[10px] font-medium text-emerald-700" title={scaffoldResult.root ?? undefined}>
              {scaffoldResult.files.length} file{scaffoldResult.files.length !== 1 ? "s" : ""} created
              {scaffoldResult.root ? ` → ${scaffoldResult.root}` : ""}
            </span>
          ) : null}
          {scaffoldResult && scaffoldResult.files.length === 0 ? (
            <span className="text-[10px] font-medium text-amber-600">
              {scaffoldResult.message}
            </span>
          ) : null}
          {scaffoldError ? (
            <span className="text-[10px] font-medium text-red-600 max-w-[12rem] truncate" title={scaffoldError}>
              {scaffoldError}
            </span>
          ) : null}
          {hasDeliverables ? (
            <button
              type="button"
              onClick={() => void handleScaffold()}
              disabled={scaffolding || isBusy}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:bg-transparent dark:text-neutral-100 dark:hover:bg-white/10"
            >
              {scaffolding ? "Creating…" : "Create project files"}
            </button>
          ) : null}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex min-h-0 flex-1"
      >
        <div className="w-[42%] border-r border-neutral-100 bg-background dark:border-neutral-700">
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <div className="min-h-[200px] flex-1 overflow-hidden">
            <LectureContentPanel
              workspace="project"
              week={week}
              courseTopic={syllabusTopic}
              module={module}
              moduleNeighbors={moduleNeighbors}
            />
          </div>
          {module?.body_md && module.body_md.trim().length > 0 ? (
            <ProjectSubmissionPanel
              bodyMd={module.body_md}
              projectTitle={module.title}
              courseTopic={syllabusTopic}
            />
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
