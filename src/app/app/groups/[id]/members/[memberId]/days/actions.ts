"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TIME_ENTRY_CONCEPTS, type TimeEntryConcept } from "@/lib/format";

export type AddDayState = { error: string | null };

/**
 * Employer types in a day the employee could never clock: a holiday, a vacation
 * day, or a shift they forgot to punch. Goes through employer_create_entry()
 * (SECURITY DEFINER) — direct INSERT on time_entries is denied by RLS.
 */
export async function addDayAction(
  groupId: string,
  memberId: string,
  profileId: string,
  _prevState: AddDayState,
  formData: FormData,
): Promise<AddDayState> {
  const entryDate = String(formData.get("entry_date") ?? "").trim();
  const conceptRaw = String(formData.get("concept") ?? "");
  const hoursRaw = String(formData.get("hours") ?? "").trim();
  const minutesRaw = String(formData.get("minutes") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return { error: "Elegí una fecha." };
  }

  if (!TIME_ENTRY_CONCEPTS.includes(conceptRaw as TimeEntryConcept)) {
    return { error: "Elegí un concepto." };
  }

  const hours = hoursRaw === "" ? 0 : Number(hoursRaw);
  const minutes = minutesRaw === "" ? 0 : Number(minutesRaw);

  if (!Number.isInteger(hours) || hours < 0 || hours > 24) {
    return { error: "Las horas tienen que ser un número entre 0 y 24." };
  }
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return { error: "Los minutos tienen que ser un número entre 0 y 59." };
  }

  const totalMinutes = hours * 60 + minutes;
  if (totalMinutes <= 0) {
    return { error: "Poné cuántas horas se le pagan ese día." };
  }
  if (totalMinutes > 1440) {
    return { error: "Un día no puede tener más de 24 horas." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("employer_create_entry", {
    target_profile_id: profileId,
    entry_date: entryDate,
    entry_minutes: totalMinutes,
    entry_concept: conceptRaw,
    entry_description: description === "" ? null : description,
  });

  if (error) {
    // The RPC raises bare codes so the wording lives here, in Spanish.
    if (error.message.includes("DUPLICATE_ENTRY")) {
      return {
        error:
          "Ya habías cargado un día con ese concepto para esa fecha. Revisá la lista de días cargados.",
      };
    }
    if (error.message.includes("INVALID_DATE")) {
      return { error: "Esa fecha está fuera de rango. Revisá el año." };
    }
    if (error.message.includes("INVALID_MINUTES")) {
      return { error: "Las horas no son válidas." };
    }
    if (error.message.includes("only employers")) {
      return { error: "No tenés permiso para cargar días en este grupo." };
    }
    return { error: "No pudimos guardar el día. Probá de nuevo." };
  }

  revalidatePath(`/app/groups/${groupId}/members/${memberId}`);
  revalidatePath(`/app/groups/${groupId}/shifts`);
  revalidatePath(`/app/groups/${groupId}`);
  redirect(`/app/groups/${groupId}/members/${memberId}`);
}

export type DeleteDayState = { error: string | null };

/**
 * Removes a manually-entered day. employer_delete_entry() refuses anything the
 * employee actually clocked, so this can only ever undo a typo of your own.
 */
export async function deleteDayAction(
  groupId: string,
  memberId: string,
  entryId: string,
  _prevState: DeleteDayState,
  _formData: FormData,
): Promise<DeleteDayState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("employer_delete_entry", {
    target_entry_id: entryId,
  });

  if (error) {
    if (error.message.includes("NOT_A_MANUAL_ENTRY")) {
      return {
        error:
          "Ese turno lo fichó el empleado, no se puede borrar. Editalo desde Turnos.",
      };
    }
    return { error: "No pudimos borrar el día. Probá de nuevo." };
  }

  revalidatePath(`/app/groups/${groupId}/members/${memberId}`);
  revalidatePath(`/app/groups/${groupId}/shifts`);
  revalidatePath(`/app/groups/${groupId}`);
  return { error: null };
}
