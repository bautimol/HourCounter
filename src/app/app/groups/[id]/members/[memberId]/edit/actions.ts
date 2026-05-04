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

export async function updateMemberAction(
  groupId: string,
  memberId: string,
  _prevState: MemberEditState,
  formData: FormData,
): Promise<MemberEditState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const positionRaw = String(formData.get("position_id") ?? "").trim();
  const positionId = positionRaw === "" ? null : positionRaw;

  if (!displayName) return { error: "El nombre es obligatorio" };

  // Each "*_overridden" hidden field is present iff the user toggled the
  // override on. When absent, we send NULL to the DB (inherit from position).
  const rateOn = formData.get("hourly_rate_overridden") === "1";
  const periodOn = formData.get("payment_period_overridden") === "1";
  const currencyOn = formData.get("currency_overridden") === "1";

  // Sanity: an ad-hoc employee (no position) must have rate + period set.
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

  const supabase = await createClient();

  // Update member display name.
  const { error: memberError } = await supabase
    .from("group_members")
    .update({ display_name: displayName })
    .eq("id", memberId)
    .eq("group_id", groupId);

  if (memberError) {
    return { error: memberError.message };
  }

  // Upsert employee_profile. We look it up by member; if missing we insert.
  const { data: existing } = await supabase
    .from("employee_profiles")
    .select("id")
    .eq("group_member_id", memberId)
    .maybeSingle();

  const profilePayload = {
    position_id: positionId,
    hourly_rate: hourlyRate,
    payment_period: paymentPeriod,
    custom_period_days: customPeriodDays,
    currency,
  };

  if (existing) {
    const { error } = await supabase
      .from("employee_profiles")
      .update(profilePayload)
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("employee_profiles")
      .insert({ group_member_id: memberId, ...profilePayload });
    if (error) return { error: error.message };
  }

  revalidatePath(`/app/groups/${groupId}/members/${memberId}`);
  revalidatePath(`/app/groups/${groupId}`);
  redirect(`/app/groups/${groupId}/members/${memberId}`);
}
