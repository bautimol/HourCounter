"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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

type Frequency =
  | "per_period"
  | "per_day_worked"
  | "every_n_days"
  | "one_shot";

export type MemberEditInitial = {
  displayName: string;
  nickname: string;
  notes: string;
  positionId: string | null;
  hourlyRateOverride: string;
  paymentPeriodOverride: string;
  customPeriodDaysOverride: string;
  currencyOverride: string;
  fixedAmounts: {
    description: string;
    amount: string;
    frequency: Frequency;
    customDays: string;
  }[];
};

type FixedAmountRow = {
  key: string;
  description: string;
  amount: string;
  frequency: Frequency;
  customDays: string;
};

function newRow(): FixedAmountRow {
  return {
    key: crypto.randomUUID(),
    description: "",
    amount: "",
    frequency: "per_period",
    customDays: "",
  };
}

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

  const [rows, setRows] = useState<FixedAmountRow[]>(() =>
    initial.fixedAmounts.map((fa) => ({
      key: crypto.randomUUID(),
      description: fa.description,
      amount: fa.amount,
      frequency: fa.frequency,
      customDays: fa.customDays,
    })),
  );

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }
  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }
  function updateRow(key: string, patch: Partial<FixedAmountRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  const selectedPosition = useMemo(
    () => positions.find((p) => p.id === positionId) ?? null,
    [positions, positionId],
  );

  function onPositionChange(next: string) {
    setPositionId(next);
    if (next === "") {
      setOverrideRate(true);
      setOverridePeriod(true);
      setOverrideCurrency(true);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      <Field>
        <Label htmlFor="display_name">Nombre del empleado</Label>
        <Input
          id="display_name"
          value={initial.displayName}
          readOnly
          disabled
          className="cursor-not-allowed"
        />
        <Hint>Solo el empleado puede cambiar su nombre desde su perfil.</Hint>
      </Field>

      <Field>
        <Label htmlFor="nickname">Apodo (solo lo ves vos)</Label>
        <Input
          id="nickname"
          name="nickname"
          maxLength={120}
          defaultValue={initial.nickname}
        />
        <Hint>
          Este apodo lo ves solo vos. Otros empleadores y el empleado siguen
          viendo el nombre real.
        </Hint>
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

      <Field>
        <Label htmlFor="notes">Notas (compartidas con los empleadores)</Label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={initial.notes}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <Hint>El empleado no ve estas notas. Otros empleadores sí.</Hint>
      </Field>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Label>Montos fijos</Label>
            <Hint>Viáticos, premios, comida, etc. (específicos del empleado)</Hint>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addRow}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Agregar
          </Button>
        </div>

        {rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.key}
                className="space-y-2 rounded-md border border-border bg-surface-muted/40 p-2"
              >
                <div className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-12 sm:col-span-5">
                    <Input
                      name="fixed_description"
                      placeholder="Descripción"
                      value={row.description}
                      onChange={(e) =>
                        updateRow(row.key, { description: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <Input
                      name="fixed_amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder="Monto"
                      value={row.amount}
                      onChange={(e) =>
                        updateRow(row.key, { amount: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <Select
                      name="fixed_frequency"
                      value={row.frequency}
                      onChange={(e) =>
                        updateRow(row.key, {
                          frequency: e.target.value as Frequency,
                          customDays:
                            e.target.value === "every_n_days"
                              ? row.customDays
                              : "",
                        })
                      }
                    >
                      <option value="per_period">Por período</option>
                      <option value="per_day_worked">Por día trabajado</option>
                      <option value="every_n_days">Cada N días</option>
                      <option value="one_shot">Único</option>
                    </Select>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      aria-label="Quitar"
                      onClick={() => removeRow(row.key)}
                      className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>

                {row.frequency === "every_n_days" && (
                  <div className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-12 sm:col-span-5 sm:col-start-6">
                      <Input
                        name="fixed_custom_days"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        required
                        placeholder="Cada cuántos días"
                        value={row.customDays}
                        onChange={(e) =>
                          updateRow(row.key, { customDays: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}

                {row.frequency !== "every_n_days" && (
                  <input type="hidden" name="fixed_custom_days" value="" />
                )}
              </li>
            ))}
          </ul>
        )}
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
