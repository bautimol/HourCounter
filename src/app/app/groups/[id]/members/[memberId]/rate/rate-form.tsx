"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
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
      {state.changed && (
        <RateChangeReceipt
          changed={state.changed}
          currency={currency}
          groupId={groupId}
          memberId={memberId}
        />
      )}

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

/**
 * What the rate change actually did. Shown in place instead of after a
 * redirect: the frozen-shifts count only exists in the action's return value.
 */
function RateChangeReceipt({
  changed,
  currency,
  groupId,
  memberId,
}: {
  changed: NonNullable<ChangeRateState["changed"]>;
  currency: string;
  groupId: string;
  memberId: string;
}) {
  // "2026-08-01" → "01/08". Parsing it as a Date would land on the previous
  // day: the string is UTC midnight and we render in AR (UTC-3).
  const [, month, day] = changed.effectiveFrom.split("-");
  const frozen = changed.frozenShifts;

  return (
    <div className="rounded-lg border border-accent-soft bg-accent-soft p-4 text-sm text-accent-soft-foreground">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Listo: la tarifa nueva es{" "}
        {formatCurrency(changed.newRate, currency)} desde el {day}/{month}.
      </p>
      <p className="mt-1.5">
        {frozen === 0
          ? "No había turnos sin pagar anteriores a esa fecha, así que no congelamos ninguno."
          : `Congelamos ${frozen} ${frozen === 1 ? "turno anterior" : "turnos anteriores"} a ${
              changed.oldRate != null
                ? formatCurrency(changed.oldRate, currency)
                : "la tarifa vieja"
            }.`}
      </p>
      <Link
        href={`/app/groups/${groupId}/members/${memberId}`}
        className="mt-3 inline-block font-medium underline underline-offset-2"
      >
        Volver a la ficha del empleado
      </Link>
    </div>
  );
}
