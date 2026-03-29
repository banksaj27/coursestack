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
import ProblemSetHouseRulesPanel from "@/components/lecture-studio/ProblemSetHouseRulesPanel";
import { useModuleProgress } from "@/hooks/useModuleAssessmentCompletion";
import { useModuleStudio } from "@/hooks/useModuleStudio";
import { useProblemSetBootstrap } from "@/hooks/useProblemSetBootstrap";
import { effectiveAssessmentTotalPoints } from "@/lib/gradedAssessmentDefaults";
import { setProblemSetPdfGrade } from "@/lib/moduleAssessmentCompletion";
import { gradeProblemSetPdf } from "@/lib/problemSetGradeApi";
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
    refreshModuleFromPack,
    appendAssistantMessage,
  } = useModuleStudio(week, moduleId);

  const {
    problemSetProgress,
    problemSetError,
    problemSetGenerating,
    retryProblemSet,
  } = useProblemSetBootstrap(
    week,
    moduleId,
    module,
    notFound,
    refreshModuleFromPack,
    appendAssistantMessage,
  );

  const moduleNeighbors = useWeekModuleNeighbors(week, moduleId, module);
  const progress = useModuleProgress(week, moduleId);

  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const hasGradedAttempt = progress.graded != null;

  useEffect(() => {
    if (hasGradedAttempt) {
      setShowAnswerKey(true);
    }
  }, [hasGradedAttempt]);

  const handlePdfSelected = useCallback(
    async (file: File) => {
      const m = module;
      if (!m || m.kind !== "problem_set") return;
      if (!file.type.includes("pdf")) {
        setGradeError("Please upload a PDF file.");
        return;
      }
      const sol = (m.solution_md ?? "").trim();
      if (!sol) {
        setGradeError(
          "Answer key is not available yet. Wait for generation to finish or regenerate the problem set.",
        );
        return;
      }
      setGradeError(null);
      setGrading(true);
      try {
        const r = await gradeProblemSetPdf(file, {
          syllabus_topic: syllabusTopic,
          module_title: m.title,
          body_md: m.body_md,
          solution_md: sol,
          assessment_total_points: effectiveAssessmentTotalPoints(m),
          graded_item_points: m.graded_item_points ?? [],
        });
        setProblemSetPdfGrade(week, moduleId, r.score, r.maxScore, r.feedbackMd);
        setShowAnswerKey(true);
      } catch (e) {
        setGradeError(e instanceof Error ? e.message : String(e));
      } finally {
        setGrading(false);
      }
    },
    [module, moduleId, syllabusTopic, week],
  );

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

  const canSubmitPdf =
    Boolean(module?.body_md?.trim()) &&
    Boolean((module?.solution_md ?? "").trim()) &&
    !problemSetGenerating;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppNav />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex min-h-0 flex-1"
      >
        {module ? (
          <>
            <div className="w-[42%] border-r border-neutral-100 bg-background dark:border-neutral-700">
              <LectureChatPanel
                workspace="problem_set"
                week={week}
                moduleId={moduleId}
                moduleTitle={module?.title ?? ""}
                messages={messages}
                sendMessage={sendMessage}
                isBusy={isBusy || problemSetGenerating}
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
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
              <LectureContentPanel
                workspace="problem_set"
                week={week}
                courseTopic={syllabusTopic}
                module={module}
                moduleNeighbors={moduleNeighbors}
                problemSetGenerating={problemSetGenerating}
                problemSetProgress={problemSetProgress}
                problemSetError={problemSetError}
                onRetryProblemSet={retryProblemSet}
                gradedWorkspaceBar={{
                  completedScore: progress.graded,
                  hasGradedAttempt,
                }}
                problemSetBar={{
                  grading,
                  gradeError,
                  feedbackMd: progress.graded?.feedbackMd ?? null,
                  hasAnswerKey: Boolean((module.solution_md ?? "").trim()),
                  showAnswerKey,
                  onToggleAnswerKey: () => setShowAnswerKey((v) => !v),
                  onPdfSelected: handlePdfSelected,
                  hasGradedAttempt,
                  canSubmitPdf,
                }}
              />
            </div>
          </>
        ) : null}
      </motion.div>
    </div>
  );
}
