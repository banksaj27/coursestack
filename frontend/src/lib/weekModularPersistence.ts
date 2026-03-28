import type { Message } from "@/types/course";
import type { WeekModularGenerated } from "@/types/weekModular";

const STORAGE_KEY = "yhack-week-modular-snapshot-v1";

type StoredPack = {
  version: 1;
  generated: WeekModularGenerated;
  messages: Message[];
};

type Root = Record<string, StoredPack>;

function readRoot(): Root {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Root;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeRoot(root: Root): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch (e) {
    console.warn("[weekModularPersistence] save failed", e);
  }
}

function isValidPack(p: unknown): p is StoredPack {
  if (!p || typeof p !== "object") return false;
  const o = p as StoredPack;
  if (o.version !== 1) return false;
  if (!o.generated || typeof o.generated !== "object") return false;
  if (!Array.isArray(o.generated.modules)) return false;
  if (typeof o.generated.instructor_notes_md !== "string") return false;
  if (!Array.isArray(o.messages)) return false;
  return true;
}

/** Load saved modules + chat for a syllabus week number. */
export function loadModularWeekPack(week: number): StoredPack | null {
  const root = readRoot();
  const raw = root[String(week)];
  if (!isValidPack(raw)) return null;
  return raw;
}

/** Persist after a successful generation (or any assistant reply that updates state). */
export function saveModularWeekPack(
  week: number,
  generated: WeekModularGenerated,
  messages: Message[],
): void {
  const root = readRoot();
  const pack: StoredPack = {
    version: 1,
    generated: {
      modules: generated.modules.map((m) => ({
        ...m,
        is_new: false,
      })),
      instructor_notes_md: generated.instructor_notes_md,
    },
    messages: messages.map((m) => ({ ...m })),
  };
  root[String(week)] = pack;
  writeRoot(root);
}

/** Remove saved data for one week (optional tooling). */
export function clearModularWeekPack(week: number): void {
  const root = readRoot();
  delete root[String(week)];
  writeRoot(root);
}
