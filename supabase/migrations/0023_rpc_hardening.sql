-- 0023_rpc_hardening.sql
--
-- Second security pass (2026-06-09), RPC/function layer. The table RLS holes
-- were closed in 0020; with all direct writes gone, the SECURITY DEFINER
-- functions are the main authenticated attack surface. Fixes:
--
--  1. accept_invitation: race made a single-use invite code redeemable by many
--     users at once (no row lock). Lock the row + guard the update.
--  2. record_shift_edit: SECURITY DEFINER helper with NO validation, and no
--     REVOKE anywhere, so any authenticated user could call it via PostgREST
--     and forge audit-log rows for any shift. Revoke direct execute (internal
--     PERFORM calls run as owner and are unaffected).
--  3. effective_employee_profile: returned hourly_rate/currency for ANY profile
--     id bypassing RLS — cross-group rate leak if you know a UUID. Gate by
--     group membership. (Within-group rate visibility stays as-is: separate
--     deferred item needing a safe-columns RPC.)
--  4/5. update_my_display_name / update_my_avatar: wrote to ALL of the caller's
--     memberships, including ones where they were archived. Scope to active.
--  6. groups INSERT policy: same dead/abusable pattern dropped from
--     group_members in 0020 — group creation goes through the
--     create_group_with_owner RPC, so the direct-insert policy only enabled
--     orphan-group spam.
--
-- Safe to apply live: functions are recreated atomically; the REVOKE doesn't
-- touch internal calls; the policy drop leaves group creation working via RPC.

begin;

-- ---- 1) accept_invitation: close the multi-redeem race ----------------------
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
  new_member_id uuid;
  new_profile_id uuid;
  marked integer;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  -- FOR UPDATE serializes concurrent redemptions of the same code: the second
  -- caller blocks until the first commits, then sees used_at already set.
  select * into inv from invitations where code = invite_code for update;
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
  values (inv.group_id, caller, inv.role, caller_name)
  returning id into new_member_id;

  if inv.role = 'employee' and inv.position_id is not null then
    insert into employee_profiles (group_member_id, position_id)
    values (new_member_id, inv.position_id)
    returning id into new_profile_id;

    insert into fixed_amounts (
      employee_profile_id, description, amount, frequency, custom_days
    )
    select new_profile_id, description, amount, frequency, custom_days
      from position_fixed_amounts
     where position_id = inv.position_id;
  end if;

  -- Belt-and-suspenders: only mark used if still unused.
  update invitations
     set used_by = caller, used_at = now()
   where id = inv.id and used_at is null;
  get diagnostics marked = row_count;
  if marked = 0 then
    raise exception 'invitation already used';
  end if;

  return inv.group_id;
end;
$$;

-- ---- 2) record_shift_edit: not directly callable ----------------------------
-- Only ever invoked via PERFORM inside other SECURITY DEFINER functions, which
-- run as the function owner and keep working after this revoke.
revoke execute on function record_shift_edit(uuid, text, text, text)
  from authenticated, anon;

-- ---- 3) effective_employee_profile: gate by group membership ----------------
create or replace function effective_employee_profile(profile_id uuid)
returns table (
  id uuid,
  group_member_id uuid,
  position_id uuid,
  hourly_rate numeric,
  payment_period payment_period,
  custom_period_days integer,
  currency text,
  hourly_rate_overridden boolean,
  payment_period_overridden boolean,
  currency_overridden boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    ep.id,
    ep.group_member_id,
    ep.position_id,
    coalesce(ep.hourly_rate, p.hourly_rate)               as hourly_rate,
    coalesce(ep.payment_period, p.payment_period)         as payment_period,
    coalesce(ep.custom_period_days, p.custom_period_days) as custom_period_days,
    coalesce(ep.currency, p.currency)                     as currency,
    ep.hourly_rate is not null                            as hourly_rate_overridden,
    ep.payment_period is not null                         as payment_period_overridden,
    ep.currency is not null                               as currency_overridden
  from employee_profiles ep
  left join positions p on p.id = ep.position_id
  where ep.id = profile_id
    -- caller must belong to the profile's group (closes cross-group rate leak)
    and is_group_member(group_id_for_employee_profile(profile_id));
$$;

-- ---- 4/5) self-update functions: only active memberships --------------------
create or replace function update_my_display_name(new_name text)
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

  trimmed := trim(coalesce(new_name, ''));
  if length(trimmed) = 0 then
    raise exception 'display name cannot be empty';
  end if;

  update group_members
     set display_name = trimmed
   where user_id = caller
     and status = 'active';
end;
$$;

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

  if trimmed is not null
     and trimmed !~* '^https?://'
  then
    raise exception 'avatar_url must be an http(s) URL';
  end if;

  update group_members
     set avatar_url = trimmed
   where user_id = caller
     and status = 'active';
end;
$$;

-- ---- 6) drop the abusable direct group-insert policy ------------------------
-- Group creation goes through create_group_with_owner() (SECURITY DEFINER), so
-- this policy only let anyone POST orphan groups straight to PostgREST.
drop policy if exists "any authenticated user can create a group" on groups;

commit;

-- NOT in this migration (accepted low / deferred):
--   - get_invitation_by_code still returns group_name for used/expired codes:
--     filtering it would break the landing page's "invite used/expired" UX, and
--     the code is the access token anyway. Accepted low.
--   - within-group rate/GPS visibility to co-members: needs a safe-columns RPC.
--   - employer can DELETE positions directly, bypassing the POSITION_IN_USE
--     guard in delete_position (intra-group footgun, low impact).
