"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreatePaymentState = {
  error: string | null;
};

export type DeletePaymentState = {
  error: string | null;
};

export async function createPaymentAction(
  groupId: string,
  profileId: string,
  periodStartIso: string,
  periodEndIso: string,
  _prevState: CreatePaymentState,
  formData: FormData,
): Promise<CreatePaymentState> {
  const notes = String(formData.get("notes") ?? "").trim();

  // Adjustments come as parallel arrays from the inline editor.
  const descriptions = formData.getAll("adj_description").map(String);
  const amounts = formData.getAll("adj_amount").map(String);

  if (descriptions.length !== amounts.length) {
    return { error: "Datos de ajustes inconsistentes" };
  }

  const adjustments: { description: string; amount: number }[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const desc = descriptions[i]!.trim();
    const amtStr = amounts[i]!.trim();
    if (!desc && !amtStr) continue; // skip empty rows
    if (!desc) return { error: "Falta descripción en un ajuste" };
    const amt = Number(amtStr);
    if (!Number.isFinite(amt)) {
      return { error: `Monto inválido en "${desc}"` };
    }
    adjustments.push({ description: desc, amount: amt });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_payment", {
    target_profile_id: profileId,
    period_start_iso: periodStartIso,
    period_end_iso: periodEndIso,
    adjustments_jsonb: adjustments,
    notes_text: notes || null,
  });

  if (error) {
    return { error: error.message };
  }

  const paymentId = data as unknown as string | null;
  if (!paymentId) {
    return { error: "No se pudo crear el pago" };
  }

  revalidatePath(`/app/groups/${groupId}`);
  revalidatePath(`/app/groups/${groupId}/payments`);
  redirect(`/app/groups/${groupId}/payments/${paymentId}`);
}

export async function deletePaymentAction(
  groupId: string,
  paymentId: string,
  _prevState: DeletePaymentState,
  _formData: FormData,
): Promise<DeletePaymentState> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId);

  if (error) return { error: error.message };

  revalidatePath(`/app/groups/${groupId}/payments`);
  redirect(`/app/groups/${groupId}/payments`);
}
