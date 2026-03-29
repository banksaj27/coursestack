import { create } from "zustand";
import { buildInitialModularWeek } from "@/lib/buildInitialModularWeek";
import {
  MODULAR_BOOTSTRAP_API_MESSAGE,
  MODULAR_BOOTSTRAP_DISPLAY,
} from "@/lib/weekModularBootstrap";
import { getProblemSetGlobalRules } from "@/lib/problemSetGlobalRules";
import { getQuizGlobalRules } from "@/lib/quizGlobalRules";
import {
  ensureWeekFormatHydrated,
  getGlobalFormatInstructions,
} from "@/lib/weekFormatInstructions";
import { defaultMaxHistoryMessages } from "@/lib/weekSummaryStorage";
import {
  setWeekSummaryForWeek,
  weekSummariesForApiPayload,
} from "@/lib/weekSummaryCache";
import { clearAllCourseworkCaches } from "@/lib/courseworkNavigation";
import {
  loadModularWeekPack,
  saveModularWeekPack,
  clearAllModularWeekPacks,
} from "@/lib/weekModularPersistence";
import {
  clearWeekModularSnapshot,
  saveWeekModularSnapshot,
} from "@/lib/weekModularSyllabusPersistence";
import { clearAllWeekSummaries } from "@/lib/weekSummaryCache";
import { streamWeekModularRequest } from "@/lib/weekModularApi";
import type { Message } from "@/types/course";
import type { Syllabus } from "@/types/syllabus";
import type {
  WeekModularGenerated,
  WeekModularStatePayload,
  WeekModule,
} from "@/types/weekModular";

const emptySyllabus: Syllabus = {
  topic: "",
  user_profile: {
    background: "",
    goals: [],
    constraints: {},
    learning_style: "",
    rigor_level: "",
  },
  course_plan: { weeks: [] },
};

type AgentStatus = "idle" | "thinking" | "streaming" | "updating";

let msgCounter = 0;
function makeId() {
  return `wm-${Date.now()}-${++msgCounter}`;
}

function moduleSig(m: WeekModule): string {
  return JSON.stringify({
    id: m.id,
    kind: m.kind,
    title: m.title,
    oneLine: (m.one_line_summary ?? "").slice(0, 200),
    summary: m.summary,
    body: m.body_md.slice(0, 400),
    examRules:
      m.kind === "exam" ? (m.exam_specific_rules ?? "").slice(0, 300) : "",
    assessment_total_points: m.assessment_total_points ?? null,
    graded_item_points: m.graded_item_points ?? [],
  });
}

function diffModules(old: WeekModule[], next: WeekModule[]): WeekModule[] {
  const oldMap = new Map(old.map((m) => [m.id, moduleSig(m)]));
  return next.map((m) => ({
    ...m,
    is_new: !oldMap.has(m.id) || oldMap.get(m.id) !== moduleSig(m),
  }));
}

function normalizeModule(m: WeekModule): WeekModule {
  const k = m.kind;
  const kind: WeekModule["kind"] =
    k === "project" ||
    k === "problem_set" ||
    k === "quiz" ||
    k === "exam" ||
    k === "lecture"
      ? k
      : "lecture";
  return { ...m, kind };
}

/** Keep per-exam notes when the week AI regenerates modules (ids unchanged). */
function mergeExamSpecificRulesFromPrevious(
  prev: WeekModule[],
  next: WeekModule[],
): WeekModule[] {
  const prevById = new Map(prev.map((m) => [m.id, m]));
  return next.map((m) => {
    if (m.kind !== "exam") return m;
    const old = prevById.get(m.id);
    if (!old?.exam_specific_rules?.trim()) return m;
    return { ...m, exam_specific_rules: old.exam_specific_rules };
  });
}

const bootstrapCooldown = new Map<number, number>();
const BOOTSTRAP_COOLDOWN_MS = 4500;

interface WeekModularStore {
  syllabus: Syllabus;
  selectedWeek: number;
  generated: WeekModularGenerated;
  messages: Message[];
  agentStatus: AgentStatus;
  streamingContent: string;

  setSyllabus: (s: Syllabus) => void;
  /** Update syllabus topic for UI + snapshot only (e.g. My Classes rename); does not clear week packs. */
  updateSyllabusTopicLabel: (topic: string) => void;
  /** Restore syllabus + week selection from localStorage after refresh (does not clear packs). */
  applyPersistedSnapshot: (syllabus: Syllabus, selectedWeek: number) => void;
  /** Clear syllabus, all week packs, and summaries; use after course syllabus changes without re-export. */
  clearWeeklyWorkspace: () => void;
  /** Re-sync in-memory week from storage (e.g. after global format reset). */
  reloadCurrentWeekFromStorage: () => void;
  setSelectedWeek: (week: number) => void;
  sendMessage: (text: string, options?: { displayText?: string }) => Promise<void>;
  bootstrapModularWeek: () => Promise<void>;
  /** Reload current week from localStorage (call once on client mount). */
  rehydrateModularForSelectedWeek: () => void;
  /** Clear all saved weekly data and regenerate the current week from scratch. */
  resetWeeklyPlanAndRegenerate: () => Promise<void>;
  /** After Lecture Studio patches the week pack, refresh in-memory week if it matches. */
  syncWeekFromPackIfActive: (week: number) => void;
}

