import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/origin";
import { safeNext } from "@/lib/safe-next";

/**
 * OAuth landing point (Google today). The provider sends the user back here
 * with `?code=`, which we trade for a session cookie via PKCE — the verifier
 * lives in a cookie written when the flow started, so this must use the same
 * server client that `signInWithGoogleAction` used.
 *
 * Distinct from `/auth/confirm`, which handles emailed magic/confirmation
 * links (`token_hash` + `verifyOtp`) rather than an OAuth code.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Redirects are built off the public origin rather than request.url so they
  // land on the real host when running behind Vercel's proxy.
  const origin = await getOrigin();
  const backToLogin = (message: string) =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, origin),
    );

  // The user hit "Cancelar" on Google's screen, or the provider refused.
  // `error=access_denied` is the normal cancel path and should not read like
  // a failure.
  const providerError = searchParams.get("error");
  if (providerError) {
    return backToLogin(
      providerError === "access_denied"
        ? "Cancelaste el ingreso con Google."
        : "Google rechazó el ingreso. Probá de nuevo.",
    );
  }

  if (!code) {
    return backToLogin("Faltó el código de Google. Probá de nuevo.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return backToLogin(
      "No pudimos completar el ingreso con Google. Probá de nuevo.",
    );
  }

  return NextResponse.redirect(new URL(next, origin));
}
