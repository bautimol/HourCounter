"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ShiftActionState = {
  error: string | null;
};

const STATUSES = ["closed", "needs_review", "open"] as const;
type ShiftStatus = (typeof STATUSES)[number];

export async function verifyShiftAction(
  groupId: string,
  shiftId: string,
  _prevState: ShiftActionState,
  _formData: FormData,
): Promise<ShiftActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("verify_shift", {
    target_shift_id: shiftId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/app/groups/${groupId}/shifts`);
  revalidatePath(`/app/groups/${groupId}`);
  return { error: null };
}

export async function unverifyShiftAction(
  groupId: string,
  shiftId: string,
  _prevState: ShiftActionState,
  _formData: FormData,
): Promise<ShiftActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unverify_shift", {
    target_shift_id: shiftId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/app/groups/${groupId}/shifts`);
  revalidatePath(`/app/groups/${groupId}`);
  return { error: null };
}

export async function bulkVerifyShiftsAction(
  groupId: string,
  _prevState: ShiftActionState,
  formData: FormData,
): Promise<ShiftActionState> {
  const ids = formData.getAll("shift_id").map(String).filter(Boolean);
  if (ids.length === 0) {
    return { error: "Seleccioná al menos un turno" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("verify_shifts_bulk", {
    shift_ids: ids,
  });
  if (error) return { error: error.message };

  revalidatePath(`/app/groups/${groupId}/shifts`);
  revalidatePath(`/app/groups/${groupId}`);
  return { error: null };
}

export async function employerUpdateShiftAction(
  groupId: string,
  shiftId: string,
  _prevState: ShiftActionState,
  formData: FormData,
): Promise<ShiftActionState> {
  const clockOutIso = String(formData.get("clock_out_iso") ?? "").trim();
  const notes = String(formData.get("notes") ?? "");
  const statusRaw = String(formData.get("status") ?? "closed");
  const alsoVerify = formData.get("also_verify") === "1";

  if (!STATUSES.includes(statusRaw as ShiftStatus)) {
    return { error: "Estado inválido" };
  }
  const status = statusRaw as ShiftStatus;

  let clockOut: string | null = null;
  if (clockOutIso !== "") {
    const parsed = new Date(clockOutIso);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Hora de salida inválida" };
    }
    clockOut = parsed.toISOString();
  }

  if (status !== "open" && clockOut === null) {
    return {
      error: "Un turno cerrado o en revisión necesita hora de salida",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("employer_update_shift", {
    target_shift_id: shiftId,
    new_clock_out: clockOut,
    new_notes: notes,
    new_status: status,
    also_verify: alsoVerify,
  });

  if (error) return { error: error.message };

  revalidatePath(`/app/groups/${groupId}/shifts`);
  revalidatePath(`/app/groups/${groupId}/shifts/${shiftId}`);
  revalidatePath(`/app/groups/${groupId}`);
  redirect(`/app/groups/${groupId}/shifts`);
}
