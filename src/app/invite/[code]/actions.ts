"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AcceptInvitationState = {
  error: string | null;
};

export async function acceptInvitationAction(
  code: string,
  _prevState: AcceptInvitationState,
  _formData: FormData,
): Promise<AcceptInvitationState> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("accept_invitation", {
    invite_code: code,
  });

  if (error) {
    return { error: error.message };
  }

  const groupId = data as unknown as string | null;
  if (!groupId) {
    return { error: "No se pudo unir al grupo" };
  }

  revalidatePath("/", "layout");
  redirect(`/app/groups/${groupId}`);
}
