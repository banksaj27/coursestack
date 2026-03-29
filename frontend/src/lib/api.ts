import type { PlanState } from "@/types/course";
import { API_URL, apiUnreachableError } from "@/lib/apiBase";

export async function uploadSyllabusFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/upload-syllabus`, {
      method: "POST",
      body: form,
    });
  } catch (e) {
    throw apiUnreachableError(e);
  }
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return data.text;
}

export async function uploadImageFile(
  file: File,
): Promise<{ base64: string; media_type: string }> {
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/upload-image`, {
      method: "POST",
      body: form,
    });
  } catch (e) {
    throw apiUnreachableError(e);
  }
  if (!res.ok) throw new Error(`Image upload failed: ${res.status}`);
  return res.json();
}

export async function exportSyllabus(state: PlanState): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch (e) {
    throw apiUnreachableError(e);
  }
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.json();
}

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
  let response: Response;
  try {
    response = await fetch(`${API_URL}/plan/stream`, {
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
