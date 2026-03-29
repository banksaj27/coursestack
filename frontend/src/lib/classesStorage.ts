/**
 * Low-level localStorage helpers for multi-course persistence.
 *
 * Strategy: all existing persistence modules write to fixed global keys.
 * When switching courses, we snapshot those keys into per-course storage
 * and restore the new course's keys. This avoids modifying any existing
 * persistence code.
 */

const COURSE_KEYS = [
  "yhack-course-planner-v1",
  "yhack-week-modular-syllabus-snapshot-v1",
  "yhack-week-modular-snapshot-v1",
  "yhack-week-context-summaries-v1",
  "yhack-week-format-instructions-v1",
  "yhack-problem-set-global-house-rules-v1",
  "yhack-quiz-global-house-rules-v1",
  "yhack-lecture-studio-chat-v1",
  "yhack-last-lecture-studio-v1",
] as const;

const CLASSES_INDEX_KEY = "yhack-classes-index-v1";

export interface CourseMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface ClassesIndex {
  courses: CourseMetadata[];
  activeCourseId: string;
}

function courseDataKey(id: string): string {
  return `yhack-course-data-${id}`;
}

export function snapshotGlobalKeys(): Record<string, string | null> {
  const data: Record<string, string | null> = {};
  for (const key of COURSE_KEYS) {
    try {
      data[key] = localStorage.getItem(key);
    } catch {
      data[key] = null;
    }
  }
  return data;
}

export function restoreGlobalKeys(data: Record<string, string | null>): void {
  for (const key of COURSE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* */
    }
  }
  for (const key of COURSE_KEYS) {
    const val = data[key];
    if (val != null) {
      try {
        localStorage.setItem(key, val);
      } catch {
        /* quota */
      }
    }
  }
}

export function clearGlobalKeys(): void {
  for (const key of COURSE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* */
    }
  }
}

export function saveCourseData(
  id: string,
  data: Record<string, string | null>,
): void {
  try {
    localStorage.setItem(courseDataKey(id), JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function loadCourseData(
  id: string,
): Record<string, string | null> | null {
  try {
    const raw = localStorage.getItem(courseDataKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, string | null>;
  } catch {
    return null;
  }
}

export function deleteCourseData(id: string): void {
  try {
    localStorage.removeItem(courseDataKey(id));
  } catch {
    /* */
  }
}

export function loadClassesIndex(): ClassesIndex | null {
  try {
    const raw = localStorage.getItem(CLASSES_INDEX_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ClassesIndex;
    if (!Array.isArray(p?.courses) || typeof p?.activeCourseId !== "string")
      return null;
    return p;
  } catch {
    return null;
  }
}

export function saveClassesIndex(index: ClassesIndex): void {
  try {
    localStorage.setItem(CLASSES_INDEX_KEY, JSON.stringify(index));
  } catch {
    /* quota */
  }
}
