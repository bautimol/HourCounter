-- ============================================================================
-- HourCounter — Custom-cadence fixed amounts
-- ============================================================================
-- Adds a new frequency option `every_n_days` plus a `custom_days` column to
-- both position_fixed_amounts and fixed_amounts so the employer can model
-- things like "almuerzo cada 3 días" without forcing a per-period cadence.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Extend the enum
-- ----------------------------------------------------------------------------
-- ALTER TYPE ... ADD VALUE works inside a transaction in PG 12+, but the new
-- value cannot be USED (compared/inserted) in the same transaction. CHECK
-- constraints only store the expression, so they are safe to declare below.

alter type fixed_amount_frequency add value if not exists 'every_n_days';

-- ----------------------------------------------------------------------------
-- 2) Add custom_days column to both tables, with a CHECK that keeps it in
--    sync with the frequency value.
-- ----------------------------------------------------------------------------

alter table position_fixed_amounts
  add column custom_days integer
  check (
    (frequency = 'every_n_days' and custom_days is not null and custom_days > 0)
    or (frequency <> 'every_n_days' and custom_days is null)
  );

alter table fixed_amounts
  add column custom_days integer
  check (
    (frequency = 'every_n_days' and custom_days is not null and custom_days > 0)
    or (frequency <> 'every_n_days' and custom_days is null)
  );

-- ----------------------------------------------------------------------------
-- 3) Recreate accept_invitation so the copy from position template includes
--    the new custom_days column.
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
  new_member_id uuid;
  new_profile_id uuid;
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

  update invitations
     set used_by = caller, used_at = now()
   where id = inv.id;

  return inv.group_id;
end;
$$;
