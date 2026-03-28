import type { WeekModularStatePayload } from "@/types/weekModular";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface WeekModularSSECallbacks {
  onToken: (token: string) => void;
  onModulesUpdate: (data: {
    agent_message: string;
    generated: WeekModularStatePayload["generated"];
    conversation_history: { role: string; content: string }[];
    week_context_summary?: string | null;
  }) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamWeekModularRequest(
  message: string,
  state: WeekModularStatePayload,
  callbacks: WeekModularSSECallbacks,
): Promise<void> {
  const response = await fetch(`${API_URL}/week-modular/stream`, {
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
              case "week_modules_update":
                callbacks.onModulesUpdate(parsed);
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
