"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreatePositionState = {
  error: string | null;
};

const PAYMENT_PERIODS = [
  "weekly",
  "biweekly",
  "monthly",
  "custom_days",
] as const;
type PaymentPeriod = (typeof PAYMENT_PERIODS)[number];

const FIXED_FREQUENCIES = [
  "per_period",
  "per_day_worked",
  "every_n_days",
  "one_shot",
] as const;
type FixedFrequency = (typeof FIXED_FREQUENCIES)[number];

export async function createPositionAction(
  groupId: string,
  _prevState: CreatePositionState,
  formData: FormData,
): Promise<CreatePositionState> {
  const name = String(formData.get("name") ?? "").trim();
  const hourlyRateRaw = String(formData.get("hourly_rate") ?? "").trim();
  const paymentPeriod = String(formData.get("payment_period") ?? "");
  const customDaysRaw = String(
    formData.get("custom_period_days") ?? "",
  ).trim();
  const currency =
    String(formData.get("currency") ?? "ARS").trim().toUpperCase() || "ARS";

  if (!name) return { error: "El nombre es obligatorio" };
  const hourlyRate = Number(hourlyRateRaw);
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
    return { error: "Tarifa por hora inválida" };
  }
  if (!PAYMENT_PERIODS.includes(paymentPeriod as PaymentPeriod)) {
    return { error: "Período de pago inválido" };
  }

  let customDays: number | null = null;
  if (paymentPeriod === "custom_days") {
    customDays = Number(customDaysRaw);
    if (!Number.isInteger(customDays) || customDays <= 0) {
      return { error: "Cantidad de días inválida" };
    }
  }

  // Fixed amounts: parallel arrays from repeated input names. The form
  // always emits one entry of `fixed_custom_days` per row (empty when the
  // frequency is not `every_n_days`) so the arrays stay aligned.
  const descriptions = formData.getAll("fixed_description").map(String);
  const amounts = formData.getAll("fixed_amount").map(String);
  const frequencies = formData.getAll("fixed_frequency").map(String);
  const customDaysList = formData.getAll("fixed_custom_days").map(String);

  if (
    descriptions.length !== amounts.length ||
    descriptions.length !== frequencies.length ||
    descriptions.length !== customDaysList.length
  ) {
    return { error: "Datos de montos fijos inconsistentes" };
  }

  const fixedAmounts: {
    description: string;
    amount: number;
    frequency: FixedFrequency;
    custom_days: number | null;
  }[] = [];

  for (let i = 0; i < descriptions.length; i++) {
    const desc = descriptions[i]!.trim();
    const amt = Number(amounts[i]);
    const freq = frequencies[i] as FixedFrequency;
    if (!desc) continue; // ignore empty rows
    if (!Number.isFinite(amt)) {
      return { error: `Monto inválido en "${desc}"` };
    }
    if (!FIXED_FREQUENCIES.includes(freq)) {
      return { error: `Frecuencia inválida en "${desc}"` };
    }

    let cd: number | null = null;
    if (freq === "every_n_days") {
      const raw = customDaysList[i]!.trim();
      cd = Number(raw);
      if (!Number.isInteger(cd) || cd <= 0) {
        return { error: `Cantidad de días inválida en "${desc}"` };
      }
    }

    fixedAmounts.push({
      description: desc,
      amount: amt,
      frequency: freq,
      custom_days: cd,
    });
  }

  const supabase = await createClient();

  const { data: position, error: positionError } = await supabase
    .from("positions")
    .insert({
      group_id: groupId,
      name,
      hourly_rate: hourlyRate,
      payment_period: paymentPeriod,
      custom_period_days: customDays,
      currency,
    })
    .select("id")
    .single();

  if (positionError || !position) {
    return { error: positionError?.message ?? "No se pudo crear el rol" };
  }

  if (fixedAmounts.length > 0) {
    const { error: faError } = await supabase
      .from("position_fixed_amounts")
      .insert(
        fixedAmounts.map((fa) => ({
          position_id: position.id,
          description: fa.description,
          amount: fa.amount,
          frequency: fa.frequency,
          custom_days: fa.custom_days,
        })),
      );

    if (faError) {
      return {
        error: `Rol creado, pero falló cargar montos fijos: ${faError.message}`,
      };
    }
  }

  revalidatePath(`/app/groups/${groupId}/positions`);
  redirect(`/app/groups/${groupId}/positions/${position.id}`);
}
