import { create } from "zustand";
import type {
  AgentStatus,
  AppPhase,
  Message,
  PlanState,
  Week,
} from "@/types/course";
import { streamPlanRequest, uploadSyllabusFile, exportSyllabus } from "@/lib/api";

const TITLE_LOWER = new Set([
  "a","an","the","and","but","or","nor","for","yet","so",
  "in","on","at","to","by","of","up","as","is","if","it",
  "vs","via","from","into","with","over","upon",
]);

function toTitleCase(str: string): string {
  return str
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i === 0 || !TITLE_LOWER.has(lower)) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      return lower;
    })
    .join(" ");
}

function emptyPlanState(topic = ""): PlanState {
  return {
    topic,
    user_profile: {
      background: "",
      goals: [],
      constraints: {},
      learning_style: "",
      rigor_level: "",
    },
    course_plan: { weeks: [] },
    conversation_history: [],
    agent_phase: "understanding",
    prior_syllabi: [],
  };
}

function weekSignature(w: Week): string {
  return JSON.stringify({
    title: w.title,
    topics: w.topics,
    hw: w.has_homework,
    assessment: w.assessment,
  });
}

function diffWeeks(oldWeeks: Week[], newWeeks: Week[]): Week[] {
  const oldMap = new Map(
    oldWeeks.map((w) => [w.week, weekSignature(w)]),
  );
  return newWeeks.map((w) => {
    const oldSig = oldMap.get(w.week);
    const newSig = weekSignature(w);
    return { ...w, is_new: oldSig !== newSig };
  });
}

let msgCounter = 0;
function makeId() {
  return `msg-${Date.now()}-${++msgCounter}`;
}

interface PendingAttachment {
  name: string;
  text: string;
}

interface CourseStore {
  phase: AppPhase;
  planState: PlanState;
  messages: Message[];
  agentStatus: AgentStatus;
  streamingContent: string;
  isComplete: boolean;
  isExporting: boolean;
  pendingAttachments: PendingAttachment[];

  setTopic: (topic: string) => void;
  sendMessage: (text: string) => Promise<void>;
  uploadSyllabus: (file: File) => Promise<void>;
  removePendingAttachment: (index: number) => void;
  finalize: () => Promise<void>;
  reset: () => void;
}

export const useCourseStore = create<CourseStore>((set, get) => ({
  phase: "topic_input",
  planState: emptyPlanState(),
  messages: [],
  agentStatus: "idle",
  streamingContent: "",
  isComplete: false,
  isExporting: false,
  pendingAttachments: [],

  uploadSyllabus: async (file: File) => {
    try {
      const text = await uploadSyllabusFile(file);
      if (!text.trim()) return;
      set((s) => ({
        pendingAttachments: [...s.pendingAttachments, { name: file.name, text }],
      }));
    } catch (err) {
      console.error("Failed to upload syllabus:", err);
    }
  },

  removePendingAttachment: (index: number) => {
    set((s) => ({
      pendingAttachments: s.pendingAttachments.filter((_, i) => i !== index),
    }));
  },

  setTopic: (topic: string) => {
    const titled = toTitleCase(topic);
    set({ phase: "planning", planState: emptyPlanState(titled) });
    get().sendMessage(`I want to learn about: ${titled}`);
  },

  sendMessage: async (text: string) => {
    const { planState, messages, agentStatus, pendingAttachments } = get();
    if (agentStatus !== "idle") return;

    const attachmentNames = pendingAttachments.map((a) => a.name);
    const attachmentTexts = pendingAttachments.map((a) => a.text);

    const stateWithAttachments: PlanState = attachmentTexts.length > 0
      ? {
          ...planState,
          prior_syllabi: [...planState.prior_syllabi, ...attachmentTexts],
        }
      : planState;

    const userMsg: Message = {
      id: makeId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
      ...(attachmentNames.length > 0 ? { attachments: attachmentNames } : {}),
    };

    set({
      messages: [...messages, userMsg],
      agentStatus: "thinking",
      streamingContent: "",
      planState: stateWithAttachments,
      pendingAttachments: [],
    });

    const assistantMsg: Message = {
      id: makeId(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    await streamPlanRequest(text, stateWithAttachments, {
      onToken: (token) => {
        const current = get().streamingContent + token;
        set({ streamingContent: current, agentStatus: "streaming" });
      },
      onPlanUpdate: (data) => {
        const oldWeeks = get().planState.course_plan.weeks;
        const newWeeks = diffWeeks(oldWeeks, data.state.course_plan.weeks);
        const updatedState: PlanState = {
          ...data.state,
          course_plan: { weeks: newWeeks },
        };

        assistantMsg.content = data.agent_message;

        set((s) => ({
          planState: updatedState,
          messages: [...s.messages, { ...assistantMsg }],
          agentStatus: "updating_plan",
          isComplete: data.is_complete,
          phase: data.is_complete ? "complete" : s.phase,
        }));
      },
      onDone: () => {
        set({ agentStatus: "idle", streamingContent: "" });
      },
      onError: (error) => {
        console.error("Stream error:", error);
        const errorMsg: Message = {
          id: makeId(),
          role: "assistant",
          content: "Something went wrong. Please try again.",
          timestamp: Date.now(),
        };
        set((s) => ({
          messages: [...s.messages, errorMsg],
          agentStatus: "idle",
          streamingContent: "",
        }));
      },
    });
  },

  finalize: async () => {
    const { planState } = get();
    set({ isExporting: true });

    try {
      const exportData = await exportSyllabus(planState);

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "syllabus.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }

    set({ phase: "complete", isComplete: true, isExporting: false });
  },

  reset: () => {
    set({
      phase: "topic_input",
      planState: emptyPlanState(),
      messages: [],
      agentStatus: "idle",
      streamingContent: "",
      isComplete: false,
      isExporting: false,
      pendingAttachments: [],
    });
  },
}));
