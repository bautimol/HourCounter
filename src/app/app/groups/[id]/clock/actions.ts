"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUsers } from "@/lib/push";

export type ClockState = {
  error: string | null;
};

export async function clockInAction(
  groupId: string,
  _prevState: ClockState,
  formData: FormData,
): Promise<ClockState> {
  const hoursRaw = String(formData.get("expected_h") ?? "").trim();
  const minutesRaw = String(formData.get("expected_m") ?? "").trim();

  let expectedMinutes: number | null = null;
  if (hoursRaw !== "" || minutesRaw !== "") {
    const hours = hoursRaw === "" ? 0 : Number(hoursRaw);
    const minutes = minutesRaw === "" ? 0 : Number(minutesRaw);

    if (!Number.isInteger(hours) || hours < 0 || hours > 24) {
      return { error: "Horas inválidas (0 a 24)" };
    }
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
      return { error: "Minutos inválidos (0 a 59)" };
    }

    const total = hours * 60 + minutes;
    if (total <= 0) {
      return { error: "La duración estimada debe ser mayor a 0" };
    }
    if (total > 24 * 60) {
      return { error: "La duración estimada no puede superar las 24 horas" };
    }
    expectedMinutes = total;
  }

  const latRaw = String(formData.get("clock_in_lat") ?? "").trim();
  const lngRaw = String(formData.get("clock_in_lng") ?? "").trim();
  const lat = latRaw === "" ? null : Number(latRaw);
  const lng = lngRaw === "" ? null : Number(lngRaw);
  const validLat = lat !== null && Number.isFinite(lat) && lat >= -90 && lat <= 90;
  const validLng = lng !== null && Number.isFinite(lng) && lng >= -180 && lng <= 180;

  // Click timestamp from the browser. The DB validates it to ±60s and
  // falls back to server now() if outside the window. See migration 0017.
  const clientClickIso = String(formData.get("client_click_iso") ?? "").trim();
  const validClick =
    clientClickIso !== "" && !Number.isNaN(new Date(clientClickIso).getTime());

  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_in", {
    target_group_id: groupId,
    target_expected_minutes: expectedMinutes,
    target_lat: validLat ? lat : null,
    target_lng: validLng ? lng : null,
    target_clock_in_iso: validClick ? clientClickIso : null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/groups/${groupId}`);
  revalidatePath("/app");
  return { error: null };
}

export async function clockOutAction(
  groupId: string,
  _prevState: ClockState,
  formData: FormData,
): Promise<ClockState> {
  const notes = String(formData.get("notes") ?? "").trim();

  const clientClickIso = String(formData.get("client_click_iso") ?? "").trim();
  const validClick =
    clientClickIso !== "" && !Number.isNaN(new Date(clientClickIso).getTime());

  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_out", {
    target_group_id: groupId,
    notes_text: notes || null,
    target_clock_out_iso: validClick ? clientClickIso : null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/groups/${groupId}`);
  revalidatePath("/app");

  // Notify the group's employers that there's a fresh shift to verify.
  // Best-effort: never block the response on push delivery; never bubble
  // failures back to the user.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [{ data: group }, { data: myMembership }, { data: employers }] =
      await Promise.all([
        supabase.from("groups").select("name").eq("id", groupId).maybeSingle(),
        supabase
          .from("group_members")
          .select("display_name")
          .eq("group_id", groupId)
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", groupId)
          .eq("role", "employer")
          .eq("status", "active"),
      ]);

    const employeeName = myMembership?.display_name ?? "Un empleado";
    const groupName = group?.name ?? "el grupo";
    const targets = (employers ?? [])
      .map((e) => e.user_id)
      .filter((id): id is string => Boolean(id) && id !== user?.id);

    if (targets.length > 0) {
      await sendPushToUsers(targets, {
        title: groupName,
        body: `${employeeName} cerró un turno`,
        url: `/app/groups/${groupId}/shifts`,
        tag: `shift-closed-${groupId}`,
      });
    }
  } catch {
    // Swallow — push is fire-and-forget.
  }

  return { error: null };
}
