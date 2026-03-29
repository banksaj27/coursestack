"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import {
  applyThemeToDocument,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  runWithThemeTransition,
  THEME_CHANGE_EVENT,
  type ThemePreference,
} from "@/lib/themeAppearance";

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonStarsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      <circle cx="18" cy="5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="20.5" cy="9" r="0.55" fill="currentColor" stroke="none" opacity={0.75} />
    </svg>
  );
}

const iconBtn =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 sm:h-9 sm:w-9";

/**
 * Sun when the UI is dark (switch to light); moon & star when light (switch to dark).
 */
export default function ThemeToggleButton() {
  const [isDark, setIsDark] = useState(false);

  const syncFromDom = useCallback(() => {
    if (typeof document === "undefined") return;
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useLayoutEffect(() => {
    syncFromDom();
    const onExternal = () => syncFromDom();
    window.addEventListener(THEME_CHANGE_EVENT, onExternal);
    window.addEventListener("storage", onExternal);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (readStoredTheme() === "system") onExternal();
    };
    mq.addEventListener("change", onScheme);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, onExternal);
      window.removeEventListener("storage", onExternal);
      mq.removeEventListener("change", onScheme);
    };
  }, [syncFromDom]);

  const toggle = useCallback(() => {
    const pref = readStoredTheme();
    const resolved = resolveTheme(pref);
    const next: ThemePreference = resolved === "dark" ? "light" : "dark";
    runWithThemeTransition(() => {
      persistTheme(next);
      applyThemeToDocument(next);
      setIsDark(next === "dark");
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    });
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      className={iconBtn}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        <SunIcon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
      ) : (
        <MoonStarsIcon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
      )}
    </button>
  );
}
