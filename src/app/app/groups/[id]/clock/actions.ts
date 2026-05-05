"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_in", {
    target_group_id: groupId,
    target_expected_minutes: expectedMinutes,
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

  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_out", {
    target_group_id: groupId,
    notes_text: notes || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/groups/${groupId}`);
  revalidatePath("/app");
  return { error: null };
}
