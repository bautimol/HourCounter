-- ============================================================================
-- HourCounter — Group avatars
-- ============================================================================
-- Same shape as user avatars (0010): a public URL stored alongside the row,
-- the actual image lives in the `avatars` Storage bucket. We reuse the
-- existing bucket but under a different path scheme so the policies can be
-- gated by group membership instead of auth.uid:
--
--   <userId>/avatar           ← user avatars (existing 0010 policies)
--   groups/<groupId>/avatar   ← group avatars (new policies, employer-gated)
--
-- Storage RLS additions are documented at the bottom of this file — they
-- have to be applied manually in Supabase Studio because storage.objects
-- lives in a schema migrations don't normally write to.
-- ============================================================================

alter table groups
  add column avatar_url text;

-- ----------------------------------------------------------------------------
-- update_group_avatar — only active employers of the group can change it
-- ----------------------------------------------------------------------------

create or replace function update_group_avatar(
  target_group_id uuid,
  new_url text
)
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

  if not exists (
    select 1 from group_members
    where group_id = target_group_id
      and user_id = caller
      and role = 'employer'
      and status = 'active'
  ) then
    raise exception 'only employers can change the group avatar';
  end if;

  trimmed := nullif(trim(coalesce(new_url, '')), '');

  if trimmed is not null
     and trimmed !~* '^https?://'
  then
    raise exception 'avatar_url must be an http(s) URL';
  end if;

  update groups
     set avatar_url = trimmed
   where id = target_group_id;
end;
$$;

-- ============================================================================
-- Manual setup for the `avatars` Storage bucket — group folder policies
-- ============================================================================
-- Add these policies on top of the user policies from 0010. They allow any
-- active employer of a group to write/delete files under
-- `groups/<group-id>/...`. Reads are already covered by the world-readable
-- policy from 0010.
--
-- Run them in the SQL Editor after the bucket exists:
--
-- create policy "employers upload to group avatar folder"
--   on storage.objects for insert
--   with check (
--     bucket_id = 'avatars'
--     and (storage.foldername(name))[1] = 'groups'
--     and exists (
--       select 1 from group_members
--       where group_id = ((storage.foldername(name))[2])::uuid
--         and user_id = auth.uid()
--         and role = 'employer'
--         and status = 'active'
--     )
--   );
--
-- create policy "employers update group avatar files"
--   on storage.objects for update
--   using (
--     bucket_id = 'avatars'
--     and (storage.foldername(name))[1] = 'groups'
--     and exists (
--       select 1 from group_members
--       where group_id = ((storage.foldername(name))[2])::uuid
--         and user_id = auth.uid()
--         and role = 'employer'
--         and status = 'active'
--     )
--   );
--
-- create policy "employers delete group avatar files"
--   on storage.objects for delete
--   using (
--     bucket_id = 'avatars'
--     and (storage.foldername(name))[1] = 'groups'
--     and exists (
--       select 1 from group_members
--       where group_id = ((storage.foldername(name))[2])::uuid
--         and user_id = auth.uid()
--         and role = 'employer'
--         and status = 'active'
--     )
--   );
--
-- ============================================================================
