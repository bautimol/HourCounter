"use client";

import { useActionState, useState } from "react";
import { Coins, Plus, Trash2 } from "lucide-react";
import {
  createPaymentAction,
  type CreatePaymentState,
} from "../../../../payments/actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ErrorMessage,
  Field,
  Hint,
  Input,
  Label,
} from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

const initialState: CreatePaymentState = { error: null };

type AdjRow = {
  key: string;
  description: string;
  amount: string;
};

function newRow(): AdjRow {
  return { key: crypto.randomUUID(), description: "", amount: "" };
}

export function PaymentDraftForm({
  groupId,
  profileId,
  periodStartIso,
  periodEndIso,
  currency,
  subtotalBeforeAdjustments,
}: {
  groupId: string;
  profileId: string;
  periodStartIso: string;
  periodEndIso: string;
  currency: string;
  subtotalBeforeAdjustments: number;
}) {
  const action = createPaymentAction.bind(
    null,
    groupId,
    profileId,
    periodStartIso,
    periodEndIso,
  );
  const [state, formAction] = useActionState(action, initialState);

  const [rows, setRows] = useState<AdjRow[]>([]);

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }
  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }
  function updateRow(key: string, patch: Partial<AdjRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  // Live total preview using the values currently in the inputs.
  const adjTotal = rows.reduce<number>((sum, r) => {
    const n = Number(r.amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const total = subtotalBeforeAdjustments + adjTotal;

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Ajustes one-shot</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addRow}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Agregar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 pt-0">
          <Hint>
            Anticipos (negativo), premios puntuales (positivo), descuentos.
            Se aplican una sola vez en este pago.
          </Hint>

          {rows.length > 0 ? (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.key}
                  className="grid grid-cols-12 items-end gap-2 rounded-md border border-border bg-surface-muted/40 p-2"
                >
                  <div className="col-span-12 sm:col-span-7">
                    <Input
                      name="adj_description"
                      placeholder="Descripción (ej. Anticipo, Premio)"
                      value={row.description}
                      onChange={(e) =>
                        updateRow(row.key, { description: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-10 sm:col-span-4">
                    <Input
                      name="adj_amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder="Monto (negativo si descuenta)"
                      value={row.amount}
                      onChange={(e) =>
                        updateRow(row.key, { amount: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      aria-label="Quitar"
                      onClick={() => removeRow(row.key)}
                      className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              Sin ajustes. Si solo vas a pagar el subtotal calculado, dejalo
              así.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notas (opcional)</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          <Field>
            <Label htmlFor="notes">Para tu propio registro</Label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={500}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgb(var(--ring-color)_/_0.18)]"
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="py-5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-base font-medium">Total a pagar</span>
            <span className="text-2xl font-semibold tabular-nums">
              {formatCurrency(total, currency)}
            </span>
          </div>
          {adjTotal !== 0 && (
            <p className="mt-2 text-right text-xs text-muted-foreground tabular-nums">
              Subtotal {formatCurrency(subtotalBeforeAdjustments, currency)}{" "}
              {adjTotal >= 0 ? "+ " : "− "}
              {formatCurrency(Math.abs(adjTotal), currency)} ajustes
            </p>
          )}
        </CardBody>
      </Card>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <div className="flex justify-end">
        <SubmitButton size="lg" fullWidth={false} className="rounded-xl">
          <Coins className="h-5 w-5" aria-hidden />
          Confirmar pago
        </SubmitButton>
      </div>
    </form>
  );
}
