"use client";

import { useActionState, useState } from "react";
import { Save, TimerOff } from "lucide-react";
import { updateAutoCloseAction, type AutoCloseState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorMessage, Field, Hint, Input, Label } from "@/components/ui/input";

const initialState: AutoCloseState = { error: null, ok: false };

/**
 * How long an open shift may run before the system closes it.
 *
 * The copy deliberately leads with the employee's problem, not with control:
 * an open shift blocks her NEXT clock-in (one_open_shift_per_profile), so
 * without this she cannot start working again. Framing it as "limitá la jornada"
 * would describe the same setting as a cap on how long someone may work, which
 * is not what it does and not what it is for.
 */
export function AutoCloseSection({
  groupId,
  initialMinutes,
}: {
  groupId: string;
  initialMinutes: number | null;
}) {
  const action = updateAutoCloseAction.bind(null, groupId);
  const [state, formAction] = useActionState(action, initialState);

  const [enabled, setEnabled] = useState(initialMinutes != null);
  const [hours, setHours] = useState(
    initialMinutes != null ? String(Math.round(initialMinutes / 60)) : "12",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Turnos que quedan abiertos</CardTitle>
      </CardHeader>
      <CardBody>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="enabled" value={enabled ? "1" : "0"} />

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-accent"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Cerrar solos los turnos olvidados
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Si alguien se olvida de fichar la salida, el turno queda abierto
                y no la deja volver a fichar. Con esto activado se cierra solo y
                te queda en «Para revisar» para que le pongas la hora real.
              </span>
            </span>
          </label>

          {enabled && (
            <Field>
              <Label htmlFor="hours">Después de cuántas horas</Label>
              <Input
                id="hours"
                name="hours"
                type="number"
                inputMode="numeric"
                min={4}
                max={24}
                step={1}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="max-w-28"
              />
              <Hint>
                Entre 4 y 24. Poné un número más alto que la jornada más larga
                que se trabaja acá, porque la hora que escribe el sistema es
                estimada: siempre tenés que corregirla antes de aprobar el turno.
              </Hint>
            </Field>
          )}

          {!enabled && (
            <Hint>
              Sin esto, un turno olvidado queda abierto para siempre y le bloquea
              la próxima fichada a esa persona hasta que alguien lo corrija a
              mano.
            </Hint>
          )}

          {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
          {state.ok && (
            <p className="text-sm text-accent-soft-foreground">Guardado.</p>
          )}

          <SubmitButton>
            {enabled ? (
              <Save className="h-4 w-4" aria-hidden />
            ) : (
              <TimerOff className="h-4 w-4" aria-hidden />
            )}
            Guardar
          </SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}
