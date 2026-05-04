-- ============================================================================
-- HourCounter — Notes, nicknames, and atomic member editor
-- ============================================================================
-- Three additions tied to the member editor:
--
--  1. employee_notes (1:1 with employee_profiles)
--     Free-form notes about the employee, shared across employers of the
--     group, NEVER visible to the employee themselves. Separate table so
--     the SELECT scope can be tightened to is_group_employer without
--     touching the existing employee_profiles read policy (which keeps
--     non-employer members able to read profile scalars).
--
--  2. member_nicknames (per-viewer)
--     Each user can set their own private nickname for any member they
--     can see. Composite PK on (viewer_user_id, target_member_id).
--
--  3. update_member_full(...) — single atomic edit covering profile
--     scalars + nickname + notes + fixed amounts list. Replaces the
--     previous chained-updates approach.
--
--  4. update_my_display_name(new_name) — self-service, lets the caller
--     rename themselves across every group they're a member of. The
--     existing UPDATE policy on group_members only allows employers to
--     edit memberships, so we need this SECURITY DEFINER helper.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) employee_notes
-- ----------------------------------------------------------------------------

create table employee_notes (
  employee_profile_id uuid primary key references employee_profiles (id) on delete cascade,
  notes text not null,
  updated_at timestamptz not null default now()
);

alter table employee_notes enable row level security;

create policy "employers read employee notes"
  on employee_notes for select
  using (
    exists (
      select 1 from employee_profiles ep
      join group_members gm on gm.id = ep.group_member_id
      where ep.id = employee_notes.employee_profile_id
        and is_group_employer(gm.group_id)
    )
  );

create policy "employers write employee notes"
  on employee_notes for all
  using (
    exists (
      select 1 from employee_profiles ep
      join group_members gm on gm.id = ep.group_member_id
      where ep.id = employee_notes.employee_profile_id
        and is_group_employer(gm.group_id)
    )
  )
  with check (
    exists (
      select 1 from employee_profiles ep
      join group_members gm on gm.id = ep.group_member_id
      where ep.id = employee_notes.employee_profile_id
        and is_group_employer(gm.group_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 2) member_nicknames
-- ----------------------------------------------------------------------------

create table member_nicknames (
  viewer_user_id uuid not null references auth.users (id) on delete cascade,
  target_member_id uuid not null references group_members (id) on delete cascade,
  nickname text not null check (length(trim(nickname)) > 0),
  updated_at timestamptz not null default now(),
  primary key (viewer_user_id, target_member_id)
);

create index member_nicknames_target_idx on member_nicknames (target_member_id);

alter table member_nicknames enable row level security;

-- The viewer can only see/edit their own nicknames.
create policy "viewer manages own nicknames"
  on member_nicknames for all
  using (viewer_user_id = auth.uid())
  with check (viewer_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3) update_member_full
-- ----------------------------------------------------------------------------
-- Atomic edit of an employee member from the employer-side editor. Handles:
--   - upsert/delete of the caller's nickname for the member
--   - upsert of the employee_profile (creating it on demand)
--   - upsert/delete of employee_notes
--   - full replacement of the fixed_amounts list
--
-- Caller must be an active employer of the group. Auth checks happen here
-- so the function can be SECURITY DEFINER.
-- ----------------------------------------------------------------------------

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
   where id = target_member_id;

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
     where viewer_user_id = caller and target_member_id = update_member_full.target_member_id;
  else
    insert into member_nicknames (viewer_user_id, target_member_id, nickname)
    values (caller, target_member_id, trim(new_nickname))
    on conflict (viewer_user_id, target_member_id)
    do update set nickname = excluded.nickname, updated_at = now();
  end if;

  -- Profile upsert.
  select id into profile_id
    from employee_profiles
   where group_member_id = target_member_id;

  if profile_id is null then
    insert into employee_profiles (
      group_member_id, position_id, hourly_rate, payment_period,
      custom_period_days, currency
    )
    values (
      target_member_id, new_position_id, new_hourly_rate, new_payment_period,
      new_custom_period_days, new_currency
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

-- ----------------------------------------------------------------------------
-- 4) update_my_display_name
-- ----------------------------------------------------------------------------

create or replace function update_my_display_name(new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  trimmed text;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  trimmed := trim(coalesce(new_name, ''));
  if length(trimmed) = 0 then
    raise exception 'display name cannot be empty';
  end if;

  update group_members
     set display_name = trimmed
   where user_id = caller;
end;
$$;
