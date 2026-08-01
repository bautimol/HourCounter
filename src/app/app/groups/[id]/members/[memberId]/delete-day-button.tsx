"use client";

import { useActionState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { deleteDayAction, type DeleteDayState } from "./days/actions";
import { ErrorMessage } from "@/components/ui/input";

const initialState: DeleteDayState = { error: null };

function ConfirmingSubmit({ dayLabel }: { dayLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Borrar ${dayLabel}`}
      onClick={(e) => {
        if (!pending) {
          const ok = window.confirm(
            `¿Borrar ${dayLabel}? Deja de contar en la liquidación.`,
          );
          if (!ok) e.preventDefault();
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-surface px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      )}
      Borrar
    </button>
  );
}

export function DeleteDayButton({
  groupId,
  memberId,
  entryId,
  dayLabel,
}: {
  groupId: string;
  memberId: string;
  entryId: string;
  /** Human description used in the confirm dialog, e.g. "el feriado del 25/5". */
  dayLabel: string;
}) {
  const action = deleteDayAction.bind(null, groupId, memberId, entryId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <ConfirmingSubmit dayLabel={dayLabel} />
      </form>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </div>
  );
}
