"use client";

import { useActionState, useState } from "react";
import { changeRateAction, type ChangeRateState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import {
  ErrorMessage,
  Field,
  Hint,
  Input,
  Label,
} from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

const initialState: ChangeRateState = { error: null };

export function RateForm({
  groupId,
  memberId,
  profileId,
  currentRate,
  currency,
  today,
}: {
  groupId: string;
  memberId: string;
  profileId: string;
  currentRate: number | null;
  currency: string;
  today: string; // YYYY-MM-DD, AR
}) {
  const action = changeRateAction.bind(null, groupId, memberId, profileId);
  const [state, formAction] = useActionState(action, initialState);

  const [rate, setRate] = useState(
    currentRate != null ? String(currentRate) : "",
  );
  const [effFrom, setEffFrom] = useState(today);

  const isRetroactive = effFrom < today;

  return (
    <form action={formAction} className="space-y-6">
      <Field>
        <Label htmlFor="hourly_rate">Nueva tarifa por hora</Label>
        <Input
          id="hourly_rate"
          name="hourly_rate"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          required
          autoFocus
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
        {currentRate != null && (
          <Hint>
            Tarifa actual: {formatCurrency(currentRate, currency)} / hora.
          </Hint>
        )}
      </Field>

      <Field>
        <Label htmlFor="effective_from">Vigente desde</Label>
        <Input
          id="effective_from"
          name="effective_from"
          type="date"
          required
          value={effFrom}
          max={today}
          onChange={(e) => setEffFrom(e.target.value)}
        />
        <Hint>
          Los turnos <strong>anteriores</strong> a esta fecha quedan con la
          tarifa actual
          {currentRate != null
            ? ` (${formatCurrency(currentRate, currency)})`
            : ""}
          . Los de esa fecha en adelante usan la nueva. Los turnos ya pagados no
          se tocan.
        </Hint>
      </Field>

      <div
        className={`rounded-lg border px-4 py-3 text-xs ${
          isRetroactive
            ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
            : "border-border bg-surface-muted/40 text-muted-foreground"
        }`}
      >
        {isRetroactive ? (
          <>
            Estás aplicando la nueva tarifa de forma <strong>retroactiva</strong>{" "}
            a los turnos sin pagar desde {effFrom}.
          </>
        ) : (
          <>
            La nueva tarifa aplica solo de hoy en adelante. Los turnos ya
            trabajados mantienen la tarifa actual.
          </>
        )}
      </div>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <div className="flex items-center justify-end">
        <SubmitButton fullWidth={false}>Guardar tarifa</SubmitButton>
      </div>
    </form>
  );
}
