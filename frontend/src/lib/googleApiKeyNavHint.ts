import { readGeminiApiKey } from "@/lib/apiKeysStorage";

/** Shown when a fetch fails and no Google key is stored in the browser (user may need to save in API). */
export const GOOGLE_API_KEY_NAV_HINT =
  "Set Google API Key in Home → API (API tab next to About).";

const HINT_MARKER = "Set Google API Key in Home";

/** Append {@link GOOGLE_API_KEY_NAV_HINT} once when the user has no browser-stored key. */
export function maybeAppendGoogleApiKeyNavHint(message: string): string {
  if (typeof window === "undefined") return message;
  if (readGeminiApiKey().trim() !== "") return message;
  if (message.includes(HINT_MARKER)) return message;
  return `${message} ${GOOGLE_API_KEY_NAV_HINT}`;
}
