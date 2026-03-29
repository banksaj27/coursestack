"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useModuleProgress } from "@/hooks/useModuleAssessmentCompletion";
import { setLectureModuleComplete } from "@/lib/moduleAssessmentCompletion";
import { motion } from "framer-motion";
import AppNav from "@/components/AppNav";
import {
  EmptyWorkspaceScreen,
  WorkspacePlaceholderLink,
  inlineLinkClass,
} from "@/components/shared/EmptyWorkspacePlaceholder";
import LectureChatPanel from "@/components/lecture-studio/LectureChatPanel";
import LectureContentPanel from "@/components/lecture-studio/LectureContentPanel";
import { useLectureNotesBootstrap } from "@/hooks/useLectureNotesBootstrap";
import { useLectureStudio } from "@/hooks/useLectureStudio";
import { useWeekModuleNeighbors } from "@/hooks/useWeekModuleNeighbors";
import { setLastCourseworkVisit } from "@/lib/courseworkNavigation";
import { hydrateWeekWorkspace } from "@/lib/hydrateWeekWorkspace";

export default function LectureStudioPage() {
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
    refreshModuleFromPack,
    appendAssistantMessage,
  } = useLectureStudio(week, moduleId);

  const {
    notesProgress,
    notesError,
    notesGenerating,
    retryLectureNotes,
  } = useLectureNotesBootstrap(
    week,
    moduleId,
    module,
    notFound,
    refreshModuleFromPack,
    appendAssistantMessage,
  );

  const moduleNeighbors = useWeekModuleNeighbors(week, moduleId, module);
  const lectureProgress = useModuleProgress(week, moduleId);

  useEffect(() => {
    if (!Number.isFinite(week) || !moduleId || notFound) return;
    if (module?.kind === "lecture") {
      setLastCourseworkVisit(week, moduleId, "lecture");
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

  if (!notFound && module && module.kind !== "lecture") {
    return (
      <EmptyWorkspaceScreen title="Not a lecture module">
        <p>
          This workspace is for{" "}
          <strong className="font-medium text-neutral-700">lecture</strong>{" "}
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
          first, then open a lecture from the timeline.
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex min-h-0 flex-1"
      >
        <div className="w-[42%] border-r border-neutral-100 bg-background dark:border-neutral-700">
          <LectureChatPanel
            workspace="lecture"
            week={week}
            moduleId={moduleId}
            moduleTitle={module?.title ?? ""}
            messages={messages}
            sendMessage={sendMessage}
            isBusy={isBusy || notesGenerating}
            streamingContent={streamingContent}
            agentStatus={agentStatus}
          />
        </div>
        <div className="min-w-0 flex-1">
          <LectureContentPanel
            workspace="lecture"
            week={week}
            courseTopic={syllabusTopic}
            module={module}
            notesGenerating={notesGenerating}
            notesProgress={notesProgress}
            notesError={notesError}
            onRetryLectureNotes={retryLectureNotes}
            moduleNeighbors={moduleNeighbors}
            lectureWorkspaceBar={{
              isComplete: lectureProgress.lectureComplete,
              onToggleComplete: () =>
                setLectureModuleComplete(
                  week,
                  moduleId,
                  !lectureProgress.lectureComplete,
                ),
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
