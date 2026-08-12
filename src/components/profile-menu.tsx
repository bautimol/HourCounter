"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, User2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Avatar dropdown in the app navbar: profile link, theme picker, sign out.
 *
 * The navbar used to show the profile link and a separate "Salir" button side
 * by side, which left nowhere to put a setting. Collapsing them into a menu
 * gives settings a home and takes back the width.
 */
export function ProfileMenu({
  fullName,
  avatarUrl,
}: {
  fullName: string;
  avatarUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape — a dropdown you cannot dismiss
  // without picking something is worse than no dropdown.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-h-11 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-muted"
      >
        <Avatar name={fullName} src={avatarUrl} size="sm" />
        <span className="max-w-[160px] truncate text-sm text-foreground">
          {fullName}
        </span>
        <ChevronDown
          className={
            "h-3.5 w-3.5 text-muted-foreground transition-transform " +
            (open ? "rotate-180" : "")
          }
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-surface p-1.5 shadow-lg shadow-black/10"
        >
          <Link
            href="/app/me"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-2 rounded-md px-2.5 text-sm text-foreground transition-colors hover:bg-surface-muted"
          >
            <User2 className="h-4 w-4 text-muted-foreground" aria-hidden />
            Tu perfil
          </Link>

          <div className="my-1.5 border-t border-border" />

          <div className="px-2.5 pb-1 pt-0.5">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Tema
            </p>
            <ThemeToggle />
          </div>

          <div className="my-1.5 border-t border-border" />

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              role="menuitem"
              // Same guard the old navbar button had: signing out costs an
              // email + password most people do not remember.
              onClick={(e) => {
                const ok = window.confirm(
                  "¿Cerrar sesión? Vas a tener que poner tu email y contraseña para volver a entrar.",
                );
                if (!ok) e.preventDefault();
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Salir
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
