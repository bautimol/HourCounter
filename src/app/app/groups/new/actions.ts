"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreateGroupState = {
  error: string | null;
};

export async function createGroupAction(
  _prevState: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "El nombre es obligatorio" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("create_group_with_owner", { group_name: name })
    .single<{ id: string }>();

  if (error) {
    return { error: error.message };
  }

  if (!data?.id) {
    return { error: "No se pudo crear el grupo" };
  }

  revalidatePath("/app");
  redirect(`/app/groups/${data.id}`);
}
