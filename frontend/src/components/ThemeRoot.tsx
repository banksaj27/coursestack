"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import MissingGoogleApiKeyBanner from "@/components/MissingGoogleApiKeyBanner";
import {
  applyThemeToDocument,
  readStoredTheme,
  resolveTheme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/themeAppearance";

type ThemeContextValue = {
  isDark: boolean;
  setPreference: (pref: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function subscribeTheme(onStoreChange: () => void) {
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

function getIsDarkSnapshot(): boolean {
  return resolveTheme(readStoredTheme()) === "dark";
}

function getIsDarkServerSnapshot(): boolean {
  return false;
}

/**
 * Font shell + theme context. The `dark` class on `<html>` is applied only by
 * {@link applyThemeToDocument} (and the bootstrap script) so it is never overwritten by React.
 */
export default function ThemeRoot({
  children,
  fontClassName,
}: {
  children: React.ReactNode;
  fontClassName: string;
}) {
  const pathname = usePathname();
  const isDark = useSyncExternalStore(
    subscribeTheme,
    getIsDarkSnapshot,
    getIsDarkServerSnapshot,
  );

  const setPreference = useCallback((pref: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      /* ignore */
    }
    applyThemeToDocument(pref);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const value = useMemo(
    () => ({ isDark, setPreference }),
    [isDark, setPreference],
  );

  useLayoutEffect(() => {
    applyThemeToDocument(readStoredTheme());
  }, [pathname]);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (readStoredTheme() === "system") {
        applyThemeToDocument("system");
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      }
    };
    mq.addEventListener("change", onScheme);
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY || e.key === null) {
        applyThemeToDocument(readStoredTheme());
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onScheme);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <ThemeContext.Provider value={value}>
      <div
        className={`theme-root min-h-full bg-background ${fontClassName}`}
        suppressHydrationWarning
      >
        {children}
        <MissingGoogleApiKeyBanner />
      </div>
    </ThemeContext.Provider>
  );
}

export function useThemeController(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeController must be used within ThemeRoot");
  }
  return ctx;
}
