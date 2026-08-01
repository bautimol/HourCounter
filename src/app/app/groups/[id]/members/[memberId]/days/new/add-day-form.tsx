"use client";

import { useActionState } from "react";
import { CalendarPlus } from "lucide-react";
import { addDayAction, type AddDayState } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorMessage, Field, Hint, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const initialState: AddDayState = { error: null };

// Same classes the shift-review form uses for its native date input — the
// <Input> primitive is not used for dates anywhere in the app.
const DATE_INPUT_CLASS =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgb(var(--ring-color)_/_0.18)]";

export function AddDayForm({
  groupId,
  memberId,
  profileId,
  defaultDate,
}: {
  groupId: string;
  memberId: string;
  profileId: string;
  /** Today in Argentina, as YYYY-MM-DD. */
  defaultDate: string;
}) {
  const action = addDayAction.bind(null, groupId, memberId, profileId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <Field>
        <Label htmlFor="entry_date">Fecha</Label>
        <input
          id="entry_date"
          name="entry_date"
          type="date"
          required
          defaultValue={defaultDate}
          className={DATE_INPUT_CLASS}
        />
      </Field>

      <Field>
        <Label htmlFor="concept">Concepto</Label>
        <Select id="concept" name="concept" defaultValue="holiday">
          <option value="holiday">Feriado</option>
          <option value="vacation_employee">Vacaciones del empleado</option>
          <option value="vacation_employer">Vacaciones del empleador</option>
          <option value="worked">Trabajado (se olvidó de fichar)</option>
          <option value="other">Otro</option>
        </Select>
        <Hint>
          Los feriados y vacaciones se pagan igual, pero no suman montos fijos
          &quot;por día trabajado&quot; (como viáticos).
        </Hint>
      </Field>

      <div>
        <Label className="mb-1.5 block">Horas que se pagan</Label>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <div className="relative">
              <Input
                id="hours"
                name="hours"
                type="number"
                inputMode="numeric"
                min="0"
                max="24"
                step="1"
                required
                className="pr-14 tabular-nums"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs uppercase tracking-wide text-muted-foreground"
              >
                horas
              </span>
            </div>
          </Field>
          <Field>
            <div className="relative">
              <Input
                id="minutes"
                name="minutes"
                type="number"
                inputMode="numeric"
                min="0"
                max="59"
                step="1"
                className="pr-12 tabular-nums"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs uppercase tracking-wide text-muted-foreground"
              >
                min
              </span>
            </div>
          </Field>
        </div>
        <div className="mt-1.5">
          <Hint>
            Cuántas horas le contás ese día, como si las hubiera trabajado.
          </Hint>
        </div>
      </div>

      <Field>
        <Label htmlFor="description">Descripción (opcional)</Label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={500}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <Hint>
          Queda guardada con el día y aparece en el reporte. Ej.: Día del
          Trabajador.
        </Hint>
      </Field>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <SubmitButton pendingText="Guardando…">
        <CalendarPlus className="h-4 w-4" aria-hidden />
        Agregar día
      </SubmitButton>
    </form>
  );
}
