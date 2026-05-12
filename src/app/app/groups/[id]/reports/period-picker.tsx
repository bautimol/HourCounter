"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/cn";

type PresetKey =
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_30_days"
  | "custom";

const PRESET_LABELS: Record<PresetKey, string> = {
  this_month: "Este mes",
  last_month: "Mes pasado",
  this_year: "Este año",
  last_30_days: "Últimos 30 días",
  custom: "Personalizado",
};

/**
 * Period selector for the reports dashboard. Writes the chosen range into
 * the URL (`?from=...&to=...`) so the server-rendered page can re-fetch.
 */
export function PeriodPicker({
  initialFrom,
  initialTo,
  initialPreset,
}: {
  initialFrom: string; // YYYY-MM-DD
  initialTo: string; // YYYY-MM-DD
  initialPreset: PresetKey;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [preset, setPreset] = useState<PresetKey>(initialPreset);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function applyToUrl(newFrom: string, newTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }

  function onPresetClick(p: PresetKey) {
    setPreset(p);
    if (p === "custom") {
      // Don't update URL until the user picks dates explicitly.
      return;
    }
    const { from: f, to: t } = rangeForPreset(p);
    setFrom(f);
    setTo(t);
    applyToUrl(f, t);
  }

  function onCustomApply() {
    if (!from || !to) return;
    applyToUrl(from, to);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Calendar
          className="h-4 w-4 text-muted-foreground"
          aria-hidden
        />
        {(Object.keys(PRESET_LABELS) as PresetKey[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPresetClick(p)}
            disabled={isPending}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              preset === p
                ? "bg-accent text-accent-foreground"
                : "bg-surface-muted text-muted-foreground hover:bg-surface-muted/70 hover:text-foreground",
            )}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface/60 p-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Desde
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Hasta
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={onCustomApply}
            disabled={isPending || !from || !to}
            className="h-9 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground disabled:opacity-60"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

function rangeForPreset(p: PresetKey): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (p) {
    case "this_month": {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0); // last day of current month
      return { from: toIso(start), to: toIso(end) };
    }
    case "last_month": {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { from: toIso(start), to: toIso(end) };
    }
    case "this_year": {
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31);
      return { from: toIso(start), to: toIso(end) };
    }
    case "last_30_days": {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      return { from: toIso(start), to: toIso(end) };
    }
    case "custom":
      return { from: "", to: "" };
  }
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
