-- ============================================================================
-- HourCounter — Profile pictures
-- ============================================================================
-- Adds avatar_url to group_members (mirrors the display_name pattern: per-row
-- but kept consistent across all the user's memberships via a SECURITY
-- DEFINER RPC). The actual image lives in the `avatars` Storage bucket; this
-- column just stores the public URL.
--
-- Storage bucket setup is NOT done in SQL migrations — see the block at the
-- bottom of this file for the policies you need to paste manually after
-- creating the bucket through Supabase Studio (Storage → New bucket →
-- "avatars", public).
-- ============================================================================

alter table group_members
  add column avatar_url text;

-- ----------------------------------------------------------------------------
-- update_my_avatar — propagate a URL (or NULL to clear) to every membership
-- of the caller. Mirrors update_my_display_name.
-- ----------------------------------------------------------------------------

create or replace function update_my_avatar(new_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  trimmed text;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  trimmed := nullif(trim(coalesce(new_url, '')), '');

  -- Loose URL guard: if non-null, require http(s):// prefix. Avoids garbage
  -- ending up in the column from a hand-crafted call.
  if trimmed is not null
     and trimmed !~* '^https?://'
  then
    raise exception 'avatar_url must be an http(s) URL';
  end if;

  update group_members
     set avatar_url = trimmed
   where user_id = caller;
end;
$$;

-- ============================================================================
-- Manual setup for the `avatars` Storage bucket
-- ============================================================================
-- Run this AFTER creating the bucket in Supabase Studio:
--
--   1. Storage → New bucket → name: avatars, public: yes.
--   2. SQL Editor → run the policies below.
--
-- The bucket is public for read so <img src=...> works without signed URLs.
-- Writes are restricted: each user can only put / delete files under a
-- folder named with their own auth.uid().
-- ----------------------------------------------------------------------------
--
-- create policy "avatars are world-readable"
--   on storage.objects for select
--   using (bucket_id = 'avatars');
--
-- create policy "users upload to their own avatar folder"
--   on storage.objects for insert
--   with check (
--     bucket_id = 'avatars'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- create policy "users update their own avatar files"
--   on storage.objects for update
--   using (
--     bucket_id = 'avatars'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- create policy "users delete their own avatar files"
--   on storage.objects for delete
--   using (
--     bucket_id = 'avatars'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- ============================================================================
