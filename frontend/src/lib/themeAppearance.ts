export const THEME_STORAGE_KEY = "coursesstack_theme";

/** Fired after theme changes so nav/UI can sync (e.g. sun/moon toggle). */
export const THEME_CHANGE_EVENT = "coursesstack-theme-change";

export type ThemePreference = "light" | "dark" | "system";

export function getSystemIsDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Resolved appearance for applying the `dark` class on `<html>`. */
export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "dark") return "dark";
  if (pref === "light") return "light";
  return getSystemIsDark() ? "dark" : "light";
}

export function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function persistTheme(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* private mode / quota; theme still applies for this session via applyThemeToDocument */
  }
}

export function applyThemeToDocument(pref: ThemePreference): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  const isDark = resolved === "dark";
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.style.colorScheme = isDark ? "dark" : "light";
}

/**
 * Runs DOM updates inside `document.startViewTransition` when available so theme changes
 * crossfade smoothly. The update callback must apply theme synchronously.
 */
export function runWithThemeTransition(updateDom: () => void): void {
  if (typeof document === "undefined") {
    updateDom();
    return;
  }
  const d = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };
  if (typeof d.startViewTransition === "function") {
    d.startViewTransition(() => {
      updateDom();
    });
  } else {
    updateDom();
  }
}

/** Inline script (layout) must stay in sync with {@link resolveTheme} / storage key. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var d=false;if(t==="light")d=false;else if(t==="dark")d=true;else d=window.matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;if(d){r.classList.add("dark");r.style.colorScheme="dark";}else{r.classList.remove("dark");r.style.colorScheme="light";}}catch(e){}})();`;
