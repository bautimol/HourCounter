"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { signupAction, type SignupState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import {
  ErrorMessage,
  Field,
  Hint,
  Input,
  Label,
} from "@/components/ui/input";

const initialState: SignupState = { error: null, message: null };

export function SignupForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signupAction, initialState);

  if (state.message) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-accent-soft bg-accent-soft p-4 text-sm text-accent-soft-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      <Field>
        <Label htmlFor="full_name">Nombre completo</Label>
        <Input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          required
        />
      </Field>

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
          autoComplete="new-password"
          required
          minLength={8}
        />
        <Hint>Mínimo 8 caracteres</Hint>
      </Field>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <SubmitButton>Crear cuenta</SubmitButton>
    </form>
  );
}
