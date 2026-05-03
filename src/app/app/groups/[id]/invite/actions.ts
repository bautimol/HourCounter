"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreateInvitationState = {
  error: string | null;
  code: string | null;
};

export async function createInvitationAction(
  groupId: string,
  _prevState: CreateInvitationState,
  formData: FormData,
): Promise<CreateInvitationState> {
  const role = String(formData.get("role") ?? "employee");
  if (role !== "employer" && role !== "employee") {
    return { error: "Rol inválido", code: null };
  }

  const positionRaw = String(formData.get("position_id") ?? "").trim();
  const positionId =
    role === "employee" && positionRaw && positionRaw !== ""
      ? positionRaw
      : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    target_group_id: groupId,
    invite_role: role,
    invite_position_id: positionId,
  });

  if (error) {
    return { error: error.message, code: null };
  }

  revalidatePath(`/app/groups/${groupId}/invite`);
  return { error: null, code: data as unknown as string };
}
