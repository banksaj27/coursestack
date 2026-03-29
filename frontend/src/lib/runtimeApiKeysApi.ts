import { API_URL, apiUnreachableError } from "@/lib/apiBase";

export type RuntimeApiKeysResult = {
  ok: boolean;
  gemini_configured: boolean;
};

/** Push keys to the local FastAPI process so `GOOGLE_API_KEY` / `ELEVENLABS_API_KEY` apply for this session. */
export async function syncRuntimeApiKeys(
  googleApiKey: string,
  elevenlabsApiKey: string,
): Promise<RuntimeApiKeysResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/runtime-api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        google_api_key: googleApiKey,
        elevenlabs_api_key: elevenlabsApiKey,
      }),
    });
  } catch (e) {
    throw apiUnreachableError(e);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as RuntimeApiKeysResult;
}
