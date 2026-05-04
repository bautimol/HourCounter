"use client";

import { useActionState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import {
  deletePositionAction,
  type DeletePositionState,
} from "./edit/actions";
import { ErrorMessage } from "@/components/ui/input";

const initialState: DeletePositionState = { error: null };

function ConfirmingSubmit({ positionName }: { positionName: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!pending) {
          const ok = window.confirm(
            `¿Eliminar el rol "${positionName}"? Esta acción no se puede deshacer.`,
          );
          if (!ok) e.preventDefault();
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-surface px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      )}
      Eliminar
    </button>
  );
}

export function DeletePositionButton({
  groupId,
  positionId,
  positionName,
}: {
  groupId: string;
  positionId: string;
  positionName: string;
}) {
  const action = deletePositionAction.bind(null, groupId, positionId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <ConfirmingSubmit positionName={positionName} />
      </form>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </div>
  );
}
