"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import syllabusData from "@/data/syllabus.json";
import { getGlobalFormatInstructions } from "@/lib/weekFormatInstructions";
import { streamLectureNotesPipeline } from "@/lib/lectureNotesPipelineApi";
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

/** Weekly Plan lecture stubs are ~500–2,500 words; full chapters are usually much longer. */
function needsFullLectureGeneration(body: string): boolean {
  const t = body.trim();
  if (t.length < 120) return true;
  const words = t.split(/\s+/).filter(Boolean).length;
  return words < 3200;
}

export type LectureNotesProgressUI = {
  step: string;
  index: number;
  total: number;
  label: string;
} | null;

export function useLectureNotesBootstrap(
  week: number,
  moduleId: string,
  module: WeekModule | null,
  notFound: boolean,
  refreshModuleFromPack: () => void,
  appendAssistantMessage: (content: string) => void,
) {
  const [notesProgress, setNotesProgress] = useState<LectureNotesProgressUI>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesGenerating, setNotesGenerating] = useState(false);
  const inFlightRef = useRef(false);

  const runPipeline = useCallback(async () => {
    const m = loadModularWeekPack(week)?.generated.modules.find(
      (x) => x.id === moduleId,
    );
    if (!m || m.kind !== "lecture") return;
    if (!needsFullLectureGeneration(m.body_md)) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setNotesGenerating(true);
    setNotesError(null);
    setNotesProgress({
      step: "starting",
      index: 0,
      total: 0,
      label: "Starting lecture notes…",
    });

    const maxConv = defaultMaxHistoryMessages();
    const payload: LectureStudioStatePayload = {
      syllabus,
      selected_week: week,
      module: m,
      conversation_history: [],
      week_summaries: weekSummariesForApiPayload(),
      global_format_instructions: getGlobalFormatInstructions(),
      ...(maxConv !== undefined ? { max_conversation_messages: maxConv } : {}),
    };

    try {
      await streamLectureNotesPipeline(payload, {
        onProgress: (p) => setNotesProgress(p),
        onModuleUpdate: (data) => {
          const merged = { ...data.module, id: moduleId, kind: "lecture" as const };
          patchModuleInWeekPack(week, moduleId, merged);
          useWeekModularStore.getState().syncWeekFromPackIfActive(week);
          refreshModuleFromPack();
          appendAssistantMessage(data.agent_message);
        },
        onError: (msg) => setNotesError(msg),
        onDone: () => {
          setNotesGenerating(false);
          setNotesProgress(null);
        },
      });
    } finally {
      inFlightRef.current = false;
    }
  }, [
    week,
    moduleId,
    refreshModuleFromPack,
    appendAssistantMessage,
  ]);

  useEffect(() => {
    if (notFound || !module || module.kind !== "lecture") return;
    if (!needsFullLectureGeneration(module.body_md)) return;
    void runPipeline();
  }, [notFound, module, module?.id, module?.body_md, runPipeline]);

  return {
    notesProgress,
    notesError,
    notesGenerating,
    /** Re-run if the stub is still short (e.g. after a failed attempt). */
    retryLectureNotes: runPipeline,
  };
}
