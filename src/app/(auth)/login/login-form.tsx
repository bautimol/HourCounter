"use client";

import { useActionState } from "react";
import { loginAction, type AuthState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import {
  ErrorMessage,
  Field,
  Input,
  Label,
} from "@/components/ui/input";

const initialState: AuthState = { error: null };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      <Field>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </Field>

      <Field>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <SubmitButton>Entrar</SubmitButton>
    </form>
  );
}
