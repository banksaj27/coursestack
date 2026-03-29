const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchLectureTts(
  text: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(`${API_URL}/lecture-studio/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = (await response.json()) as { detail?: unknown };
      if (typeof data.detail === "string") message = data.detail;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  return response.blob();
}
