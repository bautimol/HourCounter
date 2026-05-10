/**
 * Server-side Web Push helper.
 *
 * Wraps `web-push` with our project conventions:
 *   - Reads VAPID config from env (lazily; throws clearly if missing).
 *   - Fans out to all subscriptions for a given user.
 *   - Cleans up subscriptions that the push service rejects as gone.
 *
 * Triggered from server actions (e.g. clockOutAction → notify employers).
 * NEVER call from a client component — relies on Node's crypto.
 */

import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

export type PushPayload = {
  title: string;
  body: string;
  /** Path within the app (e.g. /app/groups/X). Used by the SW notif click handler. */
  url?: string;
  /** Used as `tag` to dedupe; defaults to title. */
  tag?: string;
};

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      "VAPID env vars missing. Run `npx web-push generate-vapid-keys` and " +
        "set VAPID_SUBJECT (mailto:...), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.",
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export function pushIsConfigured(): boolean {
  return Boolean(
    process.env.VAPID_SUBJECT &&
      process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY,
  );
}

/**
 * Fan out a push to every subscription the user has.
 *
 * Errors per-subscription are swallowed (we just delete dead subscriptions
 * and log the rest). The caller should never block on this — wrap with
 * `void` or `.catch(() => {})` if calling from a hot path.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!pushIsConfigured()) return;
  ensureVapid();

  const supabase = await createClient();

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, keys_p256dh, keys_auth")
    .eq("user_id", userId);

  if (error || !subs || subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag ?? payload.title,
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: {
              p256dh: s.keys_p256dh,
              auth: s.keys_auth,
            },
          },
          body,
          { TTL: 60 * 60 * 24 }, // 24h
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Subscription is dead. Delete it.
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        } else {
          // Log but don't throw — push failures shouldn't break the action
          // that triggered them.
          // eslint-disable-next-line no-console
          console.error("Push send failed:", err);
        }
      }
    }),
  );
}

/**
 * Send the same push to every user in the given list. Convenience wrapper.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  await Promise.all(userIds.map((id) => sendPushToUser(id, payload)));
}
