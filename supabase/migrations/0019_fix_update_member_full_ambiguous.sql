-- ============================================================================
-- HourCounter — Fix ambiguous target_member_id in update_member_full
-- ============================================================================
-- The function parameter target_member_id collides with the column
-- member_nicknames.target_member_id inside the INSERT ... VALUES clause:
--   ERROR: column reference "target_member_id" is ambiguous
-- Symptom: "Guardar cambios" in the member editor fails.
--
-- Fix: qualify every reference to the parameter with the function name
-- (update_member_full.target_member_id) so PostgreSQL never has to choose
-- between the parameter and a column of the target table.
-- ============================================================================

create or replace function update_member_full(
  target_member_id uuid,
  new_nickname text,
  new_position_id uuid,
  new_hourly_rate numeric,
  new_payment_period payment_period,
  new_custom_period_days integer,
  new_currency text,
  new_notes text,
  new_fixed_amounts jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  member_group uuid;
  member_role member_role;
  profile_id uuid;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  select group_id, role into member_group, member_role
    from group_members
   where id = update_member_full.target_member_id;

  if member_group is null then
    raise exception 'member not found';
  end if;

  if member_role <> 'employee' then
    raise exception 'only employee members have a profile';
  end if;

  if not exists (
    select 1 from group_members
     where group_id = member_group
       and user_id = caller
       and role = 'employer'
       and status = 'active'
  ) then
    raise exception 'only employers can edit this member';
  end if;

  -- Validate that the position (if any) belongs to this group.
  if new_position_id is not null
     and not exists (
       select 1 from positions
       where id = new_position_id and group_id = member_group
     ) then
    raise exception 'position does not belong to this group';
  end if;

  -- Nickname (caller-scoped).
  if new_nickname is null or length(trim(new_nickname)) = 0 then
    delete from member_nicknames
     where viewer_user_id = caller
       and member_nicknames.target_member_id = update_member_full.target_member_id;
  else
    insert into member_nicknames (viewer_user_id, target_member_id, nickname)
    values (caller, update_member_full.target_member_id, trim(new_nickname))
    on conflict (viewer_user_id, target_member_id)
    do update set nickname = excluded.nickname, updated_at = now();
  end if;

  -- Profile upsert.
  select id into profile_id
    from employee_profiles
   where group_member_id = update_member_full.target_member_id;

  if profile_id is null then
    insert into employee_profiles (
      group_member_id, position_id, hourly_rate, payment_period,
      custom_period_days, currency
    )
    values (
      update_member_full.target_member_id, new_position_id, new_hourly_rate,
      new_payment_period, new_custom_period_days, new_currency
    )
    returning id into profile_id;
  else
    update employee_profiles
       set position_id = new_position_id,
           hourly_rate = new_hourly_rate,
           payment_period = new_payment_period,
           custom_period_days = new_custom_period_days,
           currency = new_currency
     where id = profile_id;
  end if;

  -- Notes (shared among employers).
  if new_notes is null or length(trim(new_notes)) = 0 then
    delete from employee_notes where employee_profile_id = profile_id;
  else
    insert into employee_notes (employee_profile_id, notes)
    values (profile_id, new_notes)
    on conflict (employee_profile_id)
    do update set notes = excluded.notes, updated_at = now();
  end if;

  -- Replace fixed amounts list.
  delete from fixed_amounts where employee_profile_id = profile_id;

  if new_fixed_amounts is not null and jsonb_array_length(new_fixed_amounts) > 0 then
    insert into fixed_amounts (
      employee_profile_id, description, amount, frequency, custom_days
    )
    select
      profile_id,
      (item ->> 'description')::text,
      (item ->> 'amount')::numeric,
      (item ->> 'frequency')::fixed_amount_frequency,
      nullif(item ->> 'custom_days', '')::integer
    from jsonb_array_elements(new_fixed_amounts) as item;
  end if;

  return profile_id;
end;
$$;
