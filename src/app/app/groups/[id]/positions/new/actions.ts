"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PositionFormState } from "../position-form";
import { parsePositionForm } from "../_form-parsing";

export async function createPositionAction(
  groupId: string,
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

  const { data: position, error: positionError } = await supabase
    .from("positions")
    .insert({
      group_id: groupId,
      name,
      hourly_rate: hourlyRate,
      payment_period: paymentPeriod,
      custom_period_days: customPeriodDays,
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
