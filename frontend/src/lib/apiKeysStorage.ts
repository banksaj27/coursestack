/** Browser-local API keys (never sent automatically; optional future client features). */
export const GEMINI_API_KEY_STORAGE = "coursesstack_gemini_api_key";
export const ELEVENLABS_API_KEY_STORAGE = "coursesstack_elevenlabs_api_key";

/** Dispatched after keys in localStorage change (same-tab saves use {@link notifyApiKeysChanged}). */
export const API_KEYS_CHANGED_EVENT = "coursesstack-api-keys-changed";

export function notifyApiKeysChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(API_KEYS_CHANGED_EVENT));
}

export function readGeminiApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function writeGeminiApiKey(value: string): void {
  try {
    if (value.trim() === "") {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    } else {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, value);
    }
  } catch {
    /* private mode / quota */
  }
  notifyApiKeysChanged();
}

export function readElevenlabsApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(ELEVENLABS_API_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function writeElevenlabsApiKey(value: string): void {
  try {
    if (value.trim() === "") {
      localStorage.removeItem(ELEVENLABS_API_KEY_STORAGE);
    } else {
      localStorage.setItem(ELEVENLABS_API_KEY_STORAGE, value);
    }
  } catch {
    /* ignore */
  }
  notifyApiKeysChanged();
}
