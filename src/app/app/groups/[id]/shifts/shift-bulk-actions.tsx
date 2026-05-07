"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Check, ShieldCheck } from "lucide-react";
import {
  bulkVerifyShiftsAction,
  verifyShiftAction,
  type ShiftActionState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/input";

const initialState: ShiftActionState = { error: null };

export type BulkShiftRow = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  status: "open" | "closed" | "needs_review";
  notes: string | null;
  verifiedAt: string | null;
  member: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

/**
 * Wraps the shifts list with checkbox selection and a sticky bulk-action
 * bar. The actual row content is rendered by `renderRow` so the server
 * page owns the layout/links.
 *
 * If `allowSelect` is false (e.g. on the "Verified" tab) the checkboxes
 * and bulk bar are hidden entirely.
 */
export function ShiftBulkActions({
  groupId,
  allowSelect,
  shifts,
  renderRow,
}: {
  groupId: string;
  allowSelect: boolean;
  shifts: BulkShiftRow[];
  renderRow: (s: BulkShiftRow) => ReactNode;
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

              {renderRow(s)}

              {/* Per-row quick approve, only when not yet verified */}
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
