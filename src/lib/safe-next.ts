/**
 * Restricts a `?next=` destination to same-app paths.
 *
 * Every auth entry point takes a `next` so an invite link survives the detour
 * through login / signup / the OAuth provider. That parameter is attacker-
 * controlled, so without this an emailed `?next=https://evil.com` (or the
 * protocol-relative `//evil.com`, which browsers treat as absolute) would turn
 * a legitimate confirmation link into an open redirect.
 *
 * Anything that is not a plain absolute path falls back to `/app`.
 */
/**
 * Where the post-OAuth destination is parked while the user is off at the
 * provider.
 *
 * It cannot travel in `redirectTo`'s query string: Supabase requires the
 * `redirectTo` URL to match an entry in its Redirect URLs allowlist exactly,
 * and a value that changes per invite does not match. When it fails to match
 * Supabase silently falls back to the Site URL, which lands the user on `/`
 * with a `?code=` it has no idea what to do with. Keeping `redirectTo` a
 * fixed `${origin}/auth/callback` means one exact allowlist entry is enough —
 * no wildcards, which would also widen what the allowlist accepts.
 */
export const OAUTH_NEXT_COOKIE = "hc_oauth_next";

export function safeNext(next: string | null | undefined): string {
  if (!next) return "/app";
  if (!next.startsWith("/")) return "/app";
  if (next.startsWith("//")) return "/app";
  // `/\evil.com` is normalised to `//evil.com` by some browsers.
  if (next.startsWith("/\\")) return "/app";
  return next;
}
