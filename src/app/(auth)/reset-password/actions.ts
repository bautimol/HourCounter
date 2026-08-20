"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";

export type ResetState = {
  error: string | null;
};

/**
 * Writes the new password.
 *
 * There is no "current password" field and no token in the form: the only
 * thing authorising this is the session that `/auth/reset` put in the cookie
 * when it consumed the emailed link. So a link that expired, was already
 * used, or was never valid fails here — `updateUser` has no one to act as —
 * rather than changing some other account's password.
 *
 * Same 8-character floor as signup. Enforced here and not only via the
 * input's minLength, which a client can skip.
 */
export async function resetPasswordAction(
  _prevState: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirm") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }

  if (password !== confirmation) {
    return { error: "Las dos contraseñas no coinciden" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      error: friendlyError(
        error.message,
        "No pudimos cambiar la contraseña. Pedí un link nuevo y probá otra vez.",
      ),
    };
  }

  // The recovery session is a real session, so they are already signed in —
  // sending them to /login to type the password they just chose would be
  // asking for it twice.
  revalidatePath("/", "layout");
  redirect("/app");
}
