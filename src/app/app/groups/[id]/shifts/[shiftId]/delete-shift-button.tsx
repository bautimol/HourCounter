"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { deleteShiftAction, type ShiftActionState } from "../actions";
import { ErrorMessage } from "@/components/ui/input";

const initialState: ShiftActionState = { error: null };

function ConfirmingSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!pending) {
          const ok = window.confirm(
            `¿Borrar ${label}? No se puede deshacer.`,
          );
          if (!ok) e.preventDefault();
        }
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-danger/30 bg-surface px-3 text-sm text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="h-4 w-4" aria-hidden />
      )}
      Borrar turno
    </button>
  );
}

/**
 * Removes a shift outright, for the case correction cannot fix: one opened by
 * mistake, which otherwise sits in Pendientes forever because approving it
 * would pay for work nobody did.
 *
 * The RPC refuses shifts covered by a recorded payment, so the destructive
 * reach stops at anything already settled.
 */
export function DeleteShiftButton({
  groupId,
  shiftId,
  label,
}: {
  groupId: string;
  shiftId: string;
  /** Human description for the confirm, e.g. "el turno del 12/08". */
  label: string;
}) {
  const action = deleteShiftAction.bind(null, groupId, shiftId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <ConfirmingSubmit label={label} />
      </form>
      <p className="text-xs text-muted-foreground">
        Usalo para turnos abiertos por error. Si el turno es real pero tiene
        horas mal, corregilo arriba en vez de borrarlo.
      </p>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </div>
  );
}
