-- ============================================================================
-- HourCounter — Payment calculation
-- ============================================================================
-- Two RPCs that close the loop on the employer-side workflow:
--
--   * calculate_pay_draft(profile_id, period_start, period_end)
--     Pure read: computes a JSON breakdown of what the employer would pay
--     if they were to lock in the payment now. Verified shifts only.
--     Includes hours, hourly rate, hourly amount, and a per-fixed-amount
--     breakdown according to its frequency.
--
--   * create_payment(profile_id, period_start, period_end, adjustments_jsonb,
--                    notes)
--     Atomic: re-runs the calc server-side (never trusts client totals),
--     inserts a payments row, inserts payment_adjustments, and marks
--     one_shot fixed_amounts as inactive so they don't reapply next time.
--
-- Both are SECURITY DEFINER and validate the caller is an active employer
-- of the group that owns the employee profile.
--
-- Calculation rules per fixed-amount frequency:
--
--   per_period       → applied once for the entire period (× 1)
--   per_day_worked   → applied once per day with at least one verified shift
--   every_n_days     → applied floor(days_in_period / n) times
--                      (simple count from period_start, ignores worked days)
--   one_shot         → applied once if active; create_payment sets
--                      active = false after locking in the payment
--
-- The "verified shift" filter means we never include shifts that the
-- employer hasn't reviewed — payments are only ever made off approved data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- helper: did the caller create this payment? Used by the delete policy.
-- (We rely on the existing payments INSERT policy for create authorization.)
-- ----------------------------------------------------------------------------

create policy "employers delete payments of their group"
  on payments for delete
  using (
    is_group_employer(group_id_for_employee_profile(employee_profile_id))
  );

-- ----------------------------------------------------------------------------
-- calculate_pay_draft
-- ----------------------------------------------------------------------------

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
  select
    coalesce(sum(extract(epoch from (clock_out - clock_in)) / 60.0), 0),
    coalesce(count(*), 0),
    coalesce(count(distinct date(clock_in)), 0)
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

-- ----------------------------------------------------------------------------
-- create_payment
-- ----------------------------------------------------------------------------

create or replace function create_payment(
  target_profile_id uuid,
  period_start_iso timestamptz,
  period_end_iso timestamptz,
  adjustments_jsonb jsonb default '[]'::jsonb,
  notes_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  profile_group uuid;

  draft jsonb;
  hours_worked numeric;
  hourly_amount numeric;
  fa_total numeric;
  adj_total numeric := 0;
  total numeric;

  new_payment_id uuid;
  trimmed_notes text := nullif(trim(coalesce(notes_text, '')), '');
  adj record;
  adj_amount numeric;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  -- The calc itself enforces employer auth, so we don't repeat the check
  -- here — we just call it.
  draft := calculate_pay_draft(target_profile_id, period_start_iso, period_end_iso);

  hours_worked := (draft ->> 'hours_worked')::numeric;
  hourly_amount := (draft ->> 'hourly_amount')::numeric;
  fa_total := (draft ->> 'fixed_amounts_total')::numeric;

  -- Sum adjustments from the input (validated as we iterate).
  if adjustments_jsonb is not null and jsonb_typeof(adjustments_jsonb) = 'array' then
    for adj in select * from jsonb_array_elements(adjustments_jsonb) as item(value)
    loop
      adj_amount := (adj.value ->> 'amount')::numeric;
      if adj_amount is null then
        raise exception 'adjustment amount required';
      end if;
      adj_total := adj_total + adj_amount;
    end loop;
  end if;

  total := round(hourly_amount + fa_total + adj_total, 2);

  -- Group lookup for inserting created_by + (RLS uses the same path).
  select gm.group_id into profile_group
    from employee_profiles ep
    join group_members gm on gm.id = ep.group_member_id
   where ep.id = target_profile_id;

  insert into payments (
    employee_profile_id, period_start, period_end,
    hours_worked, hourly_amount, fixed_amounts_total,
    adjustments_total, total_amount, notes, created_by
  )
  values (
    target_profile_id, period_start_iso, period_end_iso,
    hours_worked, hourly_amount, fa_total,
    round(adj_total, 2), total, trimmed_notes, caller
  )
  returning id into new_payment_id;

  -- Insert adjustments (already validated above).
  if adjustments_jsonb is not null and jsonb_typeof(adjustments_jsonb) = 'array' then
    insert into payment_adjustments (payment_id, description, amount)
    select
      new_payment_id,
      coalesce(item.value ->> 'description', '(sin descripción)'),
      (item.value ->> 'amount')::numeric
      from jsonb_array_elements(adjustments_jsonb) as item(value);
  end if;

  -- Deactivate any one_shot fixed amounts that were applied in this draft.
  update fixed_amounts
     set active = false
   where employee_profile_id = target_profile_id
     and frequency = 'one_shot'
     and active = true;

  return new_payment_id;
end;
$$;
