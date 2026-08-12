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
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/app";
  if (!next.startsWith("/")) return "/app";
  if (next.startsWith("//")) return "/app";
  // `/\evil.com` is normalised to `//evil.com` by some browsers.
  if (next.startsWith("/\\")) return "/app";
  return next;
}
