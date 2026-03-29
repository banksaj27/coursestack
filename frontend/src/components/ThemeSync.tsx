"use client";

import { useEffect } from "react";
import {
  applyThemeToDocument,
  readStoredTheme,
  THEME_STORAGE_KEY,
} from "@/lib/themeAppearance";

/**
 * Keeps `<html class="dark">` in sync with stored preference and system theme.
 * Layout also injects a blocking script so the first paint matches storage.
 */
export default function ThemeSync() {
  useEffect(() => {
    applyThemeToDocument(readStoredTheme());

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (readStoredTheme() === "system") {
        applyThemeToDocument("system");
      }
    };
    mq.addEventListener("change", onScheme);

    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY || e.key === null) {
        applyThemeToDocument(readStoredTheme());
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mq.removeEventListener("change", onScheme);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
