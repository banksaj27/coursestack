"use client";

import { useSyncExternalStore } from "react";
import {
  readStoredTheme,
  resolveTheme,
  THEME_CHANGE_EVENT,
} from "@/lib/themeAppearance";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const on = () => onStoreChange();
  window.addEventListener(THEME_CHANGE_EVENT, on);
  window.addEventListener("storage", on);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", on);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, on);
    window.removeEventListener("storage", on);
    mq.removeEventListener("change", on);
  };
}

function getSnapshot() {
  return resolveTheme(readStoredTheme()) === "dark";
}

function getServerSnapshot() {
  return false;
}

/** Resolved light/dark appearance (storage + system when pref is `system`). */
export function useThemeIsDark() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
