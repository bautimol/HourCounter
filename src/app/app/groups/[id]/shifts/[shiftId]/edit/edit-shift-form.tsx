"use client";

import { useActionState, useState } from "react";
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
 * Format a Date as "YYYY-MM-DDTHH:mm" in the user's local timezone, suitable
 * for an <input type="datetime-local"> default value.
 */
function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function EditShiftForm({
  groupId,
  shiftId,
  initialClockOutIso,
  initialNotes,
  minIso,
}: {
  groupId: string;
  shiftId: string;
  initialClockOutIso: string;
  initialNotes: string;
  /** clock_in ISO — used as the input's `min`. */
  minIso: string;
}) {
  const action = updateShiftAction.bind(null, groupId, shiftId);
  const [state, formAction] = useActionState(action, initialState);

  const [localStr, setLocalStr] = useState(() =>
    toLocalDatetimeValue(new Date(initialClockOutIso)),
  );
  // Derived ISO from the local input's value, using the browser's TZ.
  const iso = (() => {
    const d = new Date(localStr);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  })();

  return (
    <form action={formAction} className="space-y-4">
      <Field>
        <Label htmlFor="clock_out_local">Hora de salida</Label>
        <input
          id="clock_out_local"
          type="datetime-local"
          required
          value={localStr}
          min={toLocalDatetimeValue(new Date(minIso))}
          onChange={(e) => setLocalStr(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <input type="hidden" name="clock_out_iso" value={iso} />
        <Hint>
          La hora se interpreta en tu zona horaria. Si te equivocaste de día,
          tomá el selector de fecha.
        </Hint>
      </Field>

      <Field>
        <Label htmlFor="notes">Notas</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          defaultValue={initialNotes}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </Field>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <div className="flex justify-end">
        <SubmitButton fullWidth={false}>
          <Save className="h-4 w-4" aria-hidden />
          Guardar cambios
        </SubmitButton>
      </div>
    </form>
  );
}
