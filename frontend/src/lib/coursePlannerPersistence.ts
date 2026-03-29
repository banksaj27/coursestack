import type { StoreApi } from "zustand";
import type { CourseStore } from "@/store/useCourseStore";
import type {
  AppPhase,
  Message,
  PlanState,
} from "@/types/course";

const KEY = "yhack-course-planner-v1";

export type CoursePlannerSnapshot = {
  phase: AppPhase;
  planState: PlanState;
  messages: Message[];
  isComplete: boolean;
  hasExportedToWeekly: boolean;
};

function loadCoursePlannerSnapshot(): CoursePlannerSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<CoursePlannerSnapshot>;
    if (
      !p?.phase ||
      !p?.planState ||
      !Array.isArray(p?.messages) ||
      typeof p?.isComplete !== "boolean" ||
      typeof p?.hasExportedToWeekly !== "boolean"
    ) {
      return null;
    }
    return {
      phase: p.phase,
      planState: p.planState,
      messages: p.messages,
      isComplete: p.isComplete,
      hasExportedToWeekly: p.hasExportedToWeekly,
    };
  } catch {
    return null;
  }
}

function saveCoursePlannerSnapshot(s: CoursePlannerSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

export function clearCoursePlannerSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

let lastPersistedJson = "";
let didInit = false;

/** Load saved planner state, subscribe for future saves (once per session). */
export function initCoursePlannerPersistence(
  store: StoreApi<CourseStore>,
): void {
  if (typeof window === "undefined" || didInit) return;
  didInit = true;

  const snap = loadCoursePlannerSnapshot();
  if (snap) {
    store.setState({
      phase: snap.phase,
      planState: snap.planState,
      messages: snap.messages,
      isComplete: snap.isComplete,
      hasExportedToWeekly: snap.hasExportedToWeekly,
      agentStatus: "idle",
      streamingContent: "",
      isExporting: false,
      pendingAttachments: [],
    });
    lastPersistedJson = JSON.stringify({
      phase: snap.phase,
      planState: snap.planState,
      messages: snap.messages,
      isComplete: snap.isComplete,
      hasExportedToWeekly: snap.hasExportedToWeekly,
    });
  }

  store.subscribe((state) => {
    const payload: CoursePlannerSnapshot = {
      phase: state.phase,
      planState: state.planState,
      messages: state.messages,
      isComplete: state.isComplete,
      hasExportedToWeekly: state.hasExportedToWeekly,
    };
    const json = JSON.stringify(payload);
    if (json === lastPersistedJson) return;

    if (state.phase === "topic_input" && !state.planState.topic.trim()) {
      clearCoursePlannerSnapshot();
      lastPersistedJson = "";
      return;
    }

    lastPersistedJson = json;
    saveCoursePlannerSnapshot(payload);
  });
}
