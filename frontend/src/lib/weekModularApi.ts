import type { WeekModularStatePayload } from "@/types/weekModular";
import { API_URL, apiUnreachableError } from "@/lib/apiBase";
import {
  extractNextSseMessage,
  parseSseMessageBlock,
} from "@/lib/sseStreamParse";

export interface WeekModularSSECallbacks {
  onToken: (token: string) => void;
  onModulesUpdate: (data: {
    agent_message: string;
    generated: WeekModularStatePayload["generated"];
    conversation_history: { role: string; content: string }[];
    week_context_summary?: string | null;
    /** False when the model omitted or broke the WEEK_MODULES_UPDATE JSON; timeline unchanged. */
    timeline_parse_ok?: boolean;
  }) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamWeekModularRequest(
  message: string,
  state: WeekModularStatePayload,
  callbacks: WeekModularSSECallbacks,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/week-modular/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, state }),
    });
  } catch (e) {
    callbacks.onError(apiUnreachableError(e));
    callbacks.onDone();
    return;
  }

  if (!response.ok) {
    callbacks.onError(
      new Error(`HTTP ${response.status}: ${response.statusText}`),
    );
    callbacks.onDone();
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("No response body"));
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
        if (!msg?.data) continue;
        try {
          const parsed = JSON.parse(msg.data) as unknown;
          switch (msg.event) {
            case "token":
              callbacks.onToken((parsed as { token: string }).token);
              break;
            case "week_modules_update":
              callbacks.onModulesUpdate(
                parsed as Parameters<
                  WeekModularSSECallbacks["onModulesUpdate"]
                >[0],
              );
              break;
            case "done":
              break;
            default:
              break;
          }
        } catch {
          if (msg.event === "week_modules_update") {
            console.warn(
              "week-modular: failed to parse week_modules_update (see SSE framing)",
              String(msg.data).slice(0, 200),
            );
          }
        }
      }

      if (done) {
        if (buf.trim()) {
          const msg = parseSseMessageBlock(buf);
          if (msg?.data) {
            try {
              const parsed = JSON.parse(msg.data) as unknown;
              if (msg.event === "token") {
                callbacks.onToken((parsed as { token: string }).token);
              } else if (msg.event === "week_modules_update") {
                callbacks.onModulesUpdate(
                  parsed as Parameters<
                    WeekModularSSECallbacks["onModulesUpdate"]
                  >[0],
                );
              }
            } catch {
              /* ignore trailing garbage */
            }
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
