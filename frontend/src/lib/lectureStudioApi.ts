import type { LectureStudioStatePayload } from "@/types/lectureStudio";
import type { WeekModule } from "@/types/weekModular";
import {
  extractNextSseMessage,
  parseSseMessageBlock,
} from "@/lib/sseStreamParse";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface LectureStudioSSECallbacks {
  onToken: (token: string) => void;
  onModuleUpdate: (data: {
    agent_message: string;
    module: WeekModule;
    conversation_history: { role: string; content: string }[];
  }) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

function dispatchLectureStudioEvent(
  eventName: string,
  dataStr: string,
  callbacks: LectureStudioSSECallbacks,
): void {
  if (!dataStr) return;
  try {
    const parsed = JSON.parse(dataStr) as unknown;
    switch (eventName) {
      case "token": {
        const t = parsed as { token?: string };
        if (t.token != null) callbacks.onToken(t.token);
        break;
      }
      case "lecture_module_update":
        callbacks.onModuleUpdate(
          parsed as {
            agent_message: string;
            module: WeekModule;
            conversation_history: { role: string; content: string }[];
          },
        );
        break;
      case "done":
        break;
      default:
        break;
    }
  } catch {
    if (eventName === "lecture_module_update") {
      console.warn(
        "lecture-studio: failed to parse lecture_module_update payload (truncated SSE?)",
        dataStr.slice(0, 200),
      );
    }
  }
}

export async function streamLectureStudioRequest(
  message: string,
  state: LectureStudioStatePayload,
  callbacks: LectureStudioSSECallbacks,
): Promise<void> {
  const response = await fetch(`${API_URL}/lecture-studio/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, state }),
  });

  if (!response.ok) {
    callbacks.onError(
      new Error(`HTTP ${response.status}: ${response.statusText}`),
    );
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("No response body"));
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
        if (msg) {
          dispatchLectureStudioEvent(msg.event, msg.data, callbacks);
        }
      }

      if (done) {
        if (buf.trim()) {
          const msg = parseSseMessageBlock(buf);
          if (msg) {
            dispatchLectureStudioEvent(msg.event, msg.data, callbacks);
          }
        }
        break;
      }
    }
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
    callbacks.onDone();
  }
}
