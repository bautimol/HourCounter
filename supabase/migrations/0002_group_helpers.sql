-- ============================================================================
-- HourCounter — Group helpers
-- ============================================================================
-- Atomic creation of a group + its first employer (the creator).
-- Without this, the client would need two RLS-checked inserts that could
-- partially fail and leave an orphan group.
-- ============================================================================

create or replace function create_group_with_owner(group_name text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_group groups;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  if group_name is null or length(trim(group_name)) = 0 then
    raise exception 'group name is required';
  end if;

  insert into groups (name, created_by)
  values (trim(group_name), caller)
  returning * into new_group;

  insert into group_members (group_id, user_id, role)
  values (new_group.id, caller, 'employer');

  return new_group;
end;
$$;
