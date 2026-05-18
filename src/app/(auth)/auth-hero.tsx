"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { formatStopwatch } from "@/lib/format";

/**
 * Decorative right-hand panel for the auth pages. Static gradient + grid +
 * a couple of floating "demo" cards that mock the actual product UI.
 *
 * The clock card has a real ticking stopwatch that started ~2 hours before
 * page load, just for life. No data, no network — pure visual.
 */
export function AuthHero() {
  return (
    <aside className="relative hidden overflow-hidden lg:flex lg:w-1/2">
      {/* base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-emerald-50 to-cyan-50 dark:from-emerald-950 dark:via-zinc-950 dark:to-emerald-950" />

      {/* grid pattern */}
      <div
        aria-hidden
        className="absolute inset-0 text-emerald-900/15 dark:text-emerald-300/10"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      {/* radial color accents */}
      <div
        aria-hidden
        className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-300/40 blur-3xl dark:bg-emerald-600/30"
      />
      <div
        aria-hidden
        className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-cyan-300/40 blur-3xl dark:bg-cyan-600/20"
      />

      {/* content */}
      <div className="relative z-10 flex w-full flex-col justify-between gap-10 p-12 xl:p-16">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground shadow-md shadow-emerald-700/30">
            <Clock3 className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-base font-semibold tracking-tight text-foreground">
            HourCounter
          </span>
        </motion.div>

        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-3"
          >
            <h2 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground xl:text-5xl">
              Trackeá horas.
              <br />
              Calculá pagos.
              <br />
              <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-cyan-400">
                Sin más Excel.
              </span>
            </h2>
            <p className="max-w-sm text-balance text-base text-muted-foreground">
              Multi-empleador, clock in / out con cronómetro, roles
              configurables y montos fijos. Todo en un lugar.
            </p>
          </motion.div>

          <div className="space-y-3">
            <DemoClockCard />
            <DemoMemberRow />
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-xs text-muted-foreground"
        >
          Tus datos viven en tu instancia de Supabase.
        </motion.p>
      </div>
    </aside>
  );
}

function DemoClockCard() {
  // Pretend the user clocked in ~2 hours ago when the page loaded.
  const [startTs] = useState(() => Date.now() - 2 * 60 * 60 * 1000 - 14 * 60_000 - 47_000);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = Math.max(0, now - startTs);
  // Pretend the shift is 6 hours.
  const expectedMs = 6 * 60 * 60 * 1000;
  const fraction = Math.min(1, elapsedMs / expectedMs);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, rotate: -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: -1.5 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xl shadow-emerald-900/10 backdrop-blur-md"
    >
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>Turno</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          en curso
        </span>
      </div>
      <p className="mb-3 font-mono text-3xl font-medium tabular-nums text-foreground">
        {formatStopwatch(elapsedMs)}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full bg-accent transition-[width] duration-1000"
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Hoy llevás{" "}
        <span className="font-medium text-foreground">2h 14m</span> · cierre
        estimado 16:30.
      </p>
    </motion.div>
  );
}

function DemoMemberRow() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, rotate: 1.2 }}
      animate={{ opacity: 1, y: 0, rotate: 1.2 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="ml-auto flex max-w-sm items-center gap-3 rounded-xl border border-border/80 bg-surface/90 p-3.5 shadow-xl shadow-cyan-900/10 backdrop-blur-md"
    >
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fuchsia-100 text-sm font-medium text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200"
      >
        CR
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            Camila R.
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Trabajando
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Cajero · ARS 1.500/h</p>
      </div>
    </motion.div>
  );
}
