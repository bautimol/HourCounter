import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/origin";

/**
 * Landing point for the "recuperar contraseña" email.
 *
 * Kept separate from `/auth/confirm` (signup links) and `/auth/callback`
 * (OAuth) for one practical reason: this is the only entry point that must
 * end on `/reset-password`, and folding it into either of those would mean
 * threading a `next` through the email template — where it cannot go, since
 * Supabase only honours a `redirectTo` matching its allowlist exactly. A
 * dedicated fixed URL is one more allowlist entry and no query string.
 *
 * Accepts both link shapes on purpose. Which one arrives depends on the
 * "Reset Password" email template in the Supabase dashboard: the stock
 * template sends `?code=`, a template rewritten to `{{ .TokenHash }}` sends
 * `?token_hash=&type=recovery`. Handling both means the flow works before
 * anyone touches the dashboard, and keeps working after.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Built off the public origin rather than request.url so redirects land on
  // the real host when running behind Vercel's proxy.
  const origin = await getOrigin();

  const backToRequest = (message: string) =>
    NextResponse.redirect(
      new URL(`/forgot-password?error=${encodeURIComponent(message)}`, origin),
      { status: 303 },
    );

  // A dead link is reported by Supabase redirecting here with its own error
  // params — not by the exchange below failing — so this has to be checked
  // first or we'd fall through to "link inválido" and lose the real reason.
  if (searchParams.get("error") ?? searchParams.get("error_code")) {
    return backToRequest(
      "Ese link ya venció o ya se usó. Pedí uno nuevo, llega en un minuto.",
    );
  }

  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const supabase = await createClient();

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (error) {
      return backToRequest("Ese link ya venció o ya se usó. Pedí uno nuevo.");
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return backToRequest("Ese link ya venció o ya se usó. Pedí uno nuevo.");
    }
  } else {
    return backToRequest("Ese link no es válido. Pedí uno nuevo.");
  }

  // Whichever branch ran left a real session in the cookie. That session is
  // the only thing authorising the password change on the next screen.
  return NextResponse.redirect(new URL("/reset-password", origin), {
    status: 303,
  });
}
