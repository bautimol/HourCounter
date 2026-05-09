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

// ---- Geofence ----

export type GeofenceState = {
  error: string | null;
  ok: boolean;
};

export async function updateGeofenceAction(
  groupId: string,
  _prevState: GeofenceState,
  formData: FormData,
): Promise<GeofenceState> {
  const enabled = String(formData.get("enabled") ?? "0") === "1";
  const latRaw = String(formData.get("lat") ?? "").trim();
  const lngRaw = String(formData.get("lng") ?? "").trim();
  const radiusRaw = String(formData.get("radius_m") ?? "").trim();

  let lat: number | null = null;
  let lng: number | null = null;
  let radius: number | null = null;

  if (enabled) {
    if (!latRaw || !lngRaw || !radiusRaw) {
      return { error: "Completá lat / lng / radio", ok: false };
    }
    lat = Number(latRaw);
    lng = Number(lngRaw);
    radius = Number(radiusRaw);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return { error: "Latitud inválida (-90 a 90)", ok: false };
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return { error: "Longitud inválida (-180 a 180)", ok: false };
    }
    if (!Number.isInteger(radius) || radius < 10 || radius > 100_000) {
      return { error: "Radio inválido (10 a 100000 m)", ok: false };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_group_geofence", {
    target_group_id: groupId,
    new_enabled: enabled,
    new_lat: lat,
    new_lng: lng,
    new_radius_m: radius,
  });
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/app/groups/${groupId}/settings`);
  revalidatePath(`/app/groups/${groupId}`);
  return { error: null, ok: true };
}
