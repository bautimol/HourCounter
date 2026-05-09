-- ============================================================================
-- HourCounter — Opt-in geofencing for clock-in
-- ============================================================================
-- Adds an opt-in geofence to each group: when the employer enables it and
-- sets center + radius, employee clock-ins capture the device's lat/lng
-- (if granted by the browser) and get flagged as inside or outside the
-- radius. We don't reject — flagging is enough — so a wonky GPS doesn't
-- block someone from working.
--
-- Stored data:
--   - groups.geofence_*           : center (lat/lng), radius, enabled flag
--   - time_entries.clock_in_lat   : where the device said it was at clock-in
--   - time_entries.clock_in_lng     (NULL if user denied geolocation)
--   - time_entries.within_geofence: NULL when geofence wasn't enabled at the
--                                   time, otherwise true/false
--
-- This is opt-in / one-shot per shift / transparent — qualitatively
-- different from continuous tracking. See CLAUDE.md "Out of scope" section.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Schema
-- ----------------------------------------------------------------------------

alter table groups
  add column geofence_enabled boolean not null default false,
  add column geofence_lat numeric(9, 6),
  add column geofence_lng numeric(9, 6),
  add column geofence_radius_m integer
    check (geofence_radius_m is null or (geofence_radius_m between 10 and 100000)),
  -- If geofence_enabled = true, lat/lng/radius must all be set.
  add constraint groups_geofence_complete check (
    geofence_enabled = false
    or (
      geofence_lat is not null
      and geofence_lng is not null
      and geofence_radius_m is not null
    )
  );

alter table time_entries
  add column clock_in_lat numeric(9, 6),
  add column clock_in_lng numeric(9, 6),
  add column within_geofence boolean;

-- ----------------------------------------------------------------------------
-- 2) Haversine helper — meters between two lat/lng pairs
-- ----------------------------------------------------------------------------
-- Pure math, immutable. Returns NULL if any input is NULL.

create or replace function haversine_meters(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
)
returns numeric
language sql
immutable
parallel safe
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else
      6371000 * 2 * asin(
        sqrt(
          power(sin(radians((lat2 - lat1) / 2)), 2)
          + cos(radians(lat1)) * cos(radians(lat2))
            * power(sin(radians((lng2 - lng1) / 2)), 2)
        )
      )
  end;
$$;

-- ----------------------------------------------------------------------------
-- 3) update_group_geofence — employer-only
-- ----------------------------------------------------------------------------

create or replace function update_group_geofence(
  target_group_id uuid,
  new_enabled boolean,
  new_lat numeric,
  new_lng numeric,
  new_radius_m integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = target_group_id
      and user_id = caller
      and role = 'employer'
      and status = 'active'
  ) then
    raise exception 'only employers can update the geofence';
  end if;

  if new_enabled then
    if new_lat is null or new_lng is null or new_radius_m is null then
      raise exception 'lat/lng/radius required when enabling geofence';
    end if;
    if new_lat not between -90 and 90 then
      raise exception 'invalid latitude';
    end if;
    if new_lng not between -180 and 180 then
      raise exception 'invalid longitude';
    end if;
    if new_radius_m not between 10 and 100000 then
      raise exception 'radius must be between 10 m and 100 km';
    end if;
  end if;

  update groups
     set geofence_enabled = new_enabled,
         geofence_lat = case when new_enabled then new_lat else null end,
         geofence_lng = case when new_enabled then new_lng else null end,
         geofence_radius_m = case when new_enabled then new_radius_m else null end
   where id = target_group_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Recreate clock_in to accept optional lat/lng + compute geofence flag
-- ----------------------------------------------------------------------------
-- Drop & replace because the signature changes (added two params).

drop function if exists clock_in(uuid, integer);

create or replace function clock_in(
  target_group_id uuid,
  target_expected_minutes integer default null,
  target_lat numeric default null,
  target_lng numeric default null
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

  -- Resolve the geofence flag at clock-in time.
  select geofence_enabled, geofence_lat, geofence_lng, geofence_radius_m
    into group_geo_enabled, group_geo_lat, group_geo_lng, group_geo_radius
    from groups where id = target_group_id;

  if group_geo_enabled then
    if target_lat is null or target_lng is null then
      -- Geofence enabled but no device location → flag as outside / unknown.
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
    profile_id, now(), target_expected_minutes, 'open',
    target_lat, target_lng, computed_within
  )
  returning id into entry_id;

  return entry_id;
end;
$$;
