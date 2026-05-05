-- ============================================================================
-- HourCounter — Time tracking (clock in / out)
-- ============================================================================
-- Lets employees register shifts. Key design points:
--
--   1. **Empty profiles allowed**. We drop the constraint that required
--      either `position_id` or scalar fields, so a member who was invited
--      without a role can clock in immediately. Their first clock_in
--      auto-creates an empty `employee_profiles` row. When the employer
--      later configures the profile, those time_entries inherit the rate
--      retroactively (rate is resolved at read time, not snapshotted).
--
--   2. **One open shift at a time** per employee, enforced by a partial
--      unique index. If the user tries to clock in while already open,
--      the insert fails.
--
--   3. **Optional auto-close**. The employee can declare an expected
--      shift length at clock-in (`expected_minutes`). On every read that
--      cares about shift state, we call `auto_close_expired_shifts()`,
--      which closes any open shift past `clock_in + expected_minutes`.
--      Lazy close: simpler than pg_cron and perfectly adequate for this
--      app's traffic.
--
--   4. **Self-edit before verification**. Employees can adjust the
--      `clock_out` and notes of one of their entries via
--      `update_my_time_entry`, but only while the entry has not been
--      verified by an employer.
--
-- All RPCs are SECURITY DEFINER and validate the caller internally, so
-- they bypass per-table RLS for the multi-row work.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Schema changes
-- ----------------------------------------------------------------------------

alter table employee_profiles
  drop constraint if exists employee_profiles_position_or_complete;

alter table time_entries
  add column expected_minutes integer
    check (expected_minutes is null or expected_minutes > 0);

create unique index one_open_shift_per_profile
  on time_entries (employee_profile_id)
  where status = 'open';

-- ----------------------------------------------------------------------------
-- 2) auto_close_expired_shifts
-- ----------------------------------------------------------------------------
-- Closes any open shift that has reached its declared expected_minutes.
-- Idempotent. Runs as part of clock_in / clock_out and can be called
-- defensively before any read that cares about open-shift state.

create or replace function auto_close_expired_shifts()
returns void
language sql
security definer
set search_path = public
as $$
  update time_entries
     set clock_out = clock_in + (expected_minutes || ' minutes')::interval,
         status = 'closed'
   where status = 'open'
     and expected_minutes is not null
     and clock_in + (expected_minutes || ' minutes')::interval <= now();
$$;

-- ----------------------------------------------------------------------------
-- 3) clock_in
-- ----------------------------------------------------------------------------
-- Auto-creates an empty employee_profile if needed. Inserts an open
-- time_entry with optional expected_minutes. Will fail if the user
-- already has an open shift in any group (partial unique index).

create or replace function clock_in(
  target_group_id uuid,
  target_expected_minutes integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  member_id uuid;
  member_role member_role;
  profile_id uuid;
  entry_id uuid;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  -- Sweep stale shifts so we don't trip the unique-open-shift index on
  -- a shift that should already have auto-closed.
  perform auto_close_expired_shifts();

  select id, role into member_id, member_role
    from group_members
   where group_id = target_group_id
     and user_id = caller
     and status = 'active';

  if member_id is null then
    raise exception 'not a member of this group';
  end if;

  if member_role <> 'employee' then
    raise exception 'only employees can clock in';
  end if;

  select id into profile_id
    from employee_profiles
   where group_member_id = member_id;

  if profile_id is null then
    insert into employee_profiles (group_member_id)
    values (member_id)
    returning id into profile_id;
  end if;

  insert into time_entries (
    employee_profile_id, clock_in, expected_minutes, status
  )
  values (profile_id, now(), target_expected_minutes, 'open')
  returning id into entry_id;

  return entry_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) clock_out
-- ----------------------------------------------------------------------------
-- Closes the caller's open shift in the given group. Sets `notes` if
-- provided. Returns the entry id.

create or replace function clock_out(
  target_group_id uuid,
  notes_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  entry_id uuid;
  trimmed text := nullif(trim(coalesce(notes_text, '')), '');
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  -- If the shift already auto-closed (rare edge case where the user opens
  -- the page after expected_minutes but before any other request runs the
  -- sweep), let auto_close_expired_shifts() update it gracefully and then
  -- raise "no open shift" below.
  perform auto_close_expired_shifts();

  select te.id into entry_id
    from time_entries te
    join employee_profiles ep on ep.id = te.employee_profile_id
    join group_members gm on gm.id = ep.group_member_id
   where gm.user_id = caller
     and gm.group_id = target_group_id
     and te.status = 'open'
   limit 1;

  if entry_id is null then
    raise exception 'no open shift in this group';
  end if;

  update time_entries
     set clock_out = now(),
         status = 'closed',
         notes = trimmed
   where id = entry_id;

  return entry_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) update_my_time_entry
-- ----------------------------------------------------------------------------
-- Self-edit before verification. The employee can move clock_out and
-- adjust notes while the employer has not verified the entry. After
-- verification, only the employer can edit (already covered by the
-- existing UPDATE policy).

create or replace function update_my_time_entry(
  entry_id uuid,
  new_clock_out timestamptz,
  new_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  entry time_entries;
  trimmed text := nullif(trim(coalesce(new_notes, '')), '');
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  select * into entry from time_entries where id = entry_id;
  if entry is null then
    raise exception 'time entry not found';
  end if;

  if not exists (
    select 1
      from employee_profiles ep
      join group_members gm on gm.id = ep.group_member_id
     where ep.id = entry.employee_profile_id
       and gm.user_id = caller
  ) then
    raise exception 'cannot edit this time entry';
  end if;

  if entry.verified_at is not null then
    raise exception 'time entry already verified';
  end if;

  if new_clock_out is null or new_clock_out <= entry.clock_in then
    raise exception 'invalid clock out time';
  end if;

  update time_entries
     set clock_out = new_clock_out,
         status = 'closed',
         notes = trimmed
   where id = entry_id;
end;
$$;
