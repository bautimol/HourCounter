-- ============================================================================
-- HourCounter — Effective-dated rate changes
-- ============================================================================
-- Until now the hourly rate was resolved live at compute time
-- (coalesce(employee override, position rate)), so changing it repriced EVERY
-- unpaid shift retroactively — there was no way to say "the new rate applies
-- from date X forward, older shifts keep the old rate".
--
-- We add a per-shift rate SNAPSHOT column. Semantics:
--   time_entries.hourly_rate IS NULL  → value the shift at the live effective
--                                        rate (unchanged behaviour).
--   time_entries.hourly_rate = R      → this shift is FROZEN at R regardless of
--                                        later rate changes.
--
-- change_employee_rate(profile, new_rate, effective_from) implements the
-- "fecha de corte" the owner asked for:
--   * Freeze every UNPAID, not-yet-frozen shift whose Argentina calendar date
--     is BEFORE effective_from at the current (old) effective rate.
--   * Set the employee's override to new_rate.
--   → Shifts on/after effective_from stay NULL and float to the new rate;
--     shifts before it are pinned to the old rate; already-paid shifts and
--     already-frozen shifts are never touched.
--
-- Picking effective_from = today ⇒ forward-only. Picking an early date ⇒
-- retroactive to that date. Picking the employee's first shift ⇒ apply to
-- everything unpaid.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Snapshot column
-- ----------------------------------------------------------------------------

alter table time_entries
  add column hourly_rate numeric(12, 2)
  check (hourly_rate is null or hourly_rate >= 0);

comment on column time_entries.hourly_rate is
  'Frozen per-shift rate. NULL = value at the live effective rate; a value pins this shift to that rate across future rate changes.';

-- ----------------------------------------------------------------------------
-- 2) change_employee_rate
-- ----------------------------------------------------------------------------

create or replace function change_employee_rate(
  target_profile_id uuid,
  new_rate numeric,
  effective_from date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  profile_group uuid;
  old_rate numeric;
  last_paid_end timestamptz;
  frozen_count integer;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  if new_rate is null or new_rate < 0 then
    raise exception 'new_rate must be >= 0';
  end if;

  if effective_from is null then
    raise exception 'effective_from is required';
  end if;

  select gm.group_id into profile_group
    from employee_profiles ep
    join group_members gm on gm.id = ep.group_member_id
   where ep.id = target_profile_id;

  if profile_group is null then
    raise exception 'profile not found';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = profile_group
      and user_id = caller
      and role = 'employer'
      and status = 'active'
  ) then
    raise exception 'only employers can change the rate';
  end if;

  -- Current (old) effective rate, used to pin the past.
  select hourly_rate into old_rate
    from effective_employee_profile(target_profile_id);

  -- Anything at/after the last payment's period_end is unpaid.
  select max(period_end) into last_paid_end
    from payments
   where employee_profile_id = target_profile_id;

  -- Freeze unpaid, not-yet-frozen shifts strictly before the cutoff at the old
  -- rate. If there is no old rate (never configured) there is nothing to pin.
  if old_rate is not null then
    with frozen as (
      update time_entries
         set hourly_rate = old_rate
       where employee_profile_id = target_profile_id
         and hourly_rate is null
         and clock_out is not null
         and clock_in > coalesce(last_paid_end, '-infinity'::timestamptz)
         and (clock_in at time zone 'America/Argentina/Buenos_Aires')::date
             < effective_from
      returning 1
    )
    select count(*) into frozen_count from frozen;
  else
    frozen_count := 0;
  end if;

  -- Set the new rate as the employee's override going forward.
  update employee_profiles
     set hourly_rate = new_rate
   where id = target_profile_id;

  return jsonb_build_object(
    'profile_id', target_profile_id,
    'old_rate', old_rate,
    'new_rate', new_rate,
    'effective_from', effective_from,
    'frozen_shifts', frozen_count
  );
end;
$$;

revoke all on function change_employee_rate(uuid, numeric, date) from public;
grant execute on function change_employee_rate(uuid, numeric, date) to authenticated;

-- ----------------------------------------------------------------------------
-- 3) calculate_pay_draft: value hours per-shift (snapshot or live rate)
-- ----------------------------------------------------------------------------
-- Only the hours/amount aggregation changes vs 0021: instead of
-- hours_worked * eff_rate (one rate for the whole period) we now sum
-- per_shift_hours * coalesce(shift snapshot, eff_rate). A `mixed_rates` flag
-- is added so the UI can label the tarifa line "varias según fecha".

