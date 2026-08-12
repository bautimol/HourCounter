/**
 * Theme preference: what the user chose. Distinct from the *resolved* theme,
 * which is what is actually painted — "system" resolves to one of the other
 * two depending on the OS at that moment.
 */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "hc-theme";

/**
 * Runs before first paint, inlined into <head>.
 *
 * It has to be inline and synchronous: React hydrates after the browser has
 * already painted, so deciding the theme in a component means a light flash on
 * every load for dark-mode users. Kept dependency-free and wrapped in
 * try/catch because localStorage throws in some privacy modes, and a theme
 * preference is never worth breaking the page over.
 *
 * Stamps a concrete "light"/"dark" — never "system" — so the CSS and the
 * `dark:` utilities only ever have two cases to handle.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var resolved =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.setAttribute("data-theme", resolved);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

/**
 * Minimal store so the picker can read the preference through
 * `useSyncExternalStore` instead of copying it into state from an effect.
 * `storage` covers other tabs; the local listener set covers this one, since
 * `storage` does not fire in the tab that wrote the value.
 */
const listeners = new Set<() => void>();

export function subscribeThemePreference(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Private mode / storage disabled — fall through to following the OS.
  }
  return "system";
}

export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolvePreference(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

/**
 * Applies a preference: paints it and persists it.
 *
 * "system" removes the stored key rather than writing "system", so a device
 * that later changes its OS setting is followed instead of being pinned to
 * whatever it happened to be on the day the user picked it.
 */
export function applyPreference(pref: ThemePreference): ResolvedTheme {
  const resolved = resolvePreference(pref);
  document.documentElement.setAttribute("data-theme", resolved);
  try {
    if (pref === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Not persisting is survivable; the current page still switched.
  }
  for (const l of listeners) l();
  return resolved;
}
