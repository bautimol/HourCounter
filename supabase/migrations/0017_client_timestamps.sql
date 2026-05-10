-- ============================================================================
-- HourCounter — Use the client's click time for clock_in / clock_out
-- ============================================================================
-- Problem: the previous clock_in / clock_out used now() server-side at the
-- moment of the INSERT/UPDATE. Between the user clicking the button and
-- the row being written, request processing + revalidation + render lag
-- elapsed (a few seconds in production, easily 30-40s in dev under
-- Turbopack first-compile). Result: the live timer started at "0:00:40"
-- instead of "0:00:00", and shifts logged a few extra seconds.
--
-- Fix: clients pass their own click timestamp; the server accepts it
-- only inside a ±60s window of its own clock (1 minute back, 5 seconds
-- forward for clock skew). Outside the window the server falls back to
-- its own now(). That bounds any lying/skew to under a minute and makes
-- the displayed time honest.
--
-- Both functions get a new optional trailing arg. Old callers continue to
-- work with server-now semantics.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) clock_in — accept optional target_clock_in_iso
-- ----------------------------------------------------------------------------

drop function if exists clock_in(uuid, integer, numeric, numeric);

create or replace function clock_in(
  target_group_id uuid,
  target_expected_minutes integer default null,
  target_lat numeric default null,
  target_lng numeric default null,
  target_clock_in_iso timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  member_id uuid;
  caller_role member_role;
  profile_id uuid;
  entry_id uuid;
  group_geo_enabled boolean;
  group_geo_lat numeric;
  group_geo_lng numeric;
  group_geo_radius integer;
  computed_within boolean;
  distance_m numeric;
  effective_clock_in timestamptz;
  server_now timestamptz := now();
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  perform auto_close_expired_shifts();

  select id, role into member_id, caller_role
    from group_members
   where group_id = target_group_id
     and user_id = caller
     and status = 'active';

  if member_id is null then
    raise exception 'not a member of this group';
  end if;

  if caller_role <> 'employee' then
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

  -- Resolve effective clock_in: prefer client-provided timestamp if it's
  -- inside the trust window. Otherwise use server now.
  if target_clock_in_iso is not null
     and target_clock_in_iso between server_now - interval '60 seconds'
                                  and server_now + interval '5 seconds'
  then
    effective_clock_in := target_clock_in_iso;
  else
    effective_clock_in := server_now;
  end if;

  -- Resolve the geofence flag at clock-in time.
  select geofence_enabled, geofence_lat, geofence_lng, geofence_radius_m
    into group_geo_enabled, group_geo_lat, group_geo_lng, group_geo_radius
    from groups where id = target_group_id;

  if group_geo_enabled then
    if target_lat is null or target_lng is null then
      computed_within := false;
    else
      distance_m := haversine_meters(
        group_geo_lat, group_geo_lng, target_lat, target_lng
      );
      computed_within := distance_m <= group_geo_radius;
    end if;
  else
    computed_within := null;
  end if;

  insert into time_entries (
    employee_profile_id, clock_in, expected_minutes, status,
    clock_in_lat, clock_in_lng, within_geofence
  )
  values (
    profile_id, effective_clock_in, target_expected_minutes, 'open',
    target_lat, target_lng, computed_within
  )
  returning id into entry_id;

  return entry_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) clock_out — accept optional target_clock_out_iso (same window logic)
-- ----------------------------------------------------------------------------
-- The window is also clamped not to go before the shift's clock_in (you
-- can't clock out before you clocked in).

drop function if exists clock_out(uuid, text);

create or replace function clock_out(
  target_group_id uuid,
  notes_text text default null,
  target_clock_out_iso timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  entry_id uuid;
  entry_clock_in timestamptz;
  effective_clock_out timestamptz;
  server_now timestamptz := now();
  trimmed text := nullif(trim(coalesce(notes_text, '')), '');
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  perform auto_close_expired_shifts();

  select te.id, te.clock_in into entry_id, entry_clock_in
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

  -- Resolve effective clock_out using the same trust window as clock_in.
  if target_clock_out_iso is not null
     and target_clock_out_iso between server_now - interval '60 seconds'
                                  and server_now + interval '5 seconds'
  then
    effective_clock_out := target_clock_out_iso;
  else
    effective_clock_out := server_now;
  end if;

  -- Defensive: clock_out can never be before or equal to clock_in.
  if effective_clock_out <= entry_clock_in then
    effective_clock_out := entry_clock_in + interval '1 second';
  end if;

  update time_entries
     set clock_out = effective_clock_out,
         status = 'closed',
         notes = trimmed
   where id = entry_id;

  return entry_id;
end;
$$;
