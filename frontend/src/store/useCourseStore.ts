import { create } from "zustand";
import type {
  AgentStatus,
  AppPhase,
  Message,
  PlanState,
  Week,
} from "@/types/course";
import { streamPlanRequest, uploadSyllabusFile, uploadImageFile, exportSyllabus } from "@/lib/api";
import type { ImageAttachment } from "@/types/course";
import { clearCoursePlannerSnapshot } from "@/lib/coursePlannerPersistence";
import { useWeekModularStore } from "@/store/useWeekModularStore";
import type { Syllabus } from "@/types/syllabus";

const TITLE_LOWER = new Set([
  "a","an","the","and","but","or","nor","for","yet","so",
  "in","on","at","to","by","of","up","as","is","if","it",
  "vs","via","from","into","with","over","upon",
]);

function capitalizeSegment(segment: string): string {
  const lower = segment.toLowerCase();
  if (!lower) return "";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCaseWord(word: string, wordIndex: number): string {
  const hasHyphen = word.includes("-");
  const segments = word.split("-");

  if (hasHyphen) {
    return segments.map((seg) => capitalizeSegment(seg)).join("-");
  }

  const lower = word.toLowerCase();
  if (wordIndex > 0 && TITLE_LOWER.has(lower)) {
    return lower;
  }
  return capitalizeSegment(word);
}

function toTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((word, i) => titleCaseWord(word, i))
    .join(" ");
}

export function emptyPlanState(topic = ""): PlanState {
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
    image_attachments: [],
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
  image?: ImageAttachment;
}

export interface CourseStore {
  phase: AppPhase;
  planState: PlanState;
  messages: Message[];
  agentStatus: AgentStatus;
  streamingContent: string;
  isComplete: boolean;
  isExporting: boolean;
  pendingAttachments: PendingAttachment[];
  /** True after a successful export to weekly plan; cleared when the syllabus is edited again. */
  hasExportedToWeekly: boolean;

  setTopic: (topic: string) => void;
  /** Update course title in UI + persistence only (e.g. My Classes rename); does not reset planning or send messages. */
  updatePlanTopicLabel: (topic: string) => void;
  sendMessage: (text: string) => Promise<void>;
  uploadSyllabus: (file: File) => Promise<void>;
  uploadImage: (file: File) => Promise<void>;
  removePendingAttachment: (index: number) => void;
  clearIsNewFlags: () => void;
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
  hasExportedToWeekly: false,

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

  uploadImage: async (file: File) => {
    try {
      const img = await uploadImageFile(file);
      set((s) => ({
        pendingAttachments: [
          ...s.pendingAttachments,
          { name: file.name, text: "", image: img },
        ],
      }));
    } catch (err) {
      console.error("Failed to upload image:", err);
    }
  },

  removePendingAttachment: (index: number) => {
    set((s) => ({
      pendingAttachments: s.pendingAttachments.filter((_, i) => i !== index),
    }));
  },

  clearIsNewFlags: () => {
    set((s) => ({
      planState: {
        ...s.planState,
        course_plan: {
          weeks: s.planState.course_plan.weeks.map((w) => ({ ...w, is_new: false })),
        },
      },
    }));
  },

  setTopic: (topic: string) => {
    const titled = toTitleCase(topic);
    set({ phase: "planning", planState: emptyPlanState(titled) });
    get().sendMessage(`I want to learn about: ${titled}`);
  },

  updatePlanTopicLabel: (topic: string) => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    set((s) => ({
      planState: { ...s.planState, topic: trimmed },
    }));
  },

  sendMessage: async (text: string) => {
    const { planState, messages, agentStatus, pendingAttachments } = get();
    if (agentStatus !== "idle") return;

    const attachmentNames = pendingAttachments.map((a) => a.name);
    const attachmentTexts = pendingAttachments.filter((a) => a.text).map((a) => a.text);
    const attachmentImages = pendingAttachments
      .filter((a) => a.image)
      .map((a) => a.image!);

    let stateWithAttachments: PlanState = planState;
    if (attachmentTexts.length > 0 || attachmentImages.length > 0) {
      stateWithAttachments = {
        ...planState,
        ...(attachmentTexts.length > 0
          ? { prior_syllabi: [...planState.prior_syllabi, ...attachmentTexts] }
          : {}),
        ...(attachmentImages.length > 0
          ? { image_attachments: [...planState.image_attachments, ...attachmentImages] }
          : {}),
      };
    }

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

        assistantMsg.content =
          data.agent_message || get().streamingContent || "";

        set((s) => {
          const invalidateWeekly = s.hasExportedToWeekly;
          if (invalidateWeekly) {
            useWeekModularStore.getState().clearWeeklyWorkspace();
          }
          return {
            planState: updatedState,
            messages: [...s.messages, { ...assistantMsg }],
            agentStatus: "updating_plan",
            isComplete: invalidateWeekly ? false : data.is_complete,
            phase: invalidateWeekly
              ? "planning"
              : data.is_complete
                ? "complete"
                : s.phase,
            hasExportedToWeekly: invalidateWeekly ? false : s.hasExportedToWeekly,
          };
        });

        setTimeout(() => get().clearIsNewFlags(), 2500);
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
    set({ isExporting: true, phase: "complete", isComplete: true });

    try {
      const exportData = await exportSyllabus(planState);

      const topicsByWeek = new Map(
        planState.course_plan.weeks.map((w) => [w.week, w.topics]),
      );

      const syllabus: Syllabus = {
        topic: (exportData.topic as string) || planState.topic,
        user_profile: {
          background: planState.user_profile.background,
          goals: planState.user_profile.goals,
          constraints: planState.user_profile.constraints,
          learning_style: planState.user_profile.learning_style,
          rigor_level: planState.user_profile.rigor_level,
        },
        course_plan: {
          weeks: ((exportData.weeks as Array<Record<string, unknown>>) ?? []).map((ew) => ({
            week: ew.week as number,
            title: ew.title as string,
            topics: topicsByWeek.get(ew.week as number) ?? [],
            has_homework: ew.has_homework as boolean,
            assessment: (ew.assessment as string | null) ?? null,
          })),
        },
      };

      useWeekModularStore.getState().setSyllabus(syllabus);
      set({ phase: "weekly_plan", isExporting: false, hasExportedToWeekly: true });
    } catch (err) {
      console.error("Export failed:", err);
      set({ isExporting: false });
    }
  },

  reset: () => {
    clearCoursePlannerSnapshot();
    set({
      phase: "topic_input",
      planState: emptyPlanState(),
      messages: [],
      agentStatus: "idle",
      streamingContent: "",
      isComplete: false,
      isExporting: false,
      pendingAttachments: [],
      hasExportedToWeekly: false,
    });
  },
}));