function toPayload(
  syllabus: Syllabus,
  selectedWeek: number,
  generated: WeekModularGenerated,
  conversation_history: { role: string; content: string }[],
): WeekModularStatePayload {
  ensureWeekFormatHydrated();
  const maxConv = defaultMaxHistoryMessages();
  return {
    syllabus,
    selected_week: selectedWeek,
    generated,
    conversation_history,
    week_summaries: weekSummariesForApiPayload(),
    global_format_instructions: getGlobalFormatInstructions(),
    problem_set_global_instructions: getProblemSetGlobalRules(),
    quiz_global_instructions: getQuizGlobalRules(),
    ...(maxConv !== undefined ? { max_conversation_messages: maxConv } : {}),
  };
}

function loadStateForWeek(syl: Syllabus, week: number): {
  generated: WeekModularGenerated;
  messages: Message[];
} {
  if (typeof window === "undefined") {
    return {
      generated: buildInitialModularWeek(syl, week),
      messages: [],
    };
  }
  const pack = loadModularWeekPack(week);
  if (pack) {
    return {
      generated: pack.generated,
      messages: pack.messages,
    };
  }
  return {
    generated: buildInitialModularWeek(syl, week),
    messages: [],
  };
}

export const useWeekModularStore = create<WeekModularStore>((set, get) => ({
  syllabus: emptySyllabus,
  selectedWeek: 1,
  generated: { modules: [], instructor_notes_md: "" },
  messages: [],
  agentStatus: "idle",
  streamingContent: "",

  setSyllabus: (s: Syllabus) => {
    if (typeof window !== "undefined") {
      clearAllModularWeekPacks();
      clearAllCourseworkCaches();
      clearAllWeekSummaries();
    }
    const firstWeek = s.course_plan.weeks[0]?.week ?? 1;
    set({
      syllabus: s,
      selectedWeek: firstWeek,
      generated: buildInitialModularWeek(s, firstWeek),
      messages: [],
      agentStatus: "idle",
      streamingContent: "",
    });
    if (typeof window !== "undefined") {
      saveWeekModularSnapshot(s, firstWeek);
    }
  },

  updateSyllabusTopicLabel: (topic: string) => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    set((s) => ({
      syllabus: { ...s.syllabus, topic: trimmed },
    }));
    const { syllabus, selectedWeek } = get();
    if (
      typeof window !== "undefined" &&
      syllabus.topic.trim() &&
      syllabus.course_plan.weeks.length > 0
    ) {
      saveWeekModularSnapshot(syllabus, selectedWeek);
    }
  },

  applyPersistedSnapshot: (syllabus: Syllabus, selectedWeek: number) => {
    const weeks = syllabus.course_plan.weeks;
    if (!weeks.length) return;
    const valid =
      weeks.find((w) => w.week === selectedWeek)?.week ?? weeks[0].week;
    const next = loadStateForWeek(syllabus, valid);
    set({
      syllabus,
      selectedWeek: valid,
      generated: next.generated,
      messages: next.messages,
      agentStatus: "idle",
      streamingContent: "",
    });
  },

  clearWeeklyWorkspace: () => {
    if (typeof window !== "undefined") {
      clearAllModularWeekPacks();
      clearAllCourseworkCaches();
      clearAllWeekSummaries();
      clearWeekModularSnapshot();
      bootstrapCooldown.clear();
    }
    set({
      syllabus: emptySyllabus,
      selectedWeek: 1,
      generated: buildInitialModularWeek(emptySyllabus, 1),
      messages: [],
      agentStatus: "idle",
      streamingContent: "",
    });
  },

  reloadCurrentWeekFromStorage: () => {
    if (typeof window === "undefined") return;
    ensureWeekFormatHydrated();
    const { syllabus, selectedWeek } = get();
    const next = loadStateForWeek(syllabus, selectedWeek);
    set({
      generated: next.generated,
      messages: next.messages,
      agentStatus: "idle",
      streamingContent: "",
    });
  },

  rehydrateModularForSelectedWeek: () => {
    if (typeof window === "undefined") return;
    const week = get().selectedWeek;
    const pack = loadModularWeekPack(week);
    if (!pack) return;
    set({
      generated: pack.generated,
      messages: pack.messages,
      agentStatus: "idle",
      streamingContent: "",
    });
  },

  syncWeekFromPackIfActive: (week: number) => {
    if (typeof window === "undefined") return;
    if (get().selectedWeek !== week) return;
    const pack = loadModularWeekPack(week);
    if (!pack) return;
    set({
      generated: pack.generated,
      agentStatus: "idle",
      streamingContent: "",
    });
  },

  setSelectedWeek: (week: number) => {
    const next = loadStateForWeek(get().syllabus, week);
    set({
      selectedWeek: week,
      generated: next.generated,
      messages: next.messages,
      agentStatus: "idle",
      streamingContent: "",
    });
    const { syllabus } = get();
    if (typeof window !== "undefined" && syllabus.topic.trim()) {
      saveWeekModularSnapshot(syllabus, week);
    }
  },

  resetWeeklyPlanAndRegenerate: async () => {
    if (get().agentStatus !== "idle") return;
    if (typeof window !== "undefined") {
      clearAllModularWeekPacks();
      clearAllCourseworkCaches();
      clearAllWeekSummaries();
      bootstrapCooldown.clear();
    }
    const { syllabus, selectedWeek } = get();
    const next = loadStateForWeek(syllabus, selectedWeek);
    set({
      generated: next.generated,
      messages: next.messages,
      agentStatus: "idle",
      streamingContent: "",
    });
    await get().bootstrapModularWeek();
  },

  bootstrapModularWeek: async () => {
    const { agentStatus, messages, selectedWeek, generated } = get();
    if (agentStatus !== "idle") return;
    if (messages.length > 0) return;
    if (generated.modules.length > 0) return;

    const now = Date.now();
    const last = bootstrapCooldown.get(selectedWeek) ?? 0;
    if (now - last < BOOTSTRAP_COOLDOWN_MS) return;
    bootstrapCooldown.set(selectedWeek, now);

    await get().sendMessage(MODULAR_BOOTSTRAP_API_MESSAGE, {
      displayText: MODULAR_BOOTSTRAP_DISPLAY,
    });
  },

  sendMessage: async (text: string, options?: { displayText?: string }) => {
    const displayText = options?.displayText ?? text;
    const useAgentStatusBubble =
      options?.displayText != null && options.displayText !== text;
    const {
      agentStatus,
      syllabus,
      selectedWeek,
      generated,
      messages,
    } = get();
    if (agentStatus !== "idle") return;

    const weekAtStart = selectedWeek;

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let statusStubId: string | null = null;
    const openingMessage: Message = useAgentStatusBubble
      ? {
          id: (statusStubId = makeId()),
          role: "assistant",
          content: displayText,
          timestamp: Date.now(),
        }
      : {
          id: makeId(),
          role: "user",
          content: displayText,
          timestamp: Date.now(),
        };

    const stripStatusStub = (list: Message[]) =>
      statusStubId
        ? list.filter((m) => m.id !== statusStubId)
        : list;

    set({
      messages: [...messages, openingMessage],
      agentStatus: "thinking",
      streamingContent: "",
    });

    const assistantMsg: Message = {
      id: makeId(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    const statePayload = toPayload(
      syllabus,
      selectedWeek,
      generated,
      history,
    );

    await streamWeekModularRequest(text, statePayload, {
      onToken: (_token) => {
        if (get().selectedWeek !== weekAtStart) return;
        // Do not stream pre-marker tokens into chat: full module text belongs on the
        // timeline only; streaming long drafts here clutters the conversation.
        set((s) => ({
          messages: stripStatusStub(s.messages),
          streamingContent: "",
          agentStatus: "streaming",
        }));
        statusStubId = null;
      },
      onModulesUpdate: (data) => {
        if (get().selectedWeek !== weekAtStart) return;
        assistantMsg.content = data.agent_message;
        if (data.timeline_parse_ok === false) {
          console.warn(
            "week-modular: timeline unchanged (missing or invalid WEEK_MODULES_UPDATE block)",
          );
        }
        if (data.week_context_summary) {
          setWeekSummaryForWeek(weekAtStart, data.week_context_summary);
        }
        const rawMods = data.generated.modules.map(normalizeModule);
        const mergedMods = mergeExamSpecificRulesFromPrevious(
          get().generated.modules,
          rawMods,
        );
        const withNew = diffModules(get().generated.modules, mergedMods);
        set((s) => ({
          generated: {
            modules: withNew,
            instructor_notes_md: data.generated.instructor_notes_md,
          },
          messages: [...stripStatusStub(s.messages), { ...assistantMsg }],
          agentStatus: "updating",
          streamingContent: "",
        }));
        statusStubId = null;
        const st = get();
        if (st.selectedWeek === weekAtStart) {
          saveModularWeekPack(weekAtStart, st.generated, st.messages);
        }
      },
      onDone: () => {
        set((s) => {
          if (s.selectedWeek !== weekAtStart) return {};
          return { agentStatus: "idle", streamingContent: "" };
        });
      },
      onError: (error) => {
        console.error("Week modular stream error:", error);
        if (get().selectedWeek !== weekAtStart) return;
        const errMsg: Message = {
          id: makeId(),
          role: "assistant",
          content:
            "Something went wrong. Try restarting the backend server.",
          timestamp: Date.now(),
        };
        set((s) => ({
          messages: [...stripStatusStub(s.messages), errMsg],
          agentStatus: "idle",
          streamingContent: "",
        }));
        statusStubId = null;
        const st2 = get();
        if (st2.selectedWeek === weekAtStart) {
          saveModularWeekPack(weekAtStart, st2.generated, st2.messages);
        }
      },
    });
  },
}));
