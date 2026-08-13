import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - sitemap.xml, robots.txt
     * - the generated metadata routes (see below)
     * - the service worker
     * - image files
     *
     * The metadata routes are the subtle ones. Next generates `icon.tsx` and
     * friends as routes with NO file extension — /icon, /icon0, /apple-icon,
     * /manifest.webmanifest — so the extension exclusion below never covered
     * them. They fell through to updateSession, which sees a request with no
     * session and 307s it to /login: the browser asked for a favicon and got
     * a redirect to an HTML page, so the tab stayed blank. Same for the
     * manifest (no PWA name or install for a logged-out visitor) and for
     * sw.js (no service worker, so no push).
     *
     * This was masked while `favicon.ico` existed as a real file, since it
     * was excluded by name. Deleting it in favour of the generated `icon`
     * route is what surfaced it.
     *
     * Excluded here rather than added to isPublicPath so the proxy does not
     * run at all: a favicon fetch has no business costing a getUser() round
     * trip to Supabase. Nothing in this list carries user data.
     */
    "/((?!_next/static|_next/image|sitemap\\.xml|robots\\.txt|sw\\.js|manifest\\.webmanifest|icon\\d*|apple-icon|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
