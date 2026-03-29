import type { Message } from "@/types/course";

const STORAGE_KEY = "yhack-lecture-studio-chat-v1";

type Entry = { messages: Message[] };

function key(week: number, moduleId: string): string {
  return `${week}::${moduleId}`;
}

function readRoot(): Record<string, Entry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, Entry>;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeRoot(root: Record<string, Entry>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch {
    /* quota */
  }
}

export function loadLectureStudioMessages(
  week: number,
  moduleId: string,
): Message[] {
  const root = readRoot();
  const e = root[key(week, moduleId)];
  if (!e?.messages || !Array.isArray(e.messages)) return [];
  return e.messages.map((m) => ({ ...m }));
}

export function saveLectureStudioMessages(
  week: number,
  moduleId: string,
  messages: Message[],
): void {
  const root = readRoot();
  root[key(week, moduleId)] = {
    messages: messages.map((m) => ({ ...m })),
  };
  writeRoot(root);
}
