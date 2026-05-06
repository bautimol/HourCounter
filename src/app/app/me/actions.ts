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

// ---------------------------------------------------------------------------
// Avatar upload
// ---------------------------------------------------------------------------

export type UpdateMyAvatarState = {
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
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

export async function updateMyAvatarAction(
  _prevState: UpdateMyAvatarState,
  formData: FormData,
): Promise<UpdateMyAvatarState> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Subí una imagen", ok: false };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { error: "Formato no soportado (usá PNG, JPG, WEBP o GIF)", ok: false };
  }
  if (file.size > MAX_BYTES) {
    return { error: "La imagen excede 2MB", ok: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada", ok: false };

  // Stable path so a re-upload overwrites the previous file. We store under
  // <userId>/avatar — no extension; the content-type carries the format. The
  // Storage RLS policy gates writes by foldername == auth.uid().
  const path = `${user.id}/avatar`;

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

  // Cache-bust the public URL — same path → same URL → browsers may serve
  // the old image.
  const versioned = `${publicUrl}?v=${Date.now()}`;

  const { error: rpcErr } = await supabase.rpc("update_my_avatar", {
    new_url: versioned,
  });

  if (rpcErr) return { error: rpcErr.message, ok: false };

  revalidatePath("/app", "layout");
  return { error: null, ok: true };
}

export async function clearMyAvatarAction(): Promise<UpdateMyAvatarState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada", ok: false };

  // Best-effort delete from storage; if it fails (e.g. no file), still clear
  // the URL in DB so the UI matches.
  await supabase.storage.from("avatars").remove([`${user.id}/avatar`]);

  const { error } = await supabase.rpc("update_my_avatar", { new_url: null });
  if (error) return { error: error.message, ok: false };

  revalidatePath("/app", "layout");
  return { error: null, ok: true };
}
