-- ============================================================================
-- HourCounter — Default display_name from user metadata
-- ============================================================================
-- When a user joins a group (creating it or accepting an invitation), we
-- default group_members.display_name to their auth.users.raw_user_meta_data
-- ->> 'full_name'. The user can later edit this per-group name.
-- ============================================================================

-- Update create_group_with_owner to populate display_name from auth metadata.
create or replace function create_group_with_owner(group_name text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_name text;
  new_group groups;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  if group_name is null or length(trim(group_name)) = 0 then
    raise exception 'group name is required';
  end if;

  select coalesce(raw_user_meta_data ->> 'full_name', email)
    into caller_name
    from auth.users
    where id = caller;

  insert into groups (name, created_by)
  values (trim(group_name), caller)
  returning * into new_group;

  insert into group_members (group_id, user_id, role, display_name)
  values (new_group.id, caller, 'employer', caller_name);

  return new_group;
end;
$$;

-- Backfill: copy full_name (or email) into display_name for existing members
-- where it was left null.
update group_members gm
   set display_name = coalesce(
         u.raw_user_meta_data ->> 'full_name',
         u.email
       )
  from auth.users u
 where gm.user_id = u.id
   and gm.display_name is null;
