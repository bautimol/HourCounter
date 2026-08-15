"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/origin";
import { friendlyError } from "@/lib/errors";

export type ForgotState = {
  error: string | null;
  sent: boolean;
};

/**
 * Sends the recovery email.
 *
 * Supabase answers 200 for an address that has no account — deliberately, so
 * this form cannot be used to test who is registered here. We keep that
 * property in the copy too: the confirmation says "si hay una cuenta con ese
 * email", never "te lo mandamos". Any error that does come back is a real one
 * (rate limit, malformed address, network), so it is safe to show.
 */
export async function forgotPasswordAction(
  _prevState: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Escribí tu email.", sent: false };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Fixed URL with no query string, so a single exact entry in Supabase's
    // Redirect URLs allowlist covers every reset.
    redirectTo: `${origin}/auth/reset`,
  });

  if (error) {
    return {
      error: friendlyError(
        error.message,
        "No pudimos enviar el mail. Probá de nuevo en un momento.",
      ),
      sent: false,
    };
  }

  return { error: null, sent: true };
}
