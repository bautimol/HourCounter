"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/origin";
import { OAUTH_NEXT_COOKIE } from "@/lib/safe-next";
import { safeNext } from "@/lib/safe-next";

/**
 * Starts the Google sign-in flow. Shared by the login and signup screens —
 * with OAuth there is no difference between the two: Supabase creates the user
 * on first sign-in and reuses it afterwards.
 *
 * `@supabase/ssr` runs the PKCE flow, so calling this from the server stores
 * the code verifier in a cookie and hands us back the URL to send the user to.
 * `/auth/callback` then trades the returned code for a session using that same
 * cookie — which is why both halves must use the server client.
 */
export async function signInWithGoogleAction(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? "") || null);

  const supabase = await createClient();
  const origin = await getOrigin();

  // Park the destination in a cookie instead of redirectTo's query string —
  // see OAUTH_NEXT_COOKIE for why. SameSite=Lax is required, not incidental:
  // the trip back from Google is a cross-site top-level navigation, which
  // Strict would drop, losing the invite the user was in the middle of.
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_NEXT_COOKIE, next, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: 60 * 10,
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Fixed URL, so a single exact allowlist entry covers every sign-in.
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data?.url) {
    redirect(
      `/login?error=${encodeURIComponent(
        "No pudimos conectar con Google. Probá de nuevo.",
      )}`,
    );
  }

  // Absolute URL to Google's consent screen — redirect() handles those.
  redirect(data.url);
}
