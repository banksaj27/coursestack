"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWeekModuleNeighbors } from "@/hooks/useWeekModuleNeighbors";
import { motion } from "framer-motion";
import AppNav from "@/components/AppNav";
import GradedTestingModePanel from "@/components/graded/GradedTestingModePanel";
import {
  EmptyWorkspaceScreen,
  WorkspacePlaceholderLink,
  inlineLinkClass,
} from "@/components/shared/EmptyWorkspacePlaceholder";
import LectureChatPanel from "@/components/lecture-studio/LectureChatPanel";
import LectureContentPanel from "@/components/lecture-studio/LectureContentPanel";
import ProblemSetHouseRulesPanel from "@/components/lecture-studio/ProblemSetHouseRulesPanel";
import { useModuleProgress } from "@/hooks/useModuleAssessmentCompletion";
import { useModuleStudio } from "@/hooks/useModuleStudio";
import { clearGradedModuleAttempt } from "@/lib/moduleAssessmentCompletion";
import { setLastCourseworkVisit } from "@/lib/courseworkNavigation";
import { hydrateWeekWorkspace } from "@/lib/hydrateWeekWorkspace";
import { APPLY_PROBLEM_SET_RULES_MESSAGE } from "@/lib/problemSetStudioApply";

export default function ProblemSetWorkspacePage() {
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
  const progress = useModuleProgress(week, moduleId);
  const [testingMode, setTestingMode] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const hasGradedAttempt = Boolean(progress.graded);

  useEffect(() => {
    if (!Number.isFinite(week) || !moduleId || notFound) return;
    if (module?.kind === "problem_set") {
      setLastCourseworkVisit(week, moduleId, "problem_set");
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

  if (!notFound && module && module.kind !== "problem_set") {
    return (
      <EmptyWorkspaceScreen title="Not a problem set module">
        <p>
          This workspace is for{" "}
          <strong className="font-medium text-neutral-700">problem set</strong>{" "}
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
          first, then open a problem set from the timeline.
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
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50/50 dark:bg-neutral-950">
      <AppNav />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex min-h-0 flex-1"
      >
        {reviewMode && module && progress.graded ? (
          <GradedTestingModePanel
            week={week}
            moduleId={moduleId}
            module={module}
            mode="review"
            initialAnswers={progress.graded.answers}
            savedScore={{
              score: progress.graded.score,
              maxScore: progress.graded.maxScore,
            }}
            onExit={() => setReviewMode(false)}
          />
        ) : testingMode && module ? (
          <GradedTestingModePanel
            week={week}
            moduleId={moduleId}
            module={module}
            onExit={() => setTestingMode(false)}
          />
        ) : !testingMode && !reviewMode && module ? (
          <>
            <div className="w-[42%] border-r border-neutral-100 bg-white dark:bg-neutral-900">
              <LectureChatPanel
                workspace="problem_set"
                week={week}
                moduleId={moduleId}
                moduleTitle={module?.title ?? ""}
                messages={messages}
                sendMessage={sendMessage}
                isBusy={isBusy}
                streamingContent={streamingContent}
                agentStatus={agentStatus}
                belowHeaderSlot={
                  <ProblemSetHouseRulesPanel
                    disabled={isBusy}
                    onApplyRules={() =>
                      void sendMessage(APPLY_PROBLEM_SET_RULES_MESSAGE)
                    }
                  />
                }
              />
            </div>
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-white">
              <LectureContentPanel
                workspace="problem_set"
                week={week}
                courseTopic={syllabusTopic}
                module={module}
                moduleNeighbors={moduleNeighbors}
                gradedWorkspaceBar={{
                  onBeginTesting: () => setTestingMode(true),
                  onViewAnswers: () => setReviewMode(true),
                  onReattempt: () => {
                    clearGradedModuleAttempt(week, moduleId);
                    setReviewMode(false);
                  },
                  completedScore: progress.graded,
                  hasGradedAttempt,
                }}
              />
            </div>
          </>
        ) : null}
      </motion.div>
    </div>
  );
}
