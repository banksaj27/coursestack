import {
  extractNextSseMessage,
  parseSseMessageBlock,
} from "@/lib/sseStreamParse";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ProjectGradeCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamProjectGrade(
  bodyMd: string,
  submission: string,
  projectTitle: string,
  courseTopic: string,
  callbacks: ProjectGradeCallbacks,
): Promise<void> {
  const response = await fetch(`${API_URL}/project/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      body_md: bodyMd,
      submission,
      project_title: projectTitle,
      course_topic: courseTopic,
    }),
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
          if (msg.event === "token") {
            try {
              const parsed = JSON.parse(msg.data) as { token?: string };
              if (parsed.token != null) callbacks.onToken(parsed.token);
            } catch {
              /* skip malformed */
            }
          }
        }
      }

      if (done) {
        if (buf.trim()) {
          const msg = parseSseMessageBlock(buf);
          if (msg && msg.event === "token") {
            try {
              const parsed = JSON.parse(msg.data) as { token?: string };
              if (parsed.token != null) callbacks.onToken(parsed.token);
            } catch {
              /* skip */
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
