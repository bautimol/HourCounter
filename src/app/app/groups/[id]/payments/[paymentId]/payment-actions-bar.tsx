"use client";

import { useActionState, useState } from "react";
import { Printer, Trash2 } from "lucide-react";
import {
  deletePaymentAction,
  type DeletePaymentState,
} from "../actions";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/input";

const initialState: DeletePaymentState = { error: null };

export function PaymentActionsBar({
  groupId,
  paymentId,
}: {
  groupId: string;
  paymentId: string;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const action = deletePaymentAction.bind(null, groupId, paymentId);
  const [state, formAction] = useActionState(action, initialState);

  function printNow() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" onClick={printNow}>
        <Printer className="h-4 w-4" aria-hidden />
        Imprimir / PDF
      </Button>

      {!confirmingDelete ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Eliminar
        </Button>
      ) : (
        <form action={formAction} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">¿Seguro?</span>
          <Button type="submit" variant="danger" size="sm">
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Sí, eliminar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmingDelete(false)}
          >
            Cancelar
          </Button>
        </form>
      )}

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    </div>
  );
}
