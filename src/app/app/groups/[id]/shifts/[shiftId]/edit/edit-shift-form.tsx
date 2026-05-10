"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import {
  updateShiftAction,
  type EditShiftState,
} from "./actions";
import { SubmitButton } from "@/components/submit-button";
import {
  ErrorMessage,
  Field,
  Hint,
  Label,
} from "@/components/ui/input";

const initialState: EditShiftState = { error: null };

/**
 * Employee self-edit form. Notes only — clock_out is read-only context
 * (rendered by the parent page). If the system clock_out is wrong, the
 * employee explains in the note and the employer corrects it.
 */
export function EditShiftForm({
  groupId,
  shiftId,
  initialNotes,
}: {
  groupId: string;
  shiftId: string;
  initialNotes: string;
}) {
  const action = updateShiftAction.bind(null, groupId, shiftId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Field>
        <Label htmlFor="notes">Nota</Label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={500}
          defaultValue={initialNotes}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <Hint>
          La nota la lee tu empleador al verificar el turno. Si la hora de
          salida está mal (por ejemplo el sistema cerró solo y vos te fuiste
          antes), aclaralo acá y tu empleador ajusta el horario.
        </Hint>
      </Field>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <div className="flex justify-end">
        <SubmitButton fullWidth={false}>
          <Save className="h-4 w-4" aria-hidden />
          Guardar nota
        </SubmitButton>
      </div>
    </form>
  );
}
