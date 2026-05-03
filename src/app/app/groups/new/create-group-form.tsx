"use client";

import { useActionState } from "react";
import {
  createGroupAction,
  type CreateGroupState,
} from "./actions";
import { SubmitButton } from "@/components/submit-button";
import {
  ErrorMessage,
  Field,
  Input,
  Label,
} from "@/components/ui/input";

const initialState: CreateGroupState = { error: null };

export function CreateGroupForm() {
  const [state, formAction] = useActionState(createGroupAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Field>
        <Label htmlFor="name">Nombre del grupo</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          autoFocus
          placeholder="ej. Mi negocio"
        />
      </Field>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <SubmitButton>Crear grupo</SubmitButton>
    </form>
  );
}
