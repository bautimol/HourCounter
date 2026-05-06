"use client";

import { cn } from "@/lib/cn";
import {
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useRef,
} from "react";

/**
 * Card with a soft radial gradient that follows the cursor on hover. Inspired
 * by Aceternity's spotlight pattern. The gradient is layered as a
 * `pointer-events-none` overlay above the card surface and below the content,
 * so it never interferes with clicks.
 *
 * Falls back to a static "static glow on hover" if the user prefers reduced
 * motion (handled implicitly: pointer events still update the position, the
 * radial just sits there).
 */
export function SpotlightCard({
  children,
  className,
  innerClassName,
  tint = "emerald",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  tint?: "emerald" | "cyan" | "neutral";
} & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  const tintColor =
    tint === "cyan"
      ? "rgba(34, 211, 238, 0.18)" // cyan-400
      : tint === "neutral"
        ? "rgba(161, 161, 170, 0.16)" // zinc-400
        : "rgba(16, 185, 129, 0.18)"; // emerald-500

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-surface/70 backdrop-blur-sm",
        "transition-[border-color,box-shadow] duration-300",
        "hover:border-border-strong hover:shadow-lg hover:shadow-black/5",
        className,
      )}
      style={
        {
          "--mx": "50%",
          "--my": "0%",
        } as React.CSSProperties
      }
      {...rest}
    >
      {/* The spotlight overlay. Centered at (--mx, --my). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle 220px at var(--mx) var(--my), ${tintColor}, transparent 70%)`,
        }}
      />
      <div className={cn("relative", innerClassName)}>{children}</div>
    </div>
  );
}
