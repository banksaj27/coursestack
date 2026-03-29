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
  localStorage.setItem(THEME_STORAGE_KEY, pref);
}

export function applyThemeToDocument(pref: ThemePreference): void {
  const resolved = resolveTheme(pref);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

/**
 * Runs a DOM update inside the View Transition API when available (smooth theme crossfade).
 * Falls back to immediate update. Respects reduced motion via CSS, not here.
 */
export function runWithThemeTransition(updateDom: () => void): void {
  if (typeof document === "undefined") {
    updateDom();
    return;
  }
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    updateDom();
    return;
  }
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown;
  };
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(() => {
      updateDom();
    });
  } else {
    updateDom();
  }
}

/** Inline script (layout) must stay in sync with {@link resolveTheme} / storage key. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var d=false;if(t==="light")d=false;else if(t==="dark")d=true;else d=window.matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;if(d)r.classList.add("dark");else r.classList.remove("dark");}catch(e){}})();`;
