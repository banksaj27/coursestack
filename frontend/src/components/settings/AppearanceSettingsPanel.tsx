"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import {
  applyThemeToDocument,
  persistTheme,
  readStoredTheme,
  runWithThemeTransition,
  THEME_CHANGE_EVENT,
  type ThemePreference,
} from "@/lib/themeAppearance";

const options: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Always use light appearance." },
  { value: "dark", label: "Dark", hint: "Always use dark appearance." },
  {
    value: "system",
    label: "System",
    hint: "Match your device setting (updates when it changes).",
  },
];

export default function AppearanceSettingsPanel() {
  const [pref, setPref] = useState<ThemePreference>("system");

  useLayoutEffect(() => {
    setPref(readStoredTheme());
  }, []);

  const choose = useCallback((next: ThemePreference) => {
    setPref(next);
    runWithThemeTransition(() => {
      persistTheme(next);
      applyThemeToDocument(next);
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    });
  }, []);

  return (
    <section
      className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      aria-labelledby="appearance-heading"
    >
      <h2
        id="appearance-heading"
        className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
      >
        Appearance
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Choose light or dark mode. Your choice is saved in this browser.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const selected = pref === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => choose(o.value)}
              className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                selected
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white dark:border-neutral-600 dark:bg-neutral-800 dark:hover:border-neutral-500 dark:hover:bg-neutral-700"
              }`}
            >
              <span className="block font-semibold">{o.label}</span>
              <span
                className={`mt-1 block text-xs leading-snug ${
                  selected
                    ? "text-white/90 dark:text-neutral-700"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {o.hint}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