create or replace function calculate_pay_draft(
  target_profile_id uuid,
  period_start_iso timestamptz,
  period_end_iso timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  caller uuid := auth.uid();
  profile_group uuid;
  eff_rate numeric;
  eff_currency text;

  total_minutes numeric;
  hours_worked numeric;
  hourly_amount numeric;
  days_with_shifts integer;
  shift_count integer;
  days_in_period integer;
  mixed_rates boolean;

  fa_array jsonb := '[]'::jsonb;
  fa_total numeric := 0;
  fa record;
  applied_count integer;
  subtotal numeric;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  if period_end_iso <= period_start_iso then
    raise exception 'period_end must be after period_start';
  end if;

  select gm.group_id into profile_group
    from employee_profiles ep
    join group_members gm on gm.id = ep.group_member_id
   where ep.id = target_profile_id;

  if profile_group is null then
    raise exception 'profile not found';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = profile_group
      and user_id = caller
      and role = 'employer'
      and status = 'active'
  ) then
    raise exception 'only employers can calculate payments';
  end if;

  select hourly_rate, currency into eff_rate, eff_currency
    from effective_employee_profile(target_profile_id);

  eff_rate := coalesce(eff_rate, 0);
  eff_currency := coalesce(eff_currency, 'ARS');

  -- Per-shift valuation: each shift uses its frozen rate if set, else the
  -- current effective rate. Day counting stays on the AR calendar.
  select
    coalesce(sum(mins), 0),
    coalesce(count(*), 0),
    coalesce(count(distinct ar_day), 0),
    coalesce(sum((mins / 60.0) * coalesce(snapshot, eff_rate)), 0),
    coalesce(bool_or(snapshot is not null), false)
  into total_minutes, shift_count, days_with_shifts, hourly_amount, mixed_rates
  from (
    select
      extract(epoch from (clock_out - clock_in)) / 60.0 as mins,
      date(clock_in at time zone 'America/Argentina/Buenos_Aires') as ar_day,
      hourly_rate as snapshot
    from time_entries
    where employee_profile_id = target_profile_id
      and verified_at is not null
      and clock_out is not null
      and clock_in >= period_start_iso
      and clock_in <  period_end_iso
  ) shifts;

  hours_worked := round((total_minutes / 60.0)::numeric, 2);
  hourly_amount := round(hourly_amount::numeric, 2);

  days_in_period := greatest(
    1,
    ceil(extract(epoch from (period_end_iso - period_start_iso)) / 86400.0)::integer
  );

  for fa in
    select id, description, amount, frequency, custom_days
      from fixed_amounts
     where employee_profile_id = target_profile_id
       and active = true
     order by created_at asc
  loop
    if fa.frequency = 'per_period' then
      applied_count := 1;
    elsif fa.frequency = 'per_day_worked' then
      applied_count := days_with_shifts;
    elsif fa.frequency = 'every_n_days' then
      applied_count := greatest(0, floor(days_in_period::numeric / fa.custom_days)::integer);
    elsif fa.frequency = 'one_shot' then
      applied_count := 1;
    else
      applied_count := 0;
    end if;

    subtotal := round((fa.amount * applied_count)::numeric, 2);
    fa_total := fa_total + subtotal;

    fa_array := fa_array || jsonb_build_object(
      'id', fa.id,
      'description', fa.description,
      'frequency', fa.frequency,
      'custom_days', fa.custom_days,
      'amount_each', fa.amount,
      'times_applied', applied_count,
      'subtotal', subtotal
    );
  end loop;

  return jsonb_build_object(
    'profile_id', target_profile_id,
    'period_start', period_start_iso,
    'period_end', period_end_iso,
    'days_in_period', days_in_period,
    'hourly_rate', eff_rate,
    'currency', eff_currency,
    'shift_count', shift_count,
    'days_with_shifts', days_with_shifts,
    'hours_worked', hours_worked,
    'hourly_amount', hourly_amount,
    'mixed_rates', mixed_rates,
    'fixed_amounts', fa_array,
    'fixed_amounts_total', round(fa_total, 2),
    'subtotal', round(hourly_amount + fa_total, 2)
  );
end;
$$;
