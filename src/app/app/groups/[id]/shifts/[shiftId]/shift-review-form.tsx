"use client";

import { useActionState, useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import {
  employerUpdateShiftAction,
  type ShiftActionState,
} from "../actions";
import { SubmitButton } from "@/components/submit-button";
import {
  ErrorMessage,
  Field,
  Hint,
  Label,
} from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const initialState: ShiftActionState = { error: null };

/**
 * `employer_update_shift` takes a single `notes` column, and the employer used
 * to overwrite it — erasing the employee's explanation ("me fui 17:30") exactly
 * when a dispute was being settled. Cheapest fix that loses nothing: keep her
 * text verbatim at the top and append the employer's under this marker, which
 * is also what lets us split them apart again on reload.
 */
const EMPLOYER_NOTE_MARKER = "— Nota del empleador:";

function splitNotes(raw: string): { employee: string; employer: string } {
  const at = raw.indexOf(EMPLOYER_NOTE_MARKER);
  if (at === -1) return { employee: raw.trim(), employer: "" };
  return {
    employee: raw.slice(0, at).trim(),
    employer: raw.slice(at + EMPLOYER_NOTE_MARKER.length).trim(),
  };
}

function composeNotes(employee: string, employer: string): string {
  const mine = employer.trim();
  if (mine === "") return employee;
  if (employee === "") return `${EMPLOYER_NOTE_MARKER}\n${mine}`;
  return `${employee}\n\n${EMPLOYER_NOTE_MARKER}\n${mine}`;
}

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function ShiftReviewForm({
  groupId,
  shiftId,
  alreadyVerified,
  initialClockOutIso,
  initialNotes,
  initialStatus,
  minIso,
}: {
  groupId: string;
  shiftId: string;
  alreadyVerified: boolean;
  initialClockOutIso: string;
  initialNotes: string;
  initialStatus: "open" | "closed" | "needs_review";
  minIso: string;
}) {
  const action = employerUpdateShiftAction.bind(null, groupId, shiftId);
  const [state, formAction] = useActionState(action, initialState);

  const [localStr, setLocalStr] = useState(() =>
    toLocalDatetimeValue(new Date(initialClockOutIso)),
  );

  const employeeNote = splitNotes(initialNotes).employee;
  const [employerNote, setEmployerNote] = useState(
    () => splitNotes(initialNotes).employer,
  );

  const iso = (() => {
    const d = new Date(localStr);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  })();

  return (
    <form action={formAction} className="space-y-4">
      {employeeNote !== "" && (
        <div className="rounded-lg border border-border bg-surface-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Nota del empleado
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm italic text-foreground">
            {employeeNote}
          </p>
        </div>
      )}

      <Field>
        <Label htmlFor="clock_out_local">Hora de salida</Label>
        <input
          id="clock_out_local"
          type="datetime-local"
          required
          value={localStr}
          min={toLocalDatetimeValue(new Date(minIso))}
          onChange={(e) => setLocalStr(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgb(var(--ring-color)_/_0.18)]"
        />
        <input type="hidden" name="clock_out_iso" value={iso} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="status">Estado</Label>
          <Select
            id="status"
            name="status"
            defaultValue={initialStatus === "open" ? "closed" : initialStatus}
          >
            <option value="closed">Cerrado</option>
            <option value="needs_review">Marcar para revisar</option>
          </Select>
          <Hint>
            &quot;Marcar para revisar&quot; lo deja pendiente para volver más
            tarde, sin aprobarlo.
          </Hint>
        </Field>

        <Field>
          <Label htmlFor="employer_note">Tu nota</Label>
          <textarea
            id="employer_note"
            rows={1}
            value={employerNote}
            onChange={(e) => setEmployerNote(e.target.value)}
            maxLength={500}
            className="min-h-[2.5rem] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgb(var(--ring-color)_/_0.18)]"
          />
          {employeeNote !== "" && (
            <Hint>Se suma a la nota del empleado, no la reemplaza.</Hint>
          )}
          <input
            type="hidden"
            name="notes"
            value={composeNotes(employeeNote, employerNote)}
          />
        </Field>
      </div>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      {/*
        Two submit buttons sharing the same form. The clicked button's
        name+value is what ends up in FormData, so we differentiate by
        whether `also_verify=1` is present.
      */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SubmitButton variant="secondary" fullWidth={false}>
          <Save className="h-4 w-4" aria-hidden />
          Solo guardar
        </SubmitButton>
        {!alreadyVerified && (
          <SubmitButton
            fullWidth={false}
            className="min-w-[11rem]"
            name="also_verify"
            value="1"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Guardar y aprobar
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
