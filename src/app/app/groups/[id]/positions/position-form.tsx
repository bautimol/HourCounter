"use client";

import { useActionState, useState } from "react";
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

export type PositionFormState = {
  error: string | null;
};

type Frequency =
  | "per_period"
  | "per_day_worked"
  | "every_n_days"
  | "one_shot";

type FixedAmountRow = {
  key: string;
  description: string;
  amount: string;
  frequency: Frequency;
  customDays: string;
};

export type PositionFormInitial = {
  name: string;
  hourlyRate: string;
  paymentPeriod: string;
  customPeriodDays: string;
  currency: string;
  fixedAmounts: {
    description: string;
    amount: string;
    frequency: Frequency;
    customDays: string;
  }[];
};

const initialState: PositionFormState = { error: null };

function newRow(): FixedAmountRow {
  return {
    key: crypto.randomUUID(),
    description: "",
    amount: "",
    frequency: "per_period",
    customDays: "",
  };
}

function rowsFromInitial(initial?: PositionFormInitial): FixedAmountRow[] {
  if (!initial) return [];
  return initial.fixedAmounts.map((fa) => ({
    key: crypto.randomUUID(),
    description: fa.description,
    amount: fa.amount,
    frequency: fa.frequency,
    customDays: fa.customDays,
  }));
}

export function PositionForm({
  action,
  initial,
  submitLabel,
}: {
  action: (
    prevState: PositionFormState,
    formData: FormData,
  ) => Promise<PositionFormState>;
  initial?: PositionFormInitial;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  const [paymentPeriod, setPaymentPeriod] = useState(
    initial?.paymentPeriod ?? "weekly",
  );
  const [rows, setRows] = useState<FixedAmountRow[]>(() =>
    rowsFromInitial(initial),
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

  return (
    <form action={formAction} className="space-y-6">
      <Field>
        <Label htmlFor="name">Nombre del rol</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={80}
          autoFocus
          defaultValue={initial?.name ?? ""}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="hourly_rate">Tarifa por hora</Label>
          <Input
            id="hourly_rate"
            name="hourly_rate"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            placeholder="0.00"
            defaultValue={initial?.hourlyRate ?? ""}
          />
        </Field>

        <Field>
          <Label htmlFor="currency">Moneda</Label>
          <Input
            id="currency"
            name="currency"
            defaultValue={initial?.currency ?? "ARS"}
            maxLength={3}
            pattern="[A-Za-z]{3}"
          />
          <Hint>Código ISO de 3 letras (ARS, USD, EUR…)</Hint>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="payment_period">Período de pago</Label>
          <Select
            id="payment_period"
            name="payment_period"
            value={paymentPeriod}
            onChange={(e) => setPaymentPeriod(e.target.value)}
          >
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quincenal</option>
            <option value="monthly">Mensual</option>
            <option value="custom_days">Personalizado</option>
          </Select>
        </Field>

        {paymentPeriod === "custom_days" && (
          <Field>
            <Label htmlFor="custom_period_days">Cada cuántos días</Label>
            <Input
              id="custom_period_days"
              name="custom_period_days"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              required
              defaultValue={initial?.customPeriodDays ?? ""}
            />
          </Field>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Label>Montos fijos (opcional)</Label>
            <Hint>Viáticos, premios, comida, etc.</Hint>
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

                {/*
                  Hidden input ensures `fixed_custom_days` always has the same
                  number of entries as the other parallel arrays (one per row),
                  even when the visible input is hidden because frequency
                  isn't every_n_days.
                */}
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
        <SubmitButton fullWidth={false}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
