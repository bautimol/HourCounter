import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Paths reachable without a session. Everything else redirects to /login.
 *
 * Password recovery is here because someone who cannot log in is by definition
 * without a session, so guarding those two would send them to the very screen
 * they are stuck on. `/reset-password` counts even though it normally does
 * have a session by the time it renders: a dead link arrives without one and
 * has to be able to say so instead of bouncing.
 *
 * The public content pages are here for the plainer reason that a footer link
 * to the privacy policy has to work for someone who has never signed up.
 *
 * Brand assets (icon*, apple-icon, manifest, sw.js) are deliberately NOT on
 * this list: the matcher in src/proxy.ts excludes them outright, so this
 * function never runs for them and a favicon fetch costs no getUser().
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/auth",
  "/invite",
  "/forgot-password",
  "/reset-password",
  "/faq",
  "/nosotros",
  "/soporte",
  "/terminos",
  "/privacidad",
];

/**
 * Refreshes the Supabase auth session on every request.
 * Called from the root proxy.ts (formerly middleware.ts in Next.js 15 and earlier).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: avoid logic between createServerClient and getUser.
  // Anything in between can cause hard-to-debug session refresh issues.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to /login, except on auth pages.
  const pathname = request.nextUrl.pathname;
  const isPublicPath =
    pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve where the user was going so we can return after auth.
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
