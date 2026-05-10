-- ============================================================================
-- HourCounter — Web Push subscriptions
-- ============================================================================
-- Stores the browser's PushSubscription per device per user. The same user
-- can have many subscriptions (one per browser/device). When we send a push,
-- we fan out to every subscription for the target user.
--
-- We delete subscriptions on 404/410 from the push service (subscription
-- expired or revoked); the helper in src/lib/push.ts does that cleanup.
-- ============================================================================

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  keys_p256dh text not null,
  keys_auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Users can only see / write / delete their own push subscriptions.
create policy "users manage their own push subscriptions"
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
