-- ============================================================================
-- HourCounter — Invitation flow
-- ============================================================================
-- Functions to create, validate and accept invitations to a group.
-- All functions are SECURITY DEFINER and verify auth/role internally.
-- The invitation `code` is the access token: anyone holding the code can
-- look up the invitation's group/role to decide whether to accept.
-- ============================================================================

-- Tighten the previous "any authenticated can read invitation" policy so it
-- can only be reached through the SECURITY DEFINER functions below.
drop policy if exists "authenticated can read invitation by code" on invitations;

-- ----------------------------------------------------------------------------
-- create_invitation: employer-only; returns the generated code
-- ----------------------------------------------------------------------------

create or replace function create_invitation(
  target_group_id uuid,
  invite_role member_role default 'employee',
  ttl_days integer default 7
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  invite_code text;
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
    raise exception 'only employers can create invitations';
  end if;

  -- 12 hex chars = 48 bits of entropy. Collision is essentially impossible
  -- for this volume. The unique constraint on `code` would surface a clash.
  invite_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));

  insert into invitations (group_id, code, role, created_by, expires_at)
  values (
    target_group_id,
    invite_code,
    invite_role,
    caller,
    case when ttl_days is null then null else now() + (ttl_days || ' days')::interval end
  );

  return invite_code;
end;
$$;

-- ----------------------------------------------------------------------------
-- get_invitation_by_code: returns enough info to render the landing page
-- (including the group name) without exposing the rest of the table
-- ----------------------------------------------------------------------------

create or replace function get_invitation_by_code(invite_code text)
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  role member_role,
  expires_at timestamptz,
  used_at timestamptz,
  is_member boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    i.id,
    i.group_id,
    g.name as group_name,
    i.role,
    i.expires_at,
    i.used_at,
    exists (
      select 1 from group_members gm
      where gm.group_id = i.group_id
        and gm.user_id = auth.uid()
    ) as is_member
  from invitations i
  join groups g on g.id = i.group_id
  where i.code = invite_code;
$$;

-- ----------------------------------------------------------------------------
-- accept_invitation: marks the invitation as used and creates the membership
-- ----------------------------------------------------------------------------

create or replace function accept_invitation(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_name text;
  inv invitations;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from invitations where code = invite_code;
  if not found then
    raise exception 'invitation not found';
  end if;

  if inv.used_at is not null then
    raise exception 'invitation already used';
  end if;

  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception 'invitation expired';
  end if;

  if exists (
    select 1 from group_members
    where group_id = inv.group_id and user_id = caller
  ) then
    raise exception 'already a member of this group';
  end if;

  select coalesce(raw_user_meta_data ->> 'full_name', email)
    into caller_name
    from auth.users
    where id = caller;

  insert into group_members (group_id, user_id, role, display_name)
  values (inv.group_id, caller, inv.role, caller_name);

  update invitations
    set used_by = caller, used_at = now()
    where id = inv.id;

  return inv.group_id;
end;
$$;
