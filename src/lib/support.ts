/**
 * Contact details, in one place.
 *
 * ⚠️ SUPPORT_EMAIL has to be a mailbox someone actually reads. A support link
 * pointing at an address that bounces is worse than no support link: the
 * person who writes believes they asked for help and then waits.
 */
export const SUPPORT_EMAIL = "soporte@clockity.app";

/** Shown on the legal pages. Bump it when the text below them changes. */
export const LEGAL_LAST_UPDATED = "15 de agosto de 2026";

/**
 * A mailto with the subject filled in.
 *
 * The subject is not decoration — it is what lets two people running this in
 * their spare time triage an inbox without opening every message.
 */
export function supportMailto(subject: string, body?: string): string {
  const params = new URLSearchParams({ subject });
  if (body) params.set("body", body);
  // URLSearchParams encodes spaces as "+", which mail clients render literally
  // in the subject line.
  return `mailto:${SUPPORT_EMAIL}?${params.toString().replace(/\+/g, "%20")}`;
}
