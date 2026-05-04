"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateMyNameState = { error: string | null; ok: boolean };

export async function updateMyDisplayNameAction(
  _prevState: UpdateMyNameState,
  formData: FormData,
): Promise<UpdateMyNameState> {
  const name = String(formData.get("display_name") ?? "").trim();
  if (!name) return { error: "El nombre no puede estar vacío", ok: false };
  if (name.length > 120) {
    return { error: "Máximo 120 caracteres", ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_display_name", {
    new_name: name,
  });

  if (error) return { error: error.message, ok: false };

  revalidatePath("/app", "layout");
  return { error: null, ok: true };
}
