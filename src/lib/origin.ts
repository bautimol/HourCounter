import { headers } from "next/headers";

/**
 * Resolves the public origin of the current request (e.g. "https://app.example.com").
 *
 * Order of preference:
 *   1. NEXT_PUBLIC_SITE_URL env var (explicit override, e.g. custom domain).
 *   2. x-forwarded-host + x-forwarded-proto headers (set by Vercel & most proxies).
 *   3. host header.
 *   4. "http://localhost:3000" as last resort.
 *
 * Must be called from a request context (Server Component, Route Handler, Server Action).
 */
export async function getOrigin(): Promise<string> {
  const override = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (override) return override.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";

  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${proto}://${host}`;
}
