"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import syllabusData from "@/data/syllabus.json";
import { getGlobalFormatInstructions } from "@/lib/weekFormatInstructions";
import { getProblemSetGlobalRules } from "@/lib/problemSetGlobalRules";
import { needsFullProblemSetBodyGeneration } from "@/lib/needsFullModuleBodyGeneration";
import { streamProblemSetPipeline } from "@/lib/problemSetPipelineApi";
import {
  loadModularWeekPack,
  patchModuleInWeekPack,
} from "@/lib/weekModularPersistence";
import { defaultMaxHistoryMessages } from "@/lib/weekSummaryStorage";
import { weekSummariesForApiPayload } from "@/lib/weekSummaryCache";
import { useWeekModularStore } from "@/store/useWeekModularStore";
import type { LectureStudioStatePayload } from "@/types/lectureStudio";
import type { Syllabus } from "@/types/syllabus";
import type { WeekModule } from "@/types/weekModular";

const syllabus = syllabusData as Syllabus;

export type ProblemSetProgressUI = {
  step: string;
  index: number;
  total: number;
  label: string;
} | null;

export function useProblemSetBootstrap(
  week: number,
  moduleId: string,
  module: WeekModule | null,
  notFound: boolean,
  refreshModuleFromPack: () => void,
  appendAssistantMessage: (content: string) => void,
) {
  const [problemSetProgress, setProblemSetProgress] =
    useState<ProblemSetProgressUI>(null);
  const [problemSetError, setProblemSetError] = useState<string | null>(null);
  const [problemSetGenerating, setProblemSetGenerating] = useState(false);
  const inFlightRef = useRef(false);

  const runPipeline = useCallback(async () => {
    const m = loadModularWeekPack(week)?.generated.modules.find(
      (x) => x.id === moduleId,
    );
    if (!m || m.kind !== "problem_set") return;
    if (!needsFullProblemSetBodyGeneration(m.body_md, m.solution_md)) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setProblemSetGenerating(true);
    setProblemSetError(null);
    setProblemSetProgress({
      step: "starting",
      index: 0,
      total: 0,
      label: "Starting problem set…",
    });

    const maxConv = defaultMaxHistoryMessages();
    const payload: LectureStudioStatePayload = {
      syllabus,
      selected_week: week,
      module: m,
      conversation_history: [],
      week_summaries: weekSummariesForApiPayload(),
      global_format_instructions: getGlobalFormatInstructions(),
      problem_set_global_instructions: getProblemSetGlobalRules(),
      ...(maxConv !== undefined ? { max_conversation_messages: maxConv } : {}),
    };

    try {
      await streamProblemSetPipeline(payload, {
        onProgress: (p) => setProblemSetProgress(p),
        onModuleUpdate: (data) => {
          const merged = {
            ...data.module,
            id: moduleId,
            kind: "problem_set" as const,
          };
          patchModuleInWeekPack(week, moduleId, merged);
          useWeekModularStore.getState().syncWeekFromPackIfActive(week);
          refreshModuleFromPack();
          appendAssistantMessage(data.agent_message);
        },
        onError: (msg) => setProblemSetError(msg),
        onDone: () => {
          setProblemSetGenerating(false);
          setProblemSetProgress(null);
        },
      });
    } finally {
      inFlightRef.current = false;
    }
  }, [week, moduleId, refreshModuleFromPack, appendAssistantMessage]);

  useEffect(() => {
    if (notFound || !module || module.kind !== "problem_set") return;
    if (!needsFullProblemSetBodyGeneration(module.body_md, module.solution_md))
      return;
    void runPipeline();
  }, [notFound, module, module?.id, module?.body_md, module?.solution_md, runPipeline]);

  return {
    problemSetProgress,
    problemSetError,
    problemSetGenerating,
    retryProblemSet: runPipeline,
  };
}
