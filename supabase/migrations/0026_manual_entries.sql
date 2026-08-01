-- 0026_manual_entries.sql
-- (renumbered from 0025: 0025_retroactive_rates landed on the other track.
--  MUST run after it — the calculate_pay_draft below merges both features,
--  per-shift frozen rates AND concept-aware day counting.)
--
-- Employer-created days ("días manuales"). Real need from a month of live use:
-- holidays and vacation days get PAID even though the employee never shows up,
-- so she can never clock them in. Until now there was no way to enter them —
-- the only path into time_entries was the employee's own clock_in.
--
-- Adds:
--   1. `concept` on time_entries: what a day IS (worked / holiday / employee's
--      vacation / employer's vacation / other). Existing rows are 'worked'.
--   2. `created_by`: NULL when the employee clocked it, set to the employer who
--      typed it in. This is what makes a row "manual" and therefore deletable.
--   3. employer_create_entry(): the only way to insert a manual day. Direct
--      INSERT on time_entries stays denied by RLS (0020) — same model as every
--      other employer write.
--   4. employer_delete_entry(): undo for a mistyped day. Restricted to manual
--      rows, so a real clocked shift can never be destroyed this way (there is
--      no DELETE policy on time_entries and this does not add one).
--   5. calculate_pay_draft() recreated, MERGING two features that were built
--      in parallel and both rewrote this function:
--        * from 0025: each shift is valued at its frozen rate when it has one
--          (coalesce(time_entries.hourly_rate, live rate)) + the mixed_rates
--          flag. Without this, effective-dated rate changes silently do
--          nothing at payment time.
--        * new here: manual days PAY THEIR HOURS like any other verified
--          entry, but only genuinely worked days count toward per_day_worked
--          fixed amounts (a viático is travel/meal money — she did not travel
--          on a holiday). Plus a per-concept breakdown, priced with the same
--          per-shift rates.
--
-- Manual days are inserted already verified: the employer typed them, there is
-- nothing to approve. Times are synthesized from the date at 09:00 ART so the
-- AR-local day math in the draft lands on the intended calendar day.
--
-- Safe to apply live: additive column with a default, new functions, and one
-- recreated function whose only behavioural change is the per_day_worked
-- restriction described above.

begin;

-- ---- 1) concept + created_by ------------------------------------------------
create type time_entry_concept as enum (
  'worked',
  'holiday',
  'vacation_employee',
  'vacation_employer',
  'other'
);

alter table time_entries
  add column concept time_entry_concept not null default 'worked',
  add column created_by uuid references auth.users (id) on delete set null;

comment on column time_entries.concept is
  'What this day is. Everything the employee clocks is ''worked''; the rest can only be created by an employer via employer_create_entry().';
comment on column time_entries.created_by is
  'NULL = clocked by the employee. Set = manually entered by this employer (and therefore deletable via employer_delete_entry()).';

-- Manual days are the rare ones; a partial index keeps the report/list filters
-- cheap without paying for the 'worked' majority.
create index time_entries_manual_idx
  on time_entries (employee_profile_id, clock_in)
  where created_by is not null;

-- ---- 2) audit log accepts the new fields ------------------------------------
alter table shift_edits drop constraint shift_edits_field_check;
alter table shift_edits add constraint shift_edits_field_check
  check (field in ('clock_out', 'notes', 'status', 'verified', 'created', 'deleted'));

