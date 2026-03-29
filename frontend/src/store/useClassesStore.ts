import { create } from "zustand";
import type { Message, PlanState } from "@/types/course";
import type { Syllabus } from "@/types/syllabus";
import {
  type CourseMetadata,
  snapshotGlobalKeys,
  restoreGlobalKeys,
  clearGlobalKeys,
  saveCourseData,
  loadCourseData,
  deleteCourseData,
  loadClassesIndex,
  saveClassesIndex,
} from "@/lib/classesStorage";
import { snapshotGlobalKeysWithLiveStores } from "@/lib/snapshotGlobalKeysWithLiveStores";
import { useCourseStore, emptyPlanState } from "./useCourseStore";
import { useWeekModularStore } from "./useWeekModularStore";
import { loadWeekModularSnapshot } from "@/lib/weekModularSyllabusPersistence";
import { hydrateWeekFormatInstructions } from "@/lib/weekFormatInstructions";
import { hydrateWeekSummaryCache } from "@/lib/weekSummaryCache";
import { hydrateProblemSetGlobalRules } from "@/lib/problemSetGlobalRules";
import { hydrateQuizGlobalRules } from "@/lib/quizGlobalRules";

function genId(): string {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_SYLLABUS: Syllabus = {
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

function rehydrateCaches(): void {
  hydrateWeekFormatInstructions();
  hydrateWeekSummaryCache();
  hydrateProblemSetGlobalRules();
  hydrateQuizGlobalRules();
}

function resetCourseStore(): void {
  useCourseStore.setState({
    phase: "topic_input",
    planState: emptyPlanState(),
    messages: [],
    isComplete: false,
    hasExportedToWeekly: false,
    agentStatus: "idle",
    streamingContent: "",
    isExporting: false,
    pendingAttachments: [],
  });
}

function resetWeekStore(): void {
  useWeekModularStore.setState({
    syllabus: { ...EMPTY_SYLLABUS },
    selectedWeek: 1,
    generated: { modules: [], instructor_notes_md: "" },
    messages: [],
    agentStatus: "idle",
    streamingContent: "",
  });
}

function loadStoresFromGlobalKeys(): void {
  try {
    const raw = localStorage.getItem("yhack-course-planner-v1");
    if (raw) {
      const snap = JSON.parse(raw) as Partial<{
        phase: string;
        planState: PlanState;
        messages: Message[];
        isComplete: boolean;
        hasExportedToWeekly: boolean;
      }>;
      if (snap?.phase && snap?.planState && Array.isArray(snap?.messages)) {
        useCourseStore.setState({
          phase: snap.phase as "topic_input" | "planning" | "complete" | "weekly_plan",
          planState: snap.planState,
          messages: snap.messages as Message[],
          isComplete: snap.isComplete ?? false,
          hasExportedToWeekly: snap.hasExportedToWeekly ?? false,
          agentStatus: "idle",
          streamingContent: "",
          isExporting: false,
          pendingAttachments: [],
        });
      } else {
        resetCourseStore();
      }
    } else {
      resetCourseStore();
    }
  } catch {
    resetCourseStore();
  }

  const weekSnap = loadWeekModularSnapshot();
  if (weekSnap) {
    useWeekModularStore
      .getState()
      .applyPersistedSnapshot(weekSnap.syllabus, weekSnap.selectedWeek);
  } else {
    resetWeekStore();
  }
}

interface ClassesStore {
  courses: CourseMetadata[];
  activeCourseId: string | null;
  drawerOpen: boolean;
  initialized: boolean;

  toggleDrawer: () => void;
  closeDrawer: () => void;
  init: () => void;
  saveActiveCourse: () => void;
  deactivateCourse: () => void;
  createCourse: (name?: string) => string;
  /** Returns false if the switch was skipped (same course, unknown id, or agent busy). */
  switchCourse: (id: string) => boolean;
  deleteCourse: (id: string) => void;
  renameCourse: (id: string, name: string) => void;
  moveCourse: (id: string, direction: "up" | "down") => void;
}

export const useClassesStore = create<ClassesStore>((set, get) => ({
  courses: [],
  activeCourseId: null,
  drawerOpen: false,
  initialized: false,

  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  closeDrawer: () => set({ drawerOpen: false }),

  init: () => {
    if (typeof window === "undefined") return;
    if (get().initialized) return;

    const index = loadClassesIndex();

    if (index && index.courses.length > 0) {
      set({
        courses: index.courses,
        activeCourseId: index.activeCourseId,
        initialized: true,
      });

      // If global keys are empty (e.g. cleared cache), restore from per-course storage
      if (index.activeCourseId && !localStorage.getItem("yhack-course-planner-v1")) {
        const courseData = loadCourseData(index.activeCourseId);
        if (courseData) restoreGlobalKeys(courseData);
      }

      window.addEventListener("beforeunload", () => {
        get().saveActiveCourse();
      });
      return;
    }

    // First time — migrate existing single-course data if present, otherwise start empty
    const existingPlanner = localStorage.getItem("yhack-course-planner-v1");

    if (existingPlanner) {
      const id = genId();
      const now = Date.now();
      let name = "My Course";
      try {
        const p = JSON.parse(existingPlanner) as { planState?: { topic?: string } };
        if (p?.planState?.topic?.trim()) name = p.planState.topic;
      } catch {
        /* */
      }
      saveCourseData(id, snapshotGlobalKeys());
      const course: CourseMetadata = { id, name, createdAt: now, updatedAt: now };
      set({ courses: [course], activeCourseId: id, initialized: true });
      saveClassesIndex({ courses: [course], activeCourseId: id });
    } else {
      // No existing data — start with an empty class list
      set({ courses: [], activeCourseId: null, initialized: true });
      saveClassesIndex({ courses: [], activeCourseId: "" });
    }

    window.addEventListener("beforeunload", () => {
      get().saveActiveCourse();
    });
  },

  saveActiveCourse: () => {
    const { activeCourseId, courses } = get();
    if (!activeCourseId) return;

    saveCourseData(activeCourseId, snapshotGlobalKeysWithLiveStores());

    const topic = useCourseStore.getState().planState.topic;
    const updated = courses.map((c) => {
      if (c.id !== activeCourseId) return c;
      return {
        ...c,
        updatedAt: Date.now(),
        ...(topic.trim() ? { name: topic } : {}),
      };
    });

    set({ courses: updated });
    saveClassesIndex({ courses: updated, activeCourseId });
  },

  deactivateCourse: () => {
    const { activeCourseId } = get();
    if (!activeCourseId) return;
    get().saveActiveCourse();
    clearGlobalKeys();
    resetCourseStore();
    resetWeekStore();
    rehydrateCaches();
    set({ activeCourseId: null });
    saveClassesIndex({ courses: get().courses, activeCourseId: "" });
  },

  createCourse: (name?: string) => {
    const { activeCourseId } = get();

    if (activeCourseId) get().saveActiveCourse();

    const id = genId();
    const now = Date.now();
    const course: CourseMetadata = {
      id,
      name: name || "New Course",
      createdAt: now,
      updatedAt: now,
    };

    clearGlobalKeys();
    resetCourseStore();
    resetWeekStore();
    rehydrateCaches();

    const updatedCourses = [...get().courses, course];
    set({ courses: updatedCourses, activeCourseId: id });
    saveClassesIndex({ courses: updatedCourses, activeCourseId: id });
    saveCourseData(id, snapshotGlobalKeysWithLiveStores());

    return id;
  },

  switchCourse: (id: string) => {
    const { activeCourseId, courses } = get();
    if (id === activeCourseId) return true;
    if (!courses.find((c) => c.id === id)) return false;

    // Don't switch while agent is busy
    if (
      useCourseStore.getState().agentStatus !== "idle" ||
      useWeekModularStore.getState().agentStatus !== "idle"
    ) {
      return false;
    }

    if (activeCourseId) get().saveActiveCourse();

    const courseData = loadCourseData(id);
    if (courseData) {
      restoreGlobalKeys(courseData);
    } else {
      clearGlobalKeys();
    }

    rehydrateCaches();
    loadStoresFromGlobalKeys();

    set({ activeCourseId: id });
    saveClassesIndex({ courses, activeCourseId: id });
    saveCourseData(id, snapshotGlobalKeysWithLiveStores());
    return true;
  },

  deleteCourse: (id: string) => {
    const { courses, activeCourseId } = get();
    const remaining = courses.filter((c) => c.id !== id);
    deleteCourseData(id);

    if (id === activeCourseId) {
      clearGlobalKeys();
      resetCourseStore();
      resetWeekStore();
      rehydrateCaches();

      if (remaining.length > 0) {
        const newActive = remaining[0];
        const courseData = loadCourseData(newActive.id);
        if (courseData) restoreGlobalKeys(courseData);
        rehydrateCaches();
        loadStoresFromGlobalKeys();

        set({ courses: remaining, activeCourseId: newActive.id });
        saveClassesIndex({ courses: remaining, activeCourseId: newActive.id });
      } else {
        set({ courses: [], activeCourseId: null });
        saveClassesIndex({ courses: [], activeCourseId: "" });
      }
    } else {
      set({ courses: remaining });
      saveClassesIndex({ courses: remaining, activeCourseId: activeCourseId ?? "" });
    }
  },

  renameCourse: (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { courses, activeCourseId } = get();
    const updated = courses.map((c) =>
      c.id === id ? { ...c, name: trimmed } : c,
    );
    set({ courses: updated });
    saveClassesIndex({ courses: updated, activeCourseId: activeCourseId ?? "" });

    if (id === activeCourseId) {
      useCourseStore.getState().updatePlanTopicLabel(trimmed);
      useWeekModularStore.getState().updateSyllabusTopicLabel(trimmed);
    }
  },

  moveCourse: (id: string, direction: "up" | "down") => {
    const { courses, activeCourseId } = get();
    const idx = courses.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= courses.length) return;
    const updated = [...courses];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    set({ courses: updated });
    saveClassesIndex({ courses: updated, activeCourseId: activeCourseId ?? "" });
  },
}));
