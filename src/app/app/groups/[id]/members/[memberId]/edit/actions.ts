"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MemberEditState } from "./member-edit-form";

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

export async function updateMemberAction(
  groupId: string,
  memberId: string,
  _prevState: MemberEditState,
  formData: FormData,
): Promise<MemberEditState> {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const positionRaw = String(formData.get("position_id") ?? "").trim();
  const positionId = positionRaw === "" ? null : positionRaw;

  const rateOn = formData.get("hourly_rate_overridden") === "1";
  const periodOn = formData.get("payment_period_overridden") === "1";
  const currencyOn = formData.get("currency_overridden") === "1";

  if (positionId === null && (!rateOn || !periodOn)) {
    return {
      error:
        "Sin rol asignado, la tarifa por hora y el período de pago son obligatorios",
    };
  }

  let hourlyRate: number | null = null;
  if (rateOn) {
    hourlyRate = Number(formData.get("hourly_rate"));
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      return { error: "Tarifa por hora inválida" };
    }
  }

  let paymentPeriod: PaymentPeriod | null = null;
  let customPeriodDays: number | null = null;
  if (periodOn) {
    const periodRaw = String(formData.get("payment_period") ?? "");
    if (!PAYMENT_PERIODS.includes(periodRaw as PaymentPeriod)) {
      return { error: "Período de pago inválido" };
    }
    paymentPeriod = periodRaw as PaymentPeriod;
    if (paymentPeriod === "custom_days") {
      const cd = Number(formData.get("custom_period_days"));
      if (!Number.isInteger(cd) || cd <= 0) {
        return { error: "Cantidad de días inválida" };
      }
      customPeriodDays = cd;
    }
  }

  let currency: string | null = null;
  if (currencyOn) {
    currency = String(formData.get("currency") ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      return { error: "Moneda inválida (ISO de 3 letras)" };
    }
  }

  // Parse the parallel fixed-amounts arrays (same shape as position-form).
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
    if (!desc) continue;
    const amt = Number(amounts[i]);
    const freq = frequencies[i] as FixedFrequency;
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

  const { error } = await supabase.rpc("update_member_full", {
    target_member_id: memberId,
    new_nickname: nickname || null,
    new_position_id: positionId,
    new_hourly_rate: hourlyRate,
    new_payment_period: paymentPeriod,
    new_custom_period_days: customPeriodDays,
    new_currency: currency,
    new_notes: notes || null,
    new_fixed_amounts: fixedAmounts.map((fa) => ({
      description: fa.description,
      amount: fa.amount,
      frequency: fa.frequency,
      custom_days: fa.custom_days,
    })),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/groups/${groupId}/members/${memberId}`);
  revalidatePath(`/app/groups/${groupId}`);
  redirect(`/app/groups/${groupId}/members/${memberId}`);
}