-- ---- 3) employer_create_entry ----------------------------------------------
create or replace function employer_create_entry(
  target_profile_id uuid,
  entry_date date,
  entry_minutes integer,
  entry_concept time_entry_concept,
  entry_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  profile_group uuid;
  entry_start timestamptz;
  trimmed_description text := nullif(trim(coalesce(entry_description, '')), '');
  new_entry_id uuid;
  today_ar date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  profile_group := group_id_for_employee_profile(target_profile_id);
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
    raise exception 'only employers can add days';
  end if;

  if entry_minutes is null or entry_minutes <= 0 or entry_minutes > 1440 then
    raise exception 'INVALID_MINUTES';
  end if;

  -- Sanity window: a typo like year 0202 or 2202 should not silently land in
  -- the books. Generous enough to backfill a past month or preload a holiday.
  if entry_date < today_ar - interval '2 years'
     or entry_date > today_ar + interval '1 year' then
    raise exception 'INVALID_DATE';
  end if;

  -- Same profile + same day + same concept twice is virtually always a
  -- double-entry mistake, and it would silently double the pay for that day.
  if exists (
    select 1 from time_entries
    where employee_profile_id = target_profile_id
      and created_by is not null
      and concept = entry_concept
      and date(clock_in at time zone 'America/Argentina/Buenos_Aires') = entry_date
  ) then
    raise exception 'DUPLICATE_ENTRY';
  end if;

  -- 09:00 ART keeps date(clock_in at time zone AR) on the intended day.
  entry_start := (entry_date + time '09:00') at time zone 'America/Argentina/Buenos_Aires';

  insert into time_entries (
    employee_profile_id, clock_in, clock_out, status, notes,
    concept, created_by, verified_by, verified_at
  )
  values (
    target_profile_id,
    entry_start,
    entry_start + make_interval(mins => entry_minutes),
    'closed',
    trimmed_description,
    entry_concept,
    caller,
    caller,
    now()
  )
  returning id into new_entry_id;

  perform record_shift_edit(
    new_entry_id, 'created', null, entry_concept::text
  );

  return new_entry_id;
end;
$$;

-- ---- 4) employer_delete_entry ----------------------------------------------
create or replace function employer_delete_entry(target_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  entry_group uuid;
  entry_created_by uuid;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  entry_group := group_id_for_shift(target_entry_id);
  if entry_group is null then
    raise exception 'entry not found';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = entry_group
      and user_id = caller
      and role = 'employer'
      and status = 'active'
  ) then
    raise exception 'only employers can delete days';
  end if;

  select created_by into entry_created_by
    from time_entries where id = target_entry_id;

  -- Only manually-entered days can be removed. A shift the employee actually
  -- clocked is corrected through employer_update_shift, never deleted.
  if entry_created_by is null then
    raise exception 'NOT_A_MANUAL_ENTRY';
  end if;

  delete from time_entries where id = target_entry_id;
end;
$$;

-- ---- 5) calculate_pay_draft: manual days pay hours, not viáticos ------------
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
  concept_array jsonb := '[]'::jsonb;

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

  -- Each shift is valued at its own rate: the frozen snapshot when the
  -- employer effective-dated a rate change, else the live rate. Hours: every
  -- verified entry counts, whatever its concept — a paid holiday is paid.
  -- Days: only actually-worked days, because per_day_worked fixed amounts are
  -- travel/meal money for showing up.
  select
    coalesce(sum(mins), 0),
    coalesce(count(*), 0),
    coalesce(count(distinct ar_day) filter (where concept = 'worked'), 0),
    coalesce(sum((mins / 60.0) * coalesce(snapshot, eff_rate)), 0),
    coalesce(bool_or(snapshot is not null), false)
  into total_minutes, shift_count, days_with_shifts, hourly_amount, mixed_rates
  from (
    select
      extract(epoch from (clock_out - clock_in)) / 60.0 as mins,
      date(clock_in at time zone 'America/Argentina/Buenos_Aires') as ar_day,
      hourly_rate as snapshot,
      concept
    from time_entries
    where employee_profile_id = target_profile_id
      and verified_at is not null
      and clock_out is not null
      and clock_in >= period_start_iso
      and clock_in <  period_end_iso
  ) shifts;

  -- Per-concept breakdown, priced with the same per-shift rates.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'concept', c.concept,
        'entries', c.entries,
        'hours', c.hours,
        'amount', c.amount
      )
      order by c.concept
    ),
    '[]'::jsonb
  )
  into concept_array
  from (
    select
      concept::text as concept,
      count(*) as entries,
      round((sum(mins) / 60.0)::numeric, 2) as hours,
      round(sum((mins / 60.0) * coalesce(snapshot, eff_rate))::numeric, 2) as amount
    from (
      select
        extract(epoch from (clock_out - clock_in)) / 60.0 as mins,
        hourly_rate as snapshot,
        concept
      from time_entries
      where employee_profile_id = target_profile_id
        and verified_at is not null
        and clock_out is not null
        and clock_in >= period_start_iso
        and clock_in <  period_end_iso
    ) s
    group by concept
  ) c;

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
    'by_concept', concept_array,
    'fixed_amounts', fa_array,
    'fixed_amounts_total', round(fa_total, 2),
    'subtotal', round(hourly_amount + fa_total, 2)
  );
end;
$$;

commit;

-- NOT in this migration (deliberate):
--   - editing a manual day: delete + re-create instead. employer_update_shift
--     still works on them for clock_out/notes/status if ever needed.
--   - holiday rate multipliers: the ask was "se le paga igual", so a holiday
--     hour is worth exactly one normal hour.
--   - historical hourly rate per entry: the draft still uses today's rate for
--     every hour in the period (open item, matters when the rate changes
--     mid-period).
