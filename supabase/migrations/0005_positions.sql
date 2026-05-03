-- ============================================================================
-- HourCounter — Positions (job roles within a group)
-- ============================================================================
-- A "position" is a template for an employee inside a group: hourly_rate,
-- payment cadence and a list of fixed-amount line items (viáticos, etc.).
--
-- Live link with overrides:
--   - employee_profiles.position_id is the FK to the role.
--   - employee_profiles.{hourly_rate, payment_period, ...} are NULLABLE.
--     NULL means "inherit from position", non-null means "manually overridden".
--   - For ad-hoc employees (no position) those columns must be set.
--
-- Fixed amounts:
--   - position_fixed_amounts holds the templates.
--   - At invitation acceptance time, they are COPIED into the per-employee
--     fixed_amounts table. After that, employee fixed amounts evolve
--     independently (no live link for the list itself — only for the simple
--     scalar fields above).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

create table positions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  name text not null,
  hourly_rate numeric(12, 2) not null check (hourly_rate >= 0),
  payment_period payment_period not null,
  custom_period_days integer check (
    (payment_period = 'custom_days' and custom_period_days is not null and custom_period_days > 0)
    or (payment_period <> 'custom_days' and custom_period_days is null)
  ),
  currency text not null default 'ARS',
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create table position_fixed_amounts (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references positions (id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null,
  frequency fixed_amount_frequency not null,
  created_at timestamptz not null default now()
);

create index positions_group_idx on positions (group_id);
create index position_fixed_amounts_position_idx on position_fixed_amounts (position_id);

-- ----------------------------------------------------------------------------
-- ALTER employee_profiles: add position_id, allow NULLs for inheritable fields
-- ----------------------------------------------------------------------------

alter table employee_profiles
  add column position_id uuid references positions (id) on delete set null;

alter table employee_profiles
  alter column hourly_rate drop not null,
  alter column payment_period drop not null;

-- Drop the existing anonymous CHECKs that reference these columns so we can
-- replace them with versions that allow NULLs.
do $$
declare
  c text;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'employee_profiles'::regclass
       and contype = 'c'
       and (
         pg_get_constraintdef(oid) ilike '%hourly_rate%'
         or pg_get_constraintdef(oid) ilike '%custom_period_days%'
       )
  loop
    execute format('alter table employee_profiles drop constraint %I', c);
  end loop;
end $$;

alter table employee_profiles
  add constraint employee_profiles_hourly_rate_nonneg
    check (hourly_rate is null or hourly_rate >= 0);

alter table employee_profiles
  add constraint employee_profiles_custom_period_days_chk
    check (
      (payment_period = 'custom_days' and custom_period_days is not null and custom_period_days > 0)
      or (payment_period <> 'custom_days' and custom_period_days is null)
      or (payment_period is null and custom_period_days is null)
    );

-- An employee profile must either inherit from a position OR have its own
-- complete configuration.
alter table employee_profiles
  add constraint employee_profiles_position_or_complete
    check (
      position_id is not null
      or (hourly_rate is not null and payment_period is not null)
    );

create index employee_profiles_position_idx on employee_profiles (position_id);

-- ----------------------------------------------------------------------------
-- ALTER invitations: add position_id
-- ----------------------------------------------------------------------------

alter table invitations
  add column position_id uuid references positions (id) on delete set null;

-- ----------------------------------------------------------------------------
-- HELPER FUNCTION: effective values for an employee profile
-- ----------------------------------------------------------------------------

create or replace function effective_employee_profile(profile_id uuid)
returns table (
  id uuid,
  group_member_id uuid,
  position_id uuid,
  hourly_rate numeric,
  payment_period payment_period,
  custom_period_days integer,
  currency text,
  hourly_rate_overridden boolean,
  payment_period_overridden boolean,
  currency_overridden boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    ep.id,
    ep.group_member_id,
    ep.position_id,
    coalesce(ep.hourly_rate, p.hourly_rate)               as hourly_rate,
    coalesce(ep.payment_period, p.payment_period)         as payment_period,
    coalesce(ep.custom_period_days, p.custom_period_days) as custom_period_days,
    coalesce(ep.currency, p.currency)                     as currency,
    ep.hourly_rate is not null                            as hourly_rate_overridden,
    ep.payment_period is not null                         as payment_period_overridden,
    ep.currency is not null                               as currency_overridden
  from employee_profiles ep
  left join positions p on p.id = ep.position_id
  where ep.id = profile_id;
$$;

-- ----------------------------------------------------------------------------
-- UPDATE invitation functions to support position_id
-- ----------------------------------------------------------------------------

create or replace function create_invitation(
  target_group_id uuid,
  invite_role member_role default 'employee',
  invite_position_id uuid default null,
  ttl_days integer default 7
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  invite_code text;
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
    raise exception 'only employers can create invitations';
  end if;

  if invite_position_id is not null then
    if invite_role <> 'employee' then
      raise exception 'position only applies to employee invitations';
    end if;
    if not exists (
      select 1 from positions
      where id = invite_position_id and group_id = target_group_id
    ) then
      raise exception 'position does not belong to this group';
    end if;
  end if;

  invite_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));

  insert into invitations (group_id, code, role, created_by, position_id, expires_at)
  values (
    target_group_id,
    invite_code,
    invite_role,
    caller,
    invite_position_id,
    case when ttl_days is null then null else now() + (ttl_days || ' days')::interval end
  );

  return invite_code;
end;
$$;

-- get_invitation_by_code now returns position info as well; signature
-- changed, so drop and recreate.
drop function if exists get_invitation_by_code(text);

create or replace function get_invitation_by_code(invite_code text)
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  role member_role,
  position_id uuid,
  position_name text,
  expires_at timestamptz,
  used_at timestamptz,
  is_member boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    i.id,
    i.group_id,
    g.name as group_name,
    i.role,
    i.position_id,
    p.name as position_name,
    i.expires_at,
    i.used_at,
    exists (
      select 1 from group_members gm
      where gm.group_id = i.group_id
        and gm.user_id = auth.uid()
    ) as is_member
  from invitations i
  join groups g on g.id = i.group_id
  left join positions p on p.id = i.position_id
  where i.code = invite_code;
$$;

create or replace function accept_invitation(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_name text;
  inv invitations;
  new_member_id uuid;
  new_profile_id uuid;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from invitations where code = invite_code;
  if not found then
    raise exception 'invitation not found';
  end if;

  if inv.used_at is not null then
    raise exception 'invitation already used';
  end if;

  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception 'invitation expired';
  end if;

  if exists (
    select 1 from group_members
    where group_id = inv.group_id and user_id = caller
  ) then
    raise exception 'already a member of this group';
  end if;

  select coalesce(raw_user_meta_data ->> 'full_name', email)
    into caller_name
    from auth.users
    where id = caller;

  insert into group_members (group_id, user_id, role, display_name)
  values (inv.group_id, caller, inv.role, caller_name)
  returning id into new_member_id;

  -- If invited as employee with a position, create the profile and copy
  -- the position's fixed amounts as the starting point.
  if inv.role = 'employee' and inv.position_id is not null then
    insert into employee_profiles (group_member_id, position_id)
    values (new_member_id, inv.position_id)
    returning id into new_profile_id;

    insert into fixed_amounts (employee_profile_id, description, amount, frequency)
    select new_profile_id, description, amount, frequency
      from position_fixed_amounts
     where position_id = inv.position_id;
  end if;

  update invitations
     set used_by = caller, used_at = now()
   where id = inv.id;

  return inv.group_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY for the new tables
-- ----------------------------------------------------------------------------

alter table positions enable row level security;
alter table position_fixed_amounts enable row level security;

-- ---- positions -------------------------------------------------------------

create policy "members read positions of their group"
  on positions for select
  using (is_group_member(group_id));

create policy "employers manage positions of their group"
  on positions for all
  using (is_group_employer(group_id))
  with check (is_group_employer(group_id));

-- ---- position_fixed_amounts ------------------------------------------------

create policy "members read position fixed amounts of their group"
  on position_fixed_amounts for select
  using (
    exists (
      select 1 from positions p
      where p.id = position_id and is_group_member(p.group_id)
    )
  );

create policy "employers manage position fixed amounts of their group"
  on position_fixed_amounts for all
  using (
    exists (
      select 1 from positions p
      where p.id = position_id and is_group_employer(p.group_id)
    )
  )
  with check (
    exists (
      select 1 from positions p
      where p.id = position_id and is_group_employer(p.group_id)
    )
  );
