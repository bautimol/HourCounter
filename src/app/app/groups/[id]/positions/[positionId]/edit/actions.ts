"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PositionFormState } from "../../position-form";
import { parsePositionForm } from "../../_form-parsing";

export async function updatePositionAction(
  groupId: string,
  positionId: string,
  _prevState: PositionFormState,
  formData: FormData,
): Promise<PositionFormState> {
  const parsed = parsePositionForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const {
    name,
    hourlyRate,
    paymentPeriod,
    customPeriodDays,
    currency,
    fixedAmounts,
  } = parsed.value;

  const supabase = await createClient();

  const { error } = await supabase.rpc("update_position", {
    target_position_id: positionId,
    new_name: name,
    new_hourly_rate: hourlyRate,
    new_payment_period: paymentPeriod,
    new_custom_period_days: customPeriodDays,
    new_currency: currency,
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

  revalidatePath(`/app/groups/${groupId}/positions`);
  revalidatePath(`/app/groups/${groupId}/positions/${positionId}`);
  redirect(`/app/groups/${groupId}/positions/${positionId}`);
}

export type DeletePositionState = { error: string | null };

export async function deletePositionAction(
  groupId: string,
  positionId: string,
  _prevState: DeletePositionState,
  _formData: FormData,
): Promise<DeletePositionState> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_position", {
    target_position_id: positionId,
  });

  if (error) {
    if (error.message.startsWith("POSITION_IN_USE:")) {
      const count = error.message.split(":")[1] ?? "?";
      return {
        error: `No se puede eliminar: ${count} empleado(s) usan este rol. Cambialos de rol primero.`,
      };
    }
    return { error: error.message };
  }

  revalidatePath(`/app/groups/${groupId}/positions`);
  redirect(`/app/groups/${groupId}/positions`);
}
