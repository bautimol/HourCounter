"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { forgotPasswordAction, type ForgotState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage, Field, Hint, Input, Label } from "@/components/ui/input";

const initialState: ForgotState = { error: null, sent: false };

export function ForgotForm({ email }: { email?: string }) {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    initialState,
  );

  if (state.sent) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-accent-soft bg-accent-soft p-4 text-sm text-accent-soft-foreground">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p>
              Si hay una cuenta con ese email, te mandamos un link para poner
              una contraseña nueva.
            </p>
            <p>Revisá tu bandeja de entrada y también el correo no deseado.</p>
          </div>
        </div>
        <Hint>El link sirve una sola vez y vence en una hora.</Hint>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          required
          autoFocus
        />
        <Hint>El mismo que usás para entrar.</Hint>
      </Field>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <SubmitButton>Enviarme el link</SubmitButton>
    </form>
  );
}
