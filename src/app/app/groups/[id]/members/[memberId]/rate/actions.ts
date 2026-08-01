"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

export type ChangeRateState = {
  error: string | null;
  /**
   * Set only after a successful change, so the employer sees what the RPC
   * actually did (a rate change silently freezes past shifts — that number is
   * the whole point and used to be invisible). This is why the action no
   * longer redirects to the member page: `redirect()` throws, the action never
   * returns, and any confirmation carried in the state is discarded before the
   * form can render it.
   */
  changed?: {
    oldRate: number | null;
    newRate: number;
    /** "YYYY-MM-DD", as stored. */
    effectiveFrom: string;
    frozenShifts: number;
  } | null;
};

/** jsonb returned by change_employee_rate (numerics may arrive as strings). */
type ChangeRateResult = {
  old_rate: number | string | null;
  new_rate: number | string | null;
  effective_from: string | null;
  frozen_shifts: number | string | null;
};

export async function changeRateAction(
  groupId: string,
  memberId: string,
  profileId: string,
  _prev: ChangeRateState,
  formData: FormData,
): Promise<ChangeRateState> {
  const rateRaw = String(formData.get("hourly_rate") ?? "").trim();
  const effFrom = String(formData.get("effective_from") ?? "").trim();

  const rate = Number(rateRaw);
  if (!Number.isFinite(rate) || rate < 0) {
    return { error: "Tarifa por hora inválida" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effFrom)) {
    return { error: "Fecha de vigencia inválida" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("change_employee_rate", {
    target_profile_id: profileId,
    new_rate: rate,
    effective_from: effFrom,
  });

  if (error) {
    return {
      error: friendlyError(
        error.message,
        "No pudimos guardar la tarifa nueva. Probá de nuevo.",
      ),
    };
  }

  const result = data as unknown as ChangeRateResult | null;

  revalidatePath(`/app/groups/${groupId}/members/${memberId}`);
  revalidatePath(`/app/groups/${groupId}/members/${memberId}/rate`);
  revalidatePath(`/app/groups/${groupId}/reports`);

  return {
    error: null,
    changed: {
      oldRate: result?.old_rate != null ? Number(result.old_rate) : null,
      newRate: result?.new_rate != null ? Number(result.new_rate) : rate,
      effectiveFrom: result?.effective_from ?? effFrom,
      frozenShifts: Number(result?.frozen_shifts ?? 0),
    },
  };
}
