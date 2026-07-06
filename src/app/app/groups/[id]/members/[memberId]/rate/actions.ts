"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ChangeRateState = { error: string | null };

export async function changeRateAction(
  groupId: string,
  memberId: string,
  profileId: string,
  _prev: ChangeRateState,
  formData: FormData,
): Promise<ChangeRateState> {
  const rateRaw = String(formData.get("hourly_rate") ?? "").trim();
  const effFrom = String(formData.get("effective_from") ?? "").trim();

  const rate = Number(rateRaw);
  if (!Number.isFinite(rate) || rate < 0) {
    return { error: "Tarifa por hora inválida" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effFrom)) {
    return { error: "Fecha de vigencia inválida" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_employee_rate", {
    target_profile_id: profileId,
    new_rate: rate,
    effective_from: effFrom,
  });

  if (error) return { error: error.message };

  revalidatePath(`/app/groups/${groupId}/members/${memberId}`);
  revalidatePath(`/app/groups/${groupId}/reports`);
  redirect(`/app/groups/${groupId}/members/${memberId}`);
}
