"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, ChevronRight, MapPinOff, ShieldCheck } from "lucide-react";
import {
  bulkVerifyShiftsAction,
  verifyShiftAction,
  type ShiftActionState,
} from "./actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/input";
import {
  formatDuration,
  formatShortDate,
  formatTimeOfDay,
} from "@/lib/format";

const initialState: ShiftActionState = { error: null };

export type BulkShiftRow = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  status: "open" | "closed" | "needs_review";
  notes: string | null;
  verifiedAt: string | null;
  withinGeofence: boolean | null;
  member: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

/**
 * Wraps the shifts list with checkbox selection + a bulk-action bar +
 * per-row quick-approve.
 *
 * Why client-only: server components can't pass functions to client
 * components. We were doing `renderRow={...}` from the server page; now
 * the row layout lives inside this file and the server only passes
 * serializable data.
 */
export function ShiftBulkActions({
  groupId,
  allowSelect,
  shifts,
}: {
  groupId: string;
  allowSelect: boolean;
  shifts: BulkShiftRow[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const bulkAction = bulkVerifyShiftsAction.bind(null, groupId);
  const [bulkState, bulkFormAction] = useActionState(bulkAction, initialState);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === shifts.length ? new Set() : new Set(shifts.map((s) => s.id)),
    );
  }

  const allSelected = selected.size === shifts.length && shifts.length > 0;

  return (
    <div className="space-y-3">
      {allowSelect && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-muted"
          >
            <span
              className={
                "grid h-4 w-4 place-items-center rounded-sm border " +
                (allSelected
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border-strong")
              }
              aria-hidden
            >
              {allSelected && <Check className="h-3 w-3" aria-hidden />}
            </span>
            {allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
            <span className="text-muted-foreground">
              ({selected.size}/{shifts.length})
            </span>
          </button>

          {selected.size > 0 && (
            <form action={bulkFormAction} className="flex items-center gap-2">
              {Array.from(selected).map((id) => (
                <input key={id} type="hidden" name="shift_id" value={id} />
              ))}
              <Button type="submit" size="sm">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Aprobar {selected.size}
              </Button>
            </form>
          )}
        </div>
      )}

      {bulkState.error && <ErrorMessage>{bulkState.error}</ErrorMessage>}

      <ul className="grid gap-2.5">
        {shifts.map((s) => {
          const checked = selected.has(s.id);
          const start = new Date(s.clockIn);
          const end = s.clockOut ? new Date(s.clockOut) : null;
          const durationMs =
            end != null ? end.getTime() - start.getTime() : null;
          const verified = s.verifiedAt != null;
          const member = s.member;

          return (
            <li
              key={s.id}
              className={
                "group flex items-center gap-3.5 rounded-xl border bg-surface p-3.5 transition-colors hover:border-border-strong " +
                (checked ? "border-accent" : "border-border")
              }
            >
              {allowSelect && (
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={checked}
                  aria-label={checked ? "Deseleccionar" : "Seleccionar"}
                  className={
                    "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors " +
                    (checked
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border-strong hover:border-accent")
                  }
                >
                  {checked && <Check className="h-3.5 w-3.5" aria-hidden />}
                </button>
              )}

              <Link
                href={`/app/groups/${groupId}/shifts/${s.id}`}
                className="flex flex-1 items-center gap-3.5"
              >
                <Avatar
                  name={member?.display_name ?? "?"}
                  src={member?.avatar_url ?? null}
                  size="md"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium">
                    {member?.display_name ?? (
                      <span className="italic text-muted-foreground">
                        sin nombre
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatShortDate(start)} ·{" "}
                    {formatTimeOfDay(start)}
                    {" – "}
                    {end ? formatTimeOfDay(end) : "abierto"}
                    {durationMs != null
                      ? ` · ${formatDuration(durationMs)}`
                      : ""}
                  </p>
                  {s.notes && (
                    <p className="truncate text-xs italic text-muted-foreground">
                      {s.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {s.withinGeofence === false && (
                    <span
                      title="Fichó fuera del radio o sin ubicación"
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300"
                    >
                      <MapPinOff className="h-3 w-3" aria-hidden />
                      Fuera
                    </span>
                  )}
                  {verified ? (
                    <Badge variant="accent">
                      <ShieldCheck className="mr-1 h-3 w-3" aria-hidden />
                      Verificado
                    </Badge>
                  ) : s.status === "needs_review" ? (
                    <Badge variant="muted">Para revisar</Badge>
                  ) : (
                    <Badge variant="muted">Pendiente</Badge>
                  )}
                  <ChevronRight
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden
                  />
                </div>
              </Link>

              {allowSelect && s.verifiedAt == null && (
                <QuickApproveForm groupId={groupId} shiftId={s.id} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QuickApproveForm({
  groupId,
  shiftId,
}: {
  groupId: string;
  shiftId: string;
}) {
  const action = verifyShiftAction.bind(null, groupId, shiftId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-soft-foreground"
        title={state.error ?? "Aprobar este turno"}
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Aprobar
      </button>
    </form>
  );
}
