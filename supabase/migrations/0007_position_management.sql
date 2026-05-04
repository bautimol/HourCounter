-- ============================================================================
-- HourCounter — Position management (update + delete)
-- ============================================================================
-- update_position: atomic update of a position's scalar fields PLUS full
-- replacement of its fixed amounts list (delete-then-insert in a single
-- transaction). Editing a fixed amount in the UI is conceptually "the new
-- list of fixed amounts is X", so we replace rather than diff.
--
-- delete_position: blocks deletion when at least one ACTIVE employee profile
-- references the position. Archived employees do NOT block (they no longer
-- inherit; they keep their snapshot via per-employee fixed_amounts).
--
-- Both functions validate the caller is an active employer of the group
-- that owns the position. They are SECURITY DEFINER so they bypass per-table
-- RLS for the multi-table work, but they recheck membership themselves.
-- ============================================================================

create or replace function update_position(
  target_position_id uuid,
  new_name text,
  new_hourly_rate numeric,
  new_payment_period payment_period,
  new_custom_period_days integer,
  new_currency text,
  new_fixed_amounts jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  pos_group uuid;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  select group_id into pos_group
    from positions
   where id = target_position_id;

  if pos_group is null then
    raise exception 'position not found';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = pos_group
      and user_id = caller
      and role = 'employer'
      and status = 'active'
  ) then
    raise exception 'only employers can update positions';
  end if;

  update positions
     set name = new_name,
         hourly_rate = new_hourly_rate,
         payment_period = new_payment_period,
         custom_period_days = new_custom_period_days,
         currency = new_currency
   where id = target_position_id;

  -- Replace fixed amounts list. Caller sends the full new list.
  delete from position_fixed_amounts where position_id = target_position_id;

  if new_fixed_amounts is not null and jsonb_array_length(new_fixed_amounts) > 0 then
    insert into position_fixed_amounts (
      position_id, description, amount, frequency, custom_days
    )
    select
      target_position_id,
      (item ->> 'description')::text,
      (item ->> 'amount')::numeric,
      (item ->> 'frequency')::fixed_amount_frequency,
      nullif(item ->> 'custom_days', '')::integer
    from jsonb_array_elements(new_fixed_amounts) as item;
  end if;

  return target_position_id;
end;
$$;

create or replace function delete_position(target_position_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  pos_group uuid;
  attached_count integer;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  select group_id into pos_group
    from positions
   where id = target_position_id;

  if pos_group is null then
    raise exception 'position not found';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = pos_group
      and user_id = caller
      and role = 'employer'
      and status = 'active'
  ) then
    raise exception 'only employers can delete positions';
  end if;

  select count(*) into attached_count
    from employee_profiles ep
    join group_members gm on gm.id = ep.group_member_id
   where ep.position_id = target_position_id
     and gm.status = 'active';

  if attached_count > 0 then
    raise exception 'POSITION_IN_USE:%', attached_count;
  end if;

  delete from positions where id = target_position_id;
end;
$$;
