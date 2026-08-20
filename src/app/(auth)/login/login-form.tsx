"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { AuthDivider, GoogleButton } from "../google-button";
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
    <div className="space-y-4">
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
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password">Contraseña</Label>
            {/* Next to the field it belongs to, not buried under the form:
                someone who cannot get in should not have to hunt for this. */}
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ¿La olvidaste?
            </Link>
          </div>
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

      {/* Outside the email form on purpose: GoogleButton renders its own
          <form>, and nested forms are invalid HTML. */}
      <AuthDivider />
      <GoogleButton next={next} label="Entrar con Google" />
    </div>
  );
}
