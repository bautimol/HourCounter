"use client";

import { motion, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Clock3 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Public landing navbar. Same morph-on-scroll pattern as AppNavbar but
 * without the user menu. Logo on the left, Iniciar sesión + Empezar on
 * the right.
 */
export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 60);
  });

  return (
    <motion.header className="fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-3">
      <motion.nav
        animate={{
          width: scrolled ? "min(880px, 95%)" : "min(1180px, 100%)",
          paddingTop: scrolled ? 8 : 12,
          paddingBottom: scrolled ? 8 : 12,
          paddingLeft: scrolled ? 12 : 18,
          paddingRight: scrolled ? 12 : 18,
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "relative flex items-center gap-3 rounded-2xl",
          "transition-[backdrop-filter,background-color,box-shadow,border-color] duration-300",
          scrolled
            ? "border border-border bg-surface/70 shadow-lg shadow-black/5 backdrop-blur-md"
            : "border border-transparent bg-transparent",
        )}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground shadow-sm shadow-emerald-600/20">
            <Clock3 className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            HourCounter
          </span>
        </Link>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted sm:inline-flex"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground shadow-sm shadow-emerald-700/30 transition-opacity hover:opacity-90"
          >
            Empezar
          </Link>
        </div>
      </motion.nav>
    </motion.header>
  );
}
