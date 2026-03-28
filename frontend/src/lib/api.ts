import type { PlanState } from "@/types/course";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface SSECallbacks {
  onToken: (token: string) => void;
  onPlanUpdate: (data: {
    agent_message: string;
    state: PlanState;
    is_complete: boolean;
  }) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamPlanRequest(
  message: string,
  state: PlanState,
  callbacks: SSECallbacks,
): Promise<void> {
  const response = await fetch(`${API_URL}/plan/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, state }),
  });

  if (!response.ok) {
    callbacks.onError(new Error(`HTTP ${response.status}: ${response.statusText}`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("No response body"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);
            switch (currentEvent) {
              case "token":
                callbacks.onToken(parsed.token);
                break;
              case "plan_update":
                callbacks.onPlanUpdate(parsed);
                break;
              case "done":
                callbacks.onDone();
                break;
            }
          } catch {
            // skip malformed JSON chunks
          }
        }
      }
    }
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
    callbacks.onDone();
  }
}
