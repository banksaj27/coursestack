"use client";

import { useCallback, useEffect, useState } from "react";
import syllabusData from "@/data/syllabus.json";
import { getGlobalFormatInstructions } from "@/lib/weekFormatInstructions";
import { streamLectureStudioRequest } from "@/lib/lectureStudioApi";
import {
  loadLectureStudioMessages,
  saveLectureStudioMessages,
} from "@/lib/lectureStudioPersistence";
import {
  loadModularWeekPack,
  patchModuleInWeekPack,
} from "@/lib/weekModularPersistence";
import { defaultMaxHistoryMessages } from "@/lib/weekSummaryStorage";
import { getProblemSetGlobalRules } from "@/lib/problemSetGlobalRules";
import { getQuizGlobalRules } from "@/lib/quizGlobalRules";
import { weekSummariesForApiPayload } from "@/lib/weekSummaryCache";
import { useWeekModularStore } from "@/store/useWeekModularStore";
import type { Message } from "@/types/course";
import type { LectureStudioStatePayload } from "@/types/lectureStudio";
import type { Syllabus } from "@/types/syllabus";
import type { WeekModule } from "@/types/weekModular";

const syllabus = syllabusData as Syllabus;

let counter = 0;
function makeId() {
  return `ms-${Date.now()}-${++counter}`;
}

function moduleContentChanged(before: WeekModule, after: WeekModule): boolean {
  return (
    before.title !== after.title ||
    (before.one_line_summary ?? "") !== (after.one_line_summary ?? "") ||
    before.summary !== after.summary ||
    before.body_md !== after.body_md ||
    before.estimated_minutes !== after.estimated_minutes ||
    (before.exam_specific_rules ?? "") !== (after.exam_specific_rules ?? "") ||
    before.assessment_total_points !== after.assessment_total_points ||
    JSON.stringify(before.graded_item_points ?? []) !==
      JSON.stringify(after.graded_item_points ?? [])
  );
}

function normalizeModule(
  m: WeekModule,
  preserveId: string,
  preserveKind: WeekModule["kind"],
): WeekModule {
  const k = m.kind;
  const kind: WeekModule["kind"] =
    k === "project" ||
    k === "problem_set" ||
    k === "quiz" ||
    k === "exam" ||
    k === "lecture"
      ? k
      : preserveKind;
  return {
    ...m,
    id: preserveId,
    kind,
  };
}

type AgentStatus = "idle" | "thinking" | "streaming" | "updating";

export type ModuleStudioSendOptions = {
  /** When true, the user message is sent to the API but not shown or saved in chat. */
  hideUserMessage?: boolean;
};

