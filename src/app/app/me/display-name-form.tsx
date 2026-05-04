"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  updateMyDisplayNameAction,
  type UpdateMyNameState,
} from "./actions";
import { SubmitButton } from "@/components/submit-button";
import {
  ErrorMessage,
  Field,
  Hint,
  Input,
  Label,
} from "@/components/ui/input";

const initialState: UpdateMyNameState = { error: null, ok: false };

export function DisplayNameForm({ current }: { current: string }) {
  const [state, action] = useActionState(
    updateMyDisplayNameAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-4">
      <Field>
        <Label htmlFor="display_name">Tu nombre</Label>
        <Input
          id="display_name"
          name="display_name"
          required
          maxLength={120}
          defaultValue={current}
          placeholder="ej. Juan Pérez"
        />
        <Hint>
          Es el nombre que ven los demás en los grupos donde participás. Se
          actualiza en todos los grupos a la vez.
        </Hint>
      </Field>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && (
        <p className="inline-flex items-center gap-1.5 text-sm text-accent-soft-foreground">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Nombre actualizado.
        </p>
      )}

      <div className="flex justify-end">
        <SubmitButton fullWidth={false}>Guardar</SubmitButton>
      </div>
    </form>
  );
}
