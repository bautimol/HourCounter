"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ResetState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage, Field, Hint, Input, Label } from "@/components/ui/input";

const initialState: ResetState = { error: null };

export function ResetForm() {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Field>
        <Label htmlFor="password">Contraseña nueva</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
        />
        <Hint>Mínimo 8 caracteres</Hint>
      </Field>

      <Field>
        <Label htmlFor="password_confirm">Repetila</Label>
        <Input
          id="password_confirm"
          name="password_confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <SubmitButton>Guardar y entrar</SubmitButton>
    </form>
  );
}
