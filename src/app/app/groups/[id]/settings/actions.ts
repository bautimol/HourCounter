"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateGroupAvatarState = {
  error: string | null;
  ok: boolean;
};

const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB, same as user avatars.

export async function updateGroupAvatarAction(
  groupId: string,
  _prevState: UpdateGroupAvatarState,
  formData: FormData,
): Promise<UpdateGroupAvatarState> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Subí una imagen", ok: false };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { error: "Formato no soportado (usá PNG, JPG, WEBP o GIF)", ok: false };
  }
  if (file.size > MAX_BYTES) {
    return { error: "La imagen excede 5MB", ok: false };
  }

  const supabase = await createClient();

  // Group avatars live under groups/<groupId>/avatar in the same `avatars`
  // bucket. The Storage RLS policy gates uploads to this folder by employer
  // membership; the RPC below double-checks the same constraint at the DB
  // layer.
  const path = `groups/${groupId}/avatar`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });

  if (upErr) return { error: `Subida falló: ${upErr.message}`, ok: false };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const versioned = `${publicUrl}?v=${Date.now()}`;

  const { error: rpcErr } = await supabase.rpc("update_group_avatar", {
    target_group_id: groupId,
    new_url: versioned,
  });

  if (rpcErr) return { error: rpcErr.message, ok: false };

  revalidatePath(`/app/groups/${groupId}`, "layout");
  revalidatePath("/app");
  return { error: null, ok: true };
}

export async function clearGroupAvatarAction(
  groupId: string,
): Promise<UpdateGroupAvatarState> {
  const supabase = await createClient();

  // Best-effort delete from storage; clear the URL regardless so the UI
  // matches if the file is already gone.
  await supabase.storage.from("avatars").remove([`groups/${groupId}/avatar`]);

  const { error } = await supabase.rpc("update_group_avatar", {
    target_group_id: groupId,
    new_url: null,
  });
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/app/groups/${groupId}`, "layout");
  revalidatePath("/app");
  return { error: null, ok: true };
}
