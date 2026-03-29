"use client";

import { useSyncExternalStore } from "react";
import {
  API_KEYS_CHANGED_EVENT,
  readElevenlabsApiKey,
} from "@/lib/apiKeysStorage";

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const on = () => onStoreChange();
  window.addEventListener(API_KEYS_CHANGED_EVENT, on);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener(API_KEYS_CHANGED_EVENT, on);
    window.removeEventListener("storage", on);
  };
}

function getSnapshot(): boolean {
  return readElevenlabsApiKey().trim() !== "";
}

function getServerSnapshot(): boolean {
  return false;
}

/** True when a non-empty ElevenLabs key is saved in this browser (required for lecture TTS). */
export function useElevenlabsApiKeyConfigured(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
