"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import {
  acceptInvitationAction,
  type AcceptInvitationState,
} from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage } from "@/components/ui/input";

const initialState: AcceptInvitationState = { error: null };

export function AcceptInvitationButton({ code }: { code: string }) {
  const action = acceptInvitationAction.bind(null, code);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      <SubmitButton>
        <Check className="h-4 w-4" aria-hidden />
        Aceptar invitación
      </SubmitButton>
    </form>
  );
}
