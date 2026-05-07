"use client";

import { useActionState } from "react";
import { ShieldOff } from "lucide-react";
import {
  unverifyShiftAction,
  type ShiftActionState,
} from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage } from "@/components/ui/input";

const initialState: ShiftActionState = { error: null };

export function UnverifyShiftButton({
  groupId,
  shiftId,
}: {
  groupId: string;
  shiftId: string;
}) {
  const action = unverifyShiftAction.bind(null, groupId, shiftId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-2">
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      <SubmitButton variant="secondary" fullWidth={false}>
        <ShieldOff className="h-4 w-4" aria-hidden />
        Desaprobar este turno
      </SubmitButton>
    </form>
  );
}
