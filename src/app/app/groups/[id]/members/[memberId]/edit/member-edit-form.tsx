"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import {
  ErrorMessage,
  Field,
  Hint,
  Input,
  Label,
} from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { paymentPeriodLabel, formatCurrency } from "@/lib/format";

export type MemberEditState = { error: string | null };

const initialState: MemberEditState = { error: null };

export type PositionOption = {
  id: string;
  name: string;
  hourly_rate: number;
  payment_period: string;
  custom_period_days: number | null;
  currency: string;
};

export type MemberEditInitial = {
  displayName: string;
  positionId: string | null;
  hourlyRateOverride: string;
  paymentPeriodOverride: string;
  customPeriodDaysOverride: string;
  currencyOverride: string;
};

export function MemberEditForm({
  action,
  positions,
  initial,
}: {
  action: (
    prev: MemberEditState,
    fd: FormData,
  ) => Promise<MemberEditState>;
  positions: PositionOption[];
  initial: MemberEditInitial;
}) {
  const [state, formAction] = useActionState(action, initialState);

  const [positionId, setPositionId] = useState(initial.positionId ?? "");

  // When there is no position, every scalar override is forced on.
  const noPosition = positionId === "";

  const [overrideRate, setOverrideRate] = useState(
    noPosition || initial.hourlyRateOverride !== "",
  );
  const [overridePeriod, setOverridePeriod] = useState(
    noPosition || initial.paymentPeriodOverride !== "",
  );
  const [overrideCurrency, setOverrideCurrency] = useState(
    noPosition || initial.currencyOverride !== "",
  );

  const [rateValue, setRateValue] = useState(initial.hourlyRateOverride);
  const [periodValue, setPeriodValue] = useState(
    initial.paymentPeriodOverride || "weekly",
  );
  const [customDaysValue, setCustomDaysValue] = useState(
    initial.customPeriodDaysOverride,
  );
  const [currencyValue, setCurrencyValue] = useState(
    initial.currencyOverride || "ARS",
  );

  const selectedPosition = useMemo(
    () => positions.find((p) => p.id === positionId) ?? null,
    [positions, positionId],
  );

  function onPositionChange(next: string) {
    setPositionId(next);
    if (next === "") {
      // Forced on for ad-hoc employees.
      setOverrideRate(true);
      setOverridePeriod(true);
      setOverrideCurrency(true);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      <Field>
        <Label htmlFor="display_name">Nombre</Label>
        <Input
          id="display_name"
          name="display_name"
          required
          maxLength={120}
          defaultValue={initial.displayName}
        />
      </Field>

      <Field>
        <Label htmlFor="position_id">Rol</Label>
        <Select
          id="position_id"
          name="position_id"
          value={positionId}
          onChange={(e) => onPositionChange(e.target.value)}
        >
          <option value="">Sin rol (configuración manual)</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        {selectedPosition && (
          <Hint>
            Por defecto hereda{" "}
            {formatCurrency(
              selectedPosition.hourly_rate,
              selectedPosition.currency,
            )}{" "}
            / hora ·{" "}
            {paymentPeriodLabel(
              selectedPosition.payment_period,
              selectedPosition.custom_period_days,
            )}{" "}
            · {selectedPosition.currency}
          </Hint>
        )}
      </Field>

      <div className="space-y-4 rounded-md border border-border bg-surface-muted/30 p-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {noPosition ? "Configuración" : "Sobrescribir valores del rol"}
        </h3>

        <OverrideField
          label="Tarifa por hora"
          name="hourly_rate"
          checked={overrideRate}
          onCheckedChange={setOverrideRate}
          forceOn={noPosition}
          inherited={
            selectedPosition
              ? formatCurrency(
                  selectedPosition.hourly_rate,
                  selectedPosition.currency,
                )
              : null
          }
        >
          <Input
            id="hourly_rate"
            name="hourly_rate"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required={overrideRate}
            placeholder="0.00"
            value={rateValue}
            onChange={(e) => setRateValue(e.target.value)}
          />
        </OverrideField>

        <OverrideField
          label="Período de pago"
          name="payment_period"
          checked={overridePeriod}
          onCheckedChange={setOverridePeriod}
          forceOn={noPosition}
          inherited={
            selectedPosition
              ? paymentPeriodLabel(
                  selectedPosition.payment_period,
                  selectedPosition.custom_period_days,
                )
              : null
          }
        >
          <Select
            id="payment_period"
            name="payment_period"
            value={periodValue}
            onChange={(e) => setPeriodValue(e.target.value)}
            required={overridePeriod}
          >
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quincenal</option>
            <option value="monthly">Mensual</option>
            <option value="custom_days">Personalizado</option>
          </Select>
          {periodValue === "custom_days" && (
            <Input
              name="custom_period_days"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              required={overridePeriod}
              placeholder="Cada cuántos días"
              value={customDaysValue}
              onChange={(e) => setCustomDaysValue(e.target.value)}
              className="mt-2"
            />
          )}
        </OverrideField>

        <OverrideField
          label="Moneda"
          name="currency"
          checked={overrideCurrency}
          onCheckedChange={setOverrideCurrency}
          forceOn={noPosition}
          inherited={selectedPosition?.currency ?? null}
        >
          <Input
            id="currency"
            name="currency"
            maxLength={3}
            pattern="[A-Za-z]{3}"
            required={overrideCurrency}
            value={currencyValue}
            onChange={(e) => setCurrencyValue(e.target.value)}
          />
          <Hint>Código ISO de 3 letras</Hint>
        </OverrideField>
      </div>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <div className="flex items-center justify-end gap-2">
        <SubmitButton fullWidth={false}>Guardar cambios</SubmitButton>
      </div>
    </form>
  );
}

function OverrideField({
  label,
  name,
  checked,
  onCheckedChange,
  forceOn,
  inherited,
  children,
}: {
  label: string;
  name: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  forceOn: boolean;
  inherited: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {!forceOn && (
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-accent"
              checked={checked}
              onChange={(e) => onCheckedChange(e.target.checked)}
            />
            Sobrescribir
          </label>
        )}
      </div>
      {checked ? (
        <>
          {/*
            Marker so the server action knows this field is overridden.
            When the override is off we don't render an input named `${name}`,
            so the server defaults to NULL (inherit).
          */}
          <input type="hidden" name={`${name}_overridden`} value="1" />
          {children}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Hereda del rol{inherited ? `: ${inherited}` : ""}
        </p>
      )}
    </div>
  );
}

