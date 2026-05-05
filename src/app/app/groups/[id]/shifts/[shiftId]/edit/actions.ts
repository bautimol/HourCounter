"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EditShiftState = {
  error: string | null;
};

export async function updateShiftAction(
  groupId: string,
  shiftId: string,
  _prevState: EditShiftState,
  formData: FormData,
): Promise<EditShiftState> {
  const clockOutIso = String(formData.get("clock_out_iso") ?? "").trim();
  const notes = String(formData.get("notes") ?? "");

  if (!clockOutIso) {
    return { error: "Hora de salida obligatoria" };
  }

  const parsed = new Date(clockOutIso);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "Hora de salida inválida" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_time_entry", {
    entry_id: shiftId,
    new_clock_out: parsed.toISOString(),
    new_notes: notes,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/groups/${groupId}`);
  redirect(`/app/groups/${groupId}`);
}
