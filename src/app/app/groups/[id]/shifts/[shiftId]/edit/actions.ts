"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EditShiftState = {
  error: string | null;
};

/**
 * Self-edit by the employee. Restricted to notes only — clock_out is the
 * employer's responsibility (see migration 0016 + the form rationale).
 * If the system-recorded clock_out is wrong, the employee writes a note
 * and the employer adjusts at verification time.
 */
export async function updateShiftAction(
  groupId: string,
  shiftId: string,
  _prevState: EditShiftState,
  formData: FormData,
): Promise<EditShiftState> {
  const notes = String(formData.get("notes") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_time_entry", {
    entry_id: shiftId,
    new_notes: notes,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/groups/${groupId}`);
  redirect(`/app/groups/${groupId}`);
}
