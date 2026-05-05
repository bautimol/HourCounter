"use client";

import { useActionState, useEffect, useState } from "react";
import { Play, Square, Timer } from "lucide-react";
import {
  clockInAction,
  clockOutAction,
  type ClockState,
} from "./actions";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import {
  ErrorMessage,
  Field,
  Hint,
  Input,
  Label,
} from "@/components/ui/input";
import { formatDuration, formatStopwatch, formatTimeOfDay } from "@/lib/format";

const initialState: ClockState = { error: null };

export type OpenShift = {
  id: string;
  clockInIso: string;
  expectedMinutes: number | null;
};

/**
 * Shows a live timer when an open shift exists, or a clock-in form when not.
 * Plus a live "today total" that includes the open shift's elapsed time.
 */
export function ClockCard({
  groupId,
  openShift,
  defaultExpectedHours,
  defaultExpectedExtraMinutes,
  closedTodayMinutes,
}: {
  groupId: string;
  openShift: OpenShift | null;
  defaultExpectedHours: number | null;
  defaultExpectedExtraMinutes: number | null;
  /** Sum of closed entries' minutes for today, computed server-side. */
  closedTodayMinutes: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" aria-hidden />
          Turno
        </CardTitle>
      </CardHeader>
      <CardBody className="pt-0">
        {openShift ? (
          <ClockOutForm groupId={groupId} openShift={openShift} />
        ) : (
          <ClockInForm
            groupId={groupId}
            defaultExpectedHours={defaultExpectedHours}
            defaultExpectedExtraMinutes={defaultExpectedExtraMinutes}
          />
        )}

        <LiveTodayTotal
          closedTodayMinutes={closedTodayMinutes}
          openShiftStartTs={
            openShift ? new Date(openShift.clockInIso).getTime() : null
          }
        />
      </CardBody>
    </Card>
  );
}

function ClockInForm({
  groupId,
  defaultExpectedHours,
  defaultExpectedExtraMinutes,
}: {
  groupId: string;
  defaultExpectedHours: number | null;
  defaultExpectedExtraMinutes: number | null;
}) {
  const action = clockInAction.bind(null, groupId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Iniciá tu turno. Si decís cuánto vas a trabajar, se cierra solo al
        cumplirse el tiempo (lo podés editar después).
      </p>

      <div>
        <Label className="mb-1.5 block">Duración estimada (opcional)</Label>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <div className="relative">
              <Input
                id="expected_h"
                name="expected_h"
                type="number"
                inputMode="numeric"
                min="0"
                max="24"
                step="1"
                defaultValue={defaultExpectedHours ?? ""}
                className="pr-12 tabular-nums"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs uppercase tracking-wide text-muted-foreground"
              >
                horas
              </span>
            </div>
          </Field>
          <Field>
            <div className="relative">
              <Input
                id="expected_m"
                name="expected_m"
                type="number"
                inputMode="numeric"
                min="0"
                max="59"
                step="1"
                defaultValue={defaultExpectedExtraMinutes ?? ""}
                className="pr-12 tabular-nums"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs uppercase tracking-wide text-muted-foreground"
              >
                min
              </span>
            </div>
          </Field>
        </div>
      </div>

      <SubmitButton
        size="lg"
        className="w-full rounded-xl shadow-lg shadow-emerald-600/20 ring-1 ring-inset ring-white/10"
      >
        <Play className="h-5 w-5" aria-hidden />
        Iniciar turno
      </SubmitButton>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </form>
  );
}

function ClockOutForm({
  groupId,
  openShift,
}: {
  groupId: string;
  openShift: OpenShift;
}) {
  const action = clockOutAction.bind(null, groupId);
  const [state, formAction] = useActionState(action, initialState);

  const startTs = new Date(openShift.clockInIso).getTime();
  const expectedEndTs =
    openShift.expectedMinutes != null
      ? startTs + openShift.expectedMinutes * 60_000
      : null;

  return (
    <div className="space-y-4">
      <LiveTimer startTs={startTs} expectedEndTs={expectedEndTs} />

      <p className="text-xs text-muted-foreground">
        Iniciado a las {formatTimeOfDay(new Date(startTs))}
        {openShift.expectedMinutes != null && expectedEndTs != null
          ? ` · cierre estimado ${formatTimeOfDay(new Date(expectedEndTs))}`
          : ""}
      </p>

      <form action={formAction} className="space-y-4">
        <Field>
          <Label htmlFor="notes">Notas (opcional)</Label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            maxLength={500}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <Hint>Lo que escribas lo va a ver el empleador al verificar.</Hint>
        </Field>

        <SubmitButton
          variant="danger"
          size="lg"
          className="w-full rounded-xl shadow-lg shadow-red-600/25 ring-1 ring-inset ring-white/10"
        >
          <Square className="h-5 w-5 fill-current" aria-hidden />
          Cerrar turno
        </SubmitButton>

        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      </form>
    </div>
  );
}

function LiveTimer({
  startTs,
  expectedEndTs,
}: {
  startTs: number;
  expectedEndTs: number | null;
}) {
  const now = useNow(1000);

  const elapsedMs = Math.max(0, now - startTs);
  const elapsedFraction =
    expectedEndTs != null
      ? Math.min(1, elapsedMs / Math.max(1, expectedEndTs - startTs))
      : null;
  const overtime = expectedEndTs != null && now > expectedEndTs;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-3xl font-medium tabular-nums">
          {formatStopwatch(elapsedMs)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          en curso
        </span>
      </div>

      {elapsedFraction != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className={
              "h-full transition-[width] duration-1000 ease-linear " +
              (overtime ? "bg-danger" : "bg-accent")
            }
            style={{ width: `${Math.round(elapsedFraction * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function LiveTodayTotal({
  closedTodayMinutes,
  openShiftStartTs,
}: {
  closedTodayMinutes: number;
  openShiftStartTs: number | null;
}) {
  const now = useNow(openShiftStartTs ? 30_000 : null);
  const liveMs =
    closedTodayMinutes * 60_000 +
    (openShiftStartTs ? Math.max(0, now - openShiftStartTs) : 0);

  return (
    <div className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
      Hoy llevás{" "}
      <span className="font-medium text-foreground tabular-nums">
        {formatDuration(liveMs)}
      </span>
      {openShiftStartTs ? " (incluyendo el turno actual)" : ""}.
    </div>
  );
}

/**
 * Returns Date.now() that re-renders every `intervalMs` ms.
 * Pass `null` to never tick (avoid useless intervals when there's nothing
 * live to show).
 */
function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs == null) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
