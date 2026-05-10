"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Square } from "lucide-react";
import {
  clockOutAction,
  type ClockState,
} from "./groups/[id]/clock/actions";
import { Avatar } from "@/components/ui/avatar";
import { ErrorMessage } from "@/components/ui/input";
import { formatStopwatch } from "@/lib/format";

const initialState: ClockState = { error: null };

export type OpenShiftSummary = {
  shiftId: string;
  groupId: string;
  groupName: string;
  groupAvatarUrl: string | null;
  clockInIso: string;
};

/**
 * Sticky banner shown at the top of /app when the user has an open shift
 * anywhere. Live cronómetro + 1-tap close button. If multiple groups have
 * open shifts, render one banner per group (stacked).
 *
 * The close button reuses the same client_click_iso pattern as the clock
 * card (see migration 0017) so the recorded clock_out reflects the actual
 * tap moment instead of the request-processing latency.
 */
export function OpenShiftBanner({
  shifts,
}: {
  shifts: OpenShiftSummary[];
}) {
  if (shifts.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {shifts.map((s) => (
        <SingleBanner key={s.shiftId} shift={s} />
      ))}
    </div>
  );
}

function SingleBanner({ shift }: { shift: OpenShiftSummary }) {
  const startTs = new Date(shift.clockInIso).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsedMs = Math.max(0, now - startTs);

  const action = clockOutAction.bind(null, shift.groupId);
  const [state, formAction] = useActionState(action, initialState);
  const clickTsRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-3 shadow-sm shadow-emerald-700/10 backdrop-blur-sm dark:from-emerald-500/15 dark:via-emerald-500/5">
      <div className="flex flex-wrap items-center gap-3">
        {/* Status dot */}
        <span className="relative inline-flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>

        {/* Group avatar + label */}
        <Link
          href={`/app/groups/${shift.groupId}`}
          className="flex min-w-0 flex-1 items-center gap-2.5 hover:underline"
        >
          <Avatar
            name={shift.groupName}
            src={shift.groupAvatarUrl}
            size="sm"
          />
          <span className="min-w-0 truncate text-sm">
            <span className="text-muted-foreground">Trabajando en </span>
            <span className="font-medium text-foreground">
              {shift.groupName}
            </span>
          </span>
        </Link>

        {/* Live timer */}
        <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-foreground">
          {formatStopwatch(elapsedMs)}
        </span>

        {/* Close button */}
        <form
          action={formAction}
          onSubmit={() => {
            if (clickTsRef.current) {
              clickTsRef.current.value = new Date().toISOString();
            }
          }}
          className="shrink-0"
        >
          <input
            ref={clickTsRef}
            type="hidden"
            name="client_click_iso"
            defaultValue=""
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-red-700/25 ring-1 ring-inset ring-white/15 transition-opacity hover:opacity-90"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
            Cerrar
          </button>
        </form>
      </div>

      {state.error && (
        <div className="mt-2">
          <ErrorMessage>{state.error}</ErrorMessage>
        </div>
      )}
    </div>
  );
}
