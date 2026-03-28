import { create } from "zustand";
import type {
  AgentStatus,
  AppPhase,
  Message,
  PlanState,
  Week,
} from "@/types/course";
import { streamPlanRequest } from "@/lib/api";

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

interface CourseStore {
  phase: AppPhase;
  planState: PlanState;
  messages: Message[];
  agentStatus: AgentStatus;
  streamingContent: string;
  isComplete: boolean;

  setTopic: (topic: string) => void;
  sendMessage: (text: string) => Promise<void>;
  finalize: () => void;
  reset: () => void;
}

export const useCourseStore = create<CourseStore>((set, get) => ({
  phase: "topic_input",
  planState: emptyPlanState(),
  messages: [],
  agentStatus: "idle",
  streamingContent: "",
  isComplete: false,

  setTopic: (topic: string) => {
    const state = emptyPlanState(topic);
    set({ phase: "planning", planState: state });

    get().sendMessage(`I want to learn about: ${topic}`);
  },

  sendMessage: async (text: string) => {
    const { planState, messages, agentStatus } = get();
    if (agentStatus !== "idle") return;

    const userMsg: Message = {
      id: makeId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    set({
      messages: [...messages, userMsg],
      agentStatus: "thinking",
      streamingContent: "",
    });

    const assistantMsg: Message = {
      id: makeId(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    await streamPlanRequest(text, planState, {
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

  finalize: () => {
    const { planState } = get();
    const exportData = {
      topic: planState.topic,
      user_profile: planState.user_profile,
      course_plan: {
        weeks: planState.course_plan.weeks.map(({ is_new, ...w }) => w),
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "syllabus.json";
    a.click();
    URL.revokeObjectURL(url);

    set({ phase: "complete", isComplete: true });
  },

  reset: () => {
    set({
      phase: "topic_input",
      planState: emptyPlanState(),
      messages: [],
      agentStatus: "idle",
      streamingContent: "",
      isComplete: false,
    });
  },
}));
