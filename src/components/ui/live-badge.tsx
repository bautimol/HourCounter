import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Pill with a pulsing dot. Used for "in progress" / "trabajando" indicators
 * across the app. Same pattern as the auth-hero demo card.
 */
export function LiveBadge({
  children,
  tone = "emerald",
  size = "md",
  className,
}: {
  children: ReactNode;
  tone?: "emerald" | "amber" | "neutral";
  size?: "sm" | "md";
  className?: string;
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 [--dot:theme(colors.amber.500)]"
      : tone === "neutral"
        ? "bg-surface-muted text-muted-foreground [--dot:theme(colors.zinc.400)]"
        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 [--dot:theme(colors.emerald.500)]";

  const sizeClass =
    size === "sm"
      ? "px-1.5 py-0.5 text-[10px]"
      : "px-2 py-0.5 text-xs";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium uppercase tracking-wide",
        toneClass,
        sizeClass,
        className,
      )}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ background: "var(--dot)" }}
        />
        <span
          className="relative inline-flex h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--dot)" }}
        />
      </span>
      {children}
    </span>
  );
}