/** Shared AI + persistence for single-module workspaces (lecture, problem set, etc.). */
export function useModuleStudio(week: number, moduleId: string) {
  const [module, setModule] = useState<WeekModule | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [streamingContent, setStreamingContent] = useState("");

  useEffect(() => {
    if (!Number.isFinite(week) || !moduleId) {
      setNotFound(true);
      setModule(null);
      setMessages([]);
      return;
    }
    const pack = loadModularWeekPack(week);
    const m = pack?.generated.modules.find((x) => x.id === moduleId) ?? null;
    if (!m) {
      setNotFound(true);
      setModule(null);
      setMessages([]);
      return;
    }
    setNotFound(false);
    setModule(m);
    setMessages(loadLectureStudioMessages(week, moduleId));
    setAgentStatus("idle");
    setStreamingContent("");
  }, [week, moduleId]);

  const sendMessage = useCallback(
    async (text: string, opts?: ModuleStudioSendOptions) => {
      const trimmed = text.trim();
      if (!trimmed || agentStatus !== "idle") return;
      const modSnap = module;
      if (!modSnap) return;

      const hideUser = Boolean(opts?.hideUserMessage);

      const { drainPendingAttachmentContext } = await import("@/lib/attachmentContext");
      const extra = drainPendingAttachmentContext();
      const textForApi = extra ? `${trimmed}${extra}` : trimmed;

      const snapshot = messages;
      const hist = snapshot.map((m) => ({ role: m.role, content: m.content }));
      const userMsg: Message = {
        id: makeId(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      const withUser = hideUser ? snapshot : [...snapshot, userMsg];
      if (!hideUser) {
        setMessages(withUser);
      }
      setAgentStatus("thinking");
      setStreamingContent("");

      const assistantMsg: Message = {
        id: makeId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      const maxConv = defaultMaxHistoryMessages();
      const payload: LectureStudioStatePayload = {
        syllabus,
        selected_week: week,
        module: modSnap,
        conversation_history: hist,
        week_summaries: weekSummariesForApiPayload(),
        global_format_instructions: getGlobalFormatInstructions(),
        ...(modSnap.kind === "problem_set"
          ? {
              problem_set_global_instructions: getProblemSetGlobalRules(),
            }
          : {}),
        ...(modSnap.kind === "quiz"
          ? {
              quiz_global_instructions: getQuizGlobalRules(),
            }
          : {}),
        ...(maxConv !== undefined ? { max_conversation_messages: maxConv } : {}),
      };

      await streamLectureStudioRequest(textForApi, payload, {
        onToken: (token) => {
          setStreamingContent((s) => s + token);
          setAgentStatus("streaming");
        },
        onModuleUpdate: (data) => {
          const next = normalizeModule(
            data.module as WeekModule,
            modSnap.id,
            modSnap.kind,
          );
          const merged =
            modSnap.kind === "exam"
              ? {
                  ...next,
                  exam_specific_rules:
                    next.exam_specific_rules ??
                    modSnap.exam_specific_rules ??
                    "",
                }
              : next;
          if (moduleContentChanged(modSnap, merged)) {
            setModule(merged);
            patchModuleInWeekPack(week, moduleId, merged);
            useWeekModularStore.getState().syncWeekFromPackIfActive(week);
            setAgentStatus("updating");
          } else {
            setAgentStatus("idle");
          }
          assistantMsg.content = data.agent_message;
          const finalMsgs = [...withUser, { ...assistantMsg }];
          setMessages(finalMsgs);
          saveLectureStudioMessages(week, moduleId, finalMsgs);
          setStreamingContent("");
        },
        onDone: () => {
          setAgentStatus("idle");
          setStreamingContent("");
        },
        onError: (error) => {
          console.error("Module studio stream error:", error);
          const errMsg: Message = {
            id: makeId(),
            role: "assistant",
            content: `Request failed (${error.message}). Check the backend and GOOGLE_API_KEY.`,
            timestamp: Date.now(),
          };
          const finalMsgs = [...withUser, errMsg];
          setMessages(finalMsgs);
          saveLectureStudioMessages(week, moduleId, finalMsgs);
          setAgentStatus("idle");
          setStreamingContent("");
        },
      });
    },
    [week, moduleId, module, messages, agentStatus],
  );

  const updateExamSpecificRules = useCallback(
    (rules: string) => {
      const m = module;
      if (!m || m.kind !== "exam") return;
      const next: WeekModule = { ...m, exam_specific_rules: rules };
      setModule(next);
      patchModuleInWeekPack(week, moduleId, next);
      useWeekModularStore.getState().syncWeekFromPackIfActive(week);
    },
    [week, moduleId, module],
  );

  const refreshModuleFromPack = useCallback(() => {
    const pack = loadModularWeekPack(week);
    const m = pack?.generated.modules.find((x) => x.id === moduleId) ?? null;
    setModule(m);
  }, [week, moduleId]);

  const appendAssistantMessage = useCallback(
    (content: string) => {
      const msg: Message = {
        id: makeId(),
        role: "assistant",
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => {
        const next = [...prev, msg];
        saveLectureStudioMessages(week, moduleId, next);
        return next;
      });
    },
    [week, moduleId],
  );

  return {
    syllabusTopic: syllabus.topic,
    module,
    messages,
    notFound,
    agentStatus,
    streamingContent,
    sendMessage,
    isBusy: agentStatus !== "idle",
    updateExamSpecificRules,
    refreshModuleFromPack,
    appendAssistantMessage,
  };
}
