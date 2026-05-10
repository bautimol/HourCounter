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
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

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
    return { error: "La imagen excede 5MB", ok: false };
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

// ---------------------------------------------------------------------------
// Push subscriptions
// ---------------------------------------------------------------------------

export type PushSubState = {
  error: string | null;
  ok: boolean;
};

/**
 * Persists a PushSubscription that the browser obtained via
 * registration.pushManager.subscribe(). Idempotent on (user_id, endpoint).
 */
export async function subscribeToPushAction(
  _prevState: PushSubState,
  formData: FormData,
): Promise<PushSubState> {
  const endpoint = String(formData.get("endpoint") ?? "").trim();
  const p256dh = String(formData.get("p256dh") ?? "").trim();
  const authKey = String(formData.get("auth") ?? "").trim();
  const userAgent = String(formData.get("user_agent") ?? "").trim() || null;

  if (!endpoint || !p256dh || !authKey) {
    return { error: "Faltan datos de la suscripción", ok: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada", ok: false };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      keys_p256dh: p256dh,
      keys_auth: authKey,
      user_agent: userAgent,
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) return { error: error.message, ok: false };
  return { error: null, ok: true };
}

export async function unsubscribeFromPushAction(
  _prevState: PushSubState,
  formData: FormData,
): Promise<PushSubState> {
  const endpoint = String(formData.get("endpoint") ?? "").trim();
  if (!endpoint) return { error: "Falta endpoint", ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada", ok: false };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) return { error: error.message, ok: false };
  return { error: null, ok: true };
}
