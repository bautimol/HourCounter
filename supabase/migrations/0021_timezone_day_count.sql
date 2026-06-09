-- 0021_timezone_day_count.sql
-- (renumbered from 0020 after rebasing onto 0019_fix_update_member_full_ambiguous)
--
-- Fixes per_day_worked viáticos counting days in UTC instead of Argentina time.
--
-- calculate_pay_draft counted distinct worked days with `date(clock_in)`, which
-- resolves the timestamptz in the session timezone (UTC on Supabase). A shift
-- starting Fri 22:00 ART is Sat 01:00 UTC, so it was credited to the wrong day:
-- two distinct ART days could collapse to one (or one split into two), making
-- per_day_worked fixed amounts pay the wrong number of days.
--
-- Only change vs the 0013 definition: the one `date(clock_in)` expression now
-- reads `date(clock_in at time zone 'America/Argentina/Buenos_Aires')`. The rest
-- of the function is reproduced verbatim (CREATE OR REPLACE needs the full body).
-- Safe to apply live: it is a pure read function (STABLE), atomic replace.

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

  -- Verify caller is employer of the profile's group.
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

  -- Get the effective rate + currency from the resolved profile view.
  select hourly_rate, currency into eff_rate, eff_currency
    from effective_employee_profile(target_profile_id);

  eff_rate := coalesce(eff_rate, 0);
  eff_currency := coalesce(eff_currency, 'ARS');

  -- Sum verified hours in the period.
  -- Day counting uses Argentina local date (UTC-3), not UTC, so shifts that
  -- cross UTC midnight (i.e. after 21:00 ART) land on the correct calendar day.
  select
    coalesce(sum(extract(epoch from (clock_out - clock_in)) / 60.0), 0),
    coalesce(count(*), 0),
    coalesce(count(distinct date(clock_in at time zone 'America/Argentina/Buenos_Aires')), 0)
  into total_minutes, shift_count, days_with_shifts
  from time_entries
  where employee_profile_id = target_profile_id
    and verified_at is not null
    and clock_out is not null
    and clock_in >= period_start_iso
    and clock_in <  period_end_iso;

  hours_worked := round((total_minutes / 60.0)::numeric, 2);
  hourly_amount := round((hours_worked * eff_rate)::numeric, 2);

  days_in_period := greatest(
    1,
    ceil(extract(epoch from (period_end_iso - period_start_iso)) / 86400.0)::integer
  );

  -- Iterate over the employee's active fixed amounts and compute each.
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
    'fixed_amounts', fa_array,
    'fixed_amounts_total', round(fa_total, 2),
    'subtotal', round(hourly_amount + fa_total, 2)
  );
end;
$$;
