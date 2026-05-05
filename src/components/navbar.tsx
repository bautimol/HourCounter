"use client";

import { motion, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Clock3, LogOut, Menu, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export type NavLink = {
  label: string;
  href: string;
};

/**
 * Resizable, sticky app navbar inspired by ui.aceternity.com/components/resizable-navbar.
 *
 * Behavior:
 *   - At top of page: full-width, transparent, large.
 *   - Past ~60px scroll: shrinks horizontally, gets a glass background,
 *     subtle border and shadow, rounded shape.
 *   - Mobile: links collapse into a hamburger menu.
 */
export function AppNavbar({
  fullName,
  links = [],
}: {
  fullName: string;
  links?: NavLink[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 60);
  });

  return (
    <motion.header
      ref={ref}
      className="fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-3"
      // Outer wrapper just keeps the bar centered; the inner div animates.
    >
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
        {/* Left: brand */}
        <Link
          href="/app"
          className="flex shrink-0 items-center gap-2"
          onClick={() => setMobileOpen(false)}
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground shadow-sm shadow-emerald-600/20">
            <Clock3 className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            HourCounter
          </span>
        </Link>

        {/* Center: nav links (desktop only) */}
        {links.length > 0 && (
          <ul className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* If no links, push the user menu to the right with a flex-1 spacer. */}
        {links.length === 0 && <div className="flex-1" />}

        {/* Right: user (desktop) */}
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Link
            href="/app/me"
            className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-muted"
            title="Tu perfil"
          >
            <Avatar name={fullName} size="sm" />
            <span className="max-w-[160px] truncate text-sm text-foreground">
              {fullName}
            </span>
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-muted"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Salir
            </button>
          </form>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label="Abrir menú"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface transition-colors hover:bg-surface-muted md:hidden"
        >
          {mobileOpen ? (
            <X className="h-4 w-4" aria-hidden />
          ) : (
            <Menu className="h-4 w-4" aria-hidden />
          )}
        </button>

        {/* Mobile menu (absolute, drops below the navbar) */}
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 top-full mt-2 rounded-2xl border border-border bg-surface p-3 shadow-lg shadow-black/10 md:hidden"
          >
            <ul className="flex flex-col gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/app/me"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                >
                  <Avatar name={fullName} size="sm" />
                  {fullName}
                </Link>
              </li>
              <li className="mt-1 border-t border-border pt-2">
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Salir
                  </button>
                </form>
              </li>
            </ul>
          </motion.div>
        )}
      </motion.nav>
    </motion.header>
  );
}

/**
 * Empty space matching the navbar height — keep page content from sliding
 * under the fixed navbar. Adjust if navbar height changes.
 */
export function NavbarSpacer({ children }: { children?: ReactNode }) {
  return <div className="h-20">{children}</div>;
}
