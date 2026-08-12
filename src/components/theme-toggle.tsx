"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyPreference,
  readStoredPreference,
  subscribeThemePreference,
  systemTheme,
  type ThemePreference,
} from "@/lib/theme";
import { cn } from "@/lib/cn";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

/**
 * Three-way theme picker. "Sistema" is the default and is a real option, not
 * just the absence of a choice — someone who flips their phone to dark at
 * night wants the app to follow, and a two-way toggle silently takes that
 * away the first time it is touched.
 */
export function ThemeToggle() {
  // localStorage is external state, so it is read through the store rather
  // than copied into React state from an effect. The server snapshot is
  // "system" because the server cannot know the choice; React reconciles to
  // the real value on hydration, which at worst moves the highlighted pill.
  const pref = useSyncExternalStore<ThemePreference>(
    subscribeThemePreference,
    readStoredPreference,
    () => "system",
  );

  // While on "system", follow the OS if it changes mid-session.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.setAttribute("data-theme", systemTheme());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  return (
    <div
      className="flex items-center gap-1 rounded-lg bg-surface-muted p-1"
      role="group"
      aria-label="Tema"
    >
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const active = pref === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => applyPreference(o.value)}
            aria-pressed={active}
            title={o.label}
            className={cn(
              "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
              active
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
