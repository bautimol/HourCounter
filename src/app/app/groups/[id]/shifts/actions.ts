"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

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
  if (error) {
    return {
      error: friendlyError(
        error.message,
        "No pudimos aprobar el turno. Probá de nuevo.",
      ),
    };
  }

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
  if (error) {
    return {
      error: friendlyError(
        error.message,
        "No pudimos desaprobar el turno. Probá de nuevo.",
      ),
    };
  }

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
  if (error) {
    return {
      error: friendlyError(
        error.message,
        "No pudimos aprobar los turnos seleccionados. Probá de nuevo.",
      ),
    };
  }

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

  if (error) {
    return {
      error: friendlyError(
        error.message,
        "No pudimos guardar el turno. Probá de nuevo.",
      ),
    };
  }

  revalidatePath(`/app/groups/${groupId}/shifts`);
  revalidatePath(`/app/groups/${groupId}/shifts/${shiftId}`);
  revalidatePath(`/app/groups/${groupId}`);
  redirect(`/app/groups/${groupId}/shifts`);
}

/**
 * Deletes one shift. The RPC refuses anything already covered by a recorded
 * payment, so this can only ever remove work nobody has been paid for.
 *
 * Redirects rather than returning, because after the delete the shift detail
 * page it was called from no longer has a shift to render.
 */
export async function deleteShiftAction(
  groupId: string,
  shiftId: string,
  _prevState: ShiftActionState,
  _formData: FormData,
): Promise<ShiftActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("employer_delete_entry", {
    target_entry_id: shiftId,
  });

  if (error) {
    if (error.message.includes("SHIFT_ALREADY_PAID")) {
      return {
        error:
          "Ese turno entró en una liquidación ya registrada, así que no se puede borrar. Si el pago fue un error, borrá primero la liquidación.",
      };
    }
    return {
      error: friendlyError(
        error.message,
        "No pudimos borrar el turno. Probá de nuevo.",
      ),
    };
  }

  revalidatePath(`/app/groups/${groupId}/shifts`);
  revalidatePath(`/app/groups/${groupId}`);
  redirect(`/app/groups/${groupId}/shifts`);
}

/**
 * Deletes every selected shift that the employer is allowed to remove. The RPC
 * skips paid ones instead of failing the batch, so compare what came back with
 * what was asked for and say so when they differ — silently deleting 3 of 5
 * would read as success.
 */
export async function bulkDeleteShiftsAction(
  groupId: string,
  _prevState: ShiftActionState,
  formData: FormData,
): Promise<ShiftActionState> {
  const ids = formData.getAll("shift_id").map(String).filter(Boolean);
  if (ids.length === 0) return { error: "No seleccionaste ningún turno" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("employer_delete_entries", {
    shift_ids: ids,
  });

  if (error) {
    return {
      error: friendlyError(
        error.message,
        "No pudimos borrar los turnos. Probá de nuevo.",
      ),
    };
  }

  revalidatePath(`/app/groups/${groupId}/shifts`);
  revalidatePath(`/app/groups/${groupId}`);

  const deleted = Number(data ?? 0);
  if (deleted < ids.length) {
    const skipped = ids.length - deleted;
    return {
      error: `Borramos ${deleted} de ${ids.length}. ${
        skipped === 1 ? "El otro ya entró" : `Los otros ${skipped} ya entraron`
      } en una liquidación registrada, así que no se puede${skipped === 1 ? "" : "n"} borrar.`,
    };
  }

  return { error: null };
}
