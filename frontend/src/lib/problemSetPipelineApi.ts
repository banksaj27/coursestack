import type { LectureStudioStatePayload } from "@/types/lectureStudio";
import type { WeekModule } from "@/types/weekModular";
import { API_URL, apiUnreachableError } from "@/lib/apiBase";
import {
  extractNextSseMessage,
  parseSseMessageBlock,
} from "@/lib/sseStreamParse";

export type ProblemSetProgress = {
  step: string;
  index: number;
  total: number;
  label: string;
};

export interface ProblemSetPipelineCallbacks {
  onProgress: (p: ProblemSetProgress) => void;
  onModuleUpdate: (data: {
    agent_message: string;
    module: WeekModule;
    conversation_history: { role: string; content: string }[];
  }) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

function dispatchProblemSetEvent(
  eventName: string,
  dataStr: string,
  callbacks: ProblemSetPipelineCallbacks,
): void {
  if (!dataStr) return;
  try {
    const parsed = JSON.parse(dataStr) as unknown;
    switch (eventName) {
      case "problem_set_progress":
        callbacks.onProgress(parsed as ProblemSetProgress);
        break;
      case "problem_set_module_update":
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
    if (eventName === "problem_set_module_update") {
      console.warn(
        "problem-set-pipeline: failed to parse problem_set_module_update",
        dataStr.slice(0, 200),
      );
    }
  }
}

/** Multi-step problem set generation: outline → each problem → concat (server-side). */
export async function streamProblemSetPipeline(
  state: LectureStudioStatePayload,
  callbacks: ProblemSetPipelineCallbacks,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/lecture-studio/generate-problem-set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
  } catch (e) {
    callbacks.onError(apiUnreachableError(e).message);
    callbacks.onDone();
    return;
  }

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
          dispatchProblemSetEvent(msg.event, msg.data, callbacks);
        }
      }

      if (done) {
        if (buf.trim()) {
          const msg = parseSseMessageBlock(buf);
          if (msg?.data) {
            dispatchProblemSetEvent(msg.event, msg.data, callbacks);
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
