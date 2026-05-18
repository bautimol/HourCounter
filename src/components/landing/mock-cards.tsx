"use client";

import {
  Briefcase,
  Calendar,
  ChevronRight,
  Clock,
  Coins,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";

/**
 * Static mock UI snippets used to fill the 3D landing marquee.
 *
 * They're styled to look like actual product cards (group, member, clock,
 * position, payment, etc.) so the marquee feels like the real app passing
 * by, not abstract decoration.
 *
 * No props — just exported as ready-to-render JSX. The marquee can pick
 * any subset and order them however it wants.
 */

const cardBase =
  "w-72 shrink-0 rounded-2xl border border-border bg-surface/95 shadow-xl shadow-black/10 backdrop-blur-md";

function Avatar({
  initials,
  palette,
  size = "md",
}: {
  initials: string;
  palette: string;
  size?: "sm" | "md";
}) {
  const sizeCls = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium ${palette} ${sizeCls}`}
    >
      {initials}
    </span>
  );
}

function OnlinePill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      Trabajando
    </span>
  );
}

export function MockClockCard() {
  return (
    <div className={cardBase}>
      <div className="flex items-center gap-2 px-5 pt-4 text-xs uppercase tracking-wide text-muted-foreground">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Turno
      </div>
      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-3xl font-medium tabular-nums">
            2:14:47
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            en curso
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full w-[36%] bg-accent" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Hoy llevás{" "}
          <span className="font-medium text-foreground">2h 14m</span>
        </p>
      </div>
    </div>
  );
}

export function MockMemberRow() {
  return (
    <div className={`${cardBase} flex items-center gap-3 p-3.5`}>
      <Avatar
        initials="CR"
        palette="bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">Camila R.</p>
          <OnlinePill />
        </div>
        <p className="text-xs text-muted-foreground">Cajero · ARS 1.500/h</p>
      </div>
    </div>
  );
}

export function MockGroupCard() {
  return (
    <div className={`${cardBase} flex items-center gap-3 p-4`}>
      <Avatar
        initials="MC"
        palette="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">McDonald's Recoleta</p>
        <span className="mt-1 inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-soft-foreground">
          Empleador
        </span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
    </div>
  );
}

export function MockPositionCard() {
  return (
    <div className={`${cardBase} p-4`}>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Briefcase className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">Cajero</p>
          <p className="text-xs text-muted-foreground">
            ARS 1.500/h · Semanal
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-surface-muted px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Viáticos
          </p>
          <p className="font-medium tabular-nums">ARS 200/día</p>
        </div>
        <div className="rounded-md bg-surface-muted px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Premio
          </p>
          <p className="font-medium tabular-nums">ARS 5.000</p>
        </div>
      </div>
    </div>
  );
}

export function MockPaymentCard() {
  return (
    <div className={`${cardBase} p-4`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Coins className="h-3.5 w-3.5" aria-hidden />
        A pagar este período
      </div>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
        $ 84.350
      </p>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>52h × $1.500</span>
          <span className="tabular-nums">$ 78.000</span>
        </div>
        <div className="flex justify-between">
          <span>Viáticos × 7</span>
          <span className="tabular-nums">$ 1.400</span>
        </div>
        <div className="flex justify-between">
          <span>Premio puntualidad</span>
          <span className="tabular-nums">$ 5.000</span>
        </div>
      </div>
    </div>
  );
}

export function MockShiftRow() {
  return (
    <div className={`${cardBase} p-3.5`}>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
          <Calendar className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">jue 23 oct</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            09:00 – 17:30 · 8h 30m
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-soft-foreground">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          OK
        </span>
      </div>
    </div>
  );
}

export function MockInvitationCard() {
  return (
    <div className={`${cardBase} p-4`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Mail className="h-3.5 w-3.5" aria-hidden />
        Invitación
      </div>
      <code className="mt-2 inline-block rounded-md bg-surface-muted px-2 py-1 font-mono text-sm tracking-wider">
        A3F2BC91D4E8
      </code>
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Empleado
        </span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Cocinero
        </span>
      </div>
    </div>
  );
}

export function MockMembersCount() {
  return (
    <div className={`${cardBase} p-4`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Users className="h-3.5 w-3.5" aria-hidden />
        Miembros activos
      </div>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">12</p>
      <div className="mt-3 flex -space-x-2">
        {[
          {
            i: "JM",
            p: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
          },
          {
            i: "BR",
            p: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
          },
          {
            i: "LP",
            p: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
          },
          {
            i: "CN",
            p: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
          },
        ].map((a) => (
          <Avatar key={a.i} initials={a.i} palette={a.p} size="sm" />
        ))}
        <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-muted text-[10px] font-medium text-muted-foreground">
          +8
        </span>
      </div>
    </div>
  );
}
