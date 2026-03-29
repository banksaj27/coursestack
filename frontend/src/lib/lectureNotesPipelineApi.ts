import type { LectureStudioStatePayload } from "@/types/lectureStudio";
import type { WeekModule } from "@/types/weekModular";
import {
  extractNextSseMessage,
  parseSseMessageBlock,
} from "@/lib/sseStreamParse";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type LectureNotesProgress = {
  step: string;
  index: number;
  total: number;
  label: string;
};

export interface LectureNotesPipelineCallbacks {
  onProgress: (p: LectureNotesProgress) => void;
  onModuleUpdate: (data: {
    agent_message: string;
    module: WeekModule;
    conversation_history: { role: string; content: string }[];
  }) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

function dispatchNotesEvent(
  eventName: string,
  dataStr: string,
  callbacks: LectureNotesPipelineCallbacks,
): void {
  if (!dataStr) return;
  try {
    const parsed = JSON.parse(dataStr) as unknown;
    switch (eventName) {
      case "lecture_notes_progress":
        callbacks.onProgress(parsed as LectureNotesProgress);
        break;
      case "lecture_module_update":
        callbacks.onModuleUpdate(
          parsed as {
            agent_message: string;
            module: WeekModule;
            conversation_history: { role: string; content: string }[];
          },
        );
        break;
      case "error":
        callbacks.onError((parsed as { message?: string }).message ?? "Unknown error");
        break;
      case "done":
        break;
      default:
        break;
    }
  } catch {
    if (eventName === "lecture_module_update") {
      console.warn(
        "lecture-notes: failed to parse lecture_module_update",
        dataStr.slice(0, 200),
      );
    }
  }
}

/** Multi-step lecture generation: outline → each section → concat (server-side). */
export async function streamLectureNotesPipeline(
  state: LectureStudioStatePayload,
  callbacks: LectureNotesPipelineCallbacks,
): Promise<void> {
  const response = await fetch(`${API_URL}/lecture-studio/generate-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });

  if (!response.ok) {
    callbacks.onError(`HTTP ${response.status}: ${response.statusText}`);
    callbacks.onDone();
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body");
    callbacks.onDone();
    return;
  }

  const decoder = new TextDecoder();
  let buf = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        buf += decoder.decode(value, { stream: true });
      }
      if (done) {
        buf += decoder.decode();
      }

      for (;;) {
        const next = extractNextSseMessage(buf);
        if (next.raw === null) break;
        buf = next.rest;
        const msg = parseSseMessageBlock(next.raw);
        if (msg?.data) {
          dispatchNotesEvent(msg.event, msg.data, callbacks);
        }
      }

      if (done) {
        if (buf.trim()) {
          const msg = parseSseMessageBlock(buf);
          if (msg?.data) {
            dispatchNotesEvent(msg.event, msg.data, callbacks);
          }
        }
        break;
      }
    }
  } catch (err) {
    callbacks.onError(err instanceof Error ? err.message : String(err));
  } finally {
    reader.releaseLock();
    callbacks.onDone();
  }
}
