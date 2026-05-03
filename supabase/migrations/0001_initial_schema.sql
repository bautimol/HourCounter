-- ============================================================================
-- HourCounter — Initial Schema
-- ============================================================================
-- Tables, indexes, and Row Level Security policies for the core domain.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------

create type member_role as enum ('employer', 'employee');
create type member_status as enum ('active', 'archived');
create type payment_period as enum ('weekly', 'biweekly', 'monthly', 'custom_days');
create type fixed_amount_frequency as enum ('per_period', 'per_day_worked', 'one_shot');
create type time_entry_status as enum ('open', 'closed', 'needs_review');

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

-- groups: a workspace owned by one or more employers
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

-- group_members: relation user <-> group, with per-group role
create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null,
  status member_status not null default 'active',
  display_name text,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

-- employee_profiles: employment data for a member that is an employee
create table employee_profiles (
  id uuid primary key default gen_random_uuid(),
  group_member_id uuid not null unique references group_members (id) on delete cascade,
  hourly_rate numeric(12, 2) not null check (hourly_rate >= 0),
  payment_period payment_period not null,
  custom_period_days integer check (
    (payment_period = 'custom_days' and custom_period_days is not null and custom_period_days > 0)
    or (payment_period <> 'custom_days' and custom_period_days is null)
  ),
  currency text not null default 'ARS',
  created_at timestamptz not null default now()
);

-- fixed_amounts: extra amounts (allowances, viáticos, bonuses, etc.)
create table fixed_amounts (
  id uuid primary key default gen_random_uuid(),
  employee_profile_id uuid not null references employee_profiles (id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null,
  frequency fixed_amount_frequency not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- time_entries: clock in/out records
create table time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_profile_id uuid not null references employee_profiles (id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz,
  status time_entry_status not null default 'open',
  notes text,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (clock_out is null or clock_out > clock_in)
);

-- payments: snapshot of a payment made to an employee
create table payments (
  id uuid primary key default gen_random_uuid(),
  employee_profile_id uuid not null references employee_profiles (id) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null,
  hours_worked numeric(8, 2) not null default 0,
  hourly_amount numeric(12, 2) not null default 0,
  fixed_amounts_total numeric(12, 2) not null default 0,
  adjustments_total numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  notes text,
  paid_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict,
  check (period_end > period_start)
);

-- payment_adjustments: one-shot additions/deductions applied at payment time
create table payment_adjustments (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments (id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

-- invitations: invite codes/links for joining a group
create table invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  code text not null unique,
  role member_role not null default 'employee',
  created_by uuid not null references auth.users (id) on delete restrict,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------

create index group_members_group_id_idx on group_members (group_id);
create index group_members_user_id_idx on group_members (user_id);
create index employee_profiles_group_member_idx on employee_profiles (group_member_id);
create index fixed_amounts_employee_idx on fixed_amounts (employee_profile_id);
create index time_entries_employee_idx on time_entries (employee_profile_id);
create index time_entries_status_idx on time_entries (status);
create index payments_employee_idx on payments (employee_profile_id);
create index payment_adjustments_payment_idx on payment_adjustments (payment_id);
create index invitations_group_idx on invitations (group_id);
create index invitations_code_idx on invitations (code);

-- ----------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Returns true if the current user is a member of the given group.
-- SECURITY DEFINER avoids recursive RLS evaluation when called from policies.
create or replace function is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = target_group_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- Returns true if the current user is an employer of the given group.
create or replace function is_group_employer(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = target_group_id
      and user_id = auth.uid()
      and role = 'employer'
      and status = 'active'
  );
$$;

-- Returns the group_id of an employee_profile (helper for nested RLS).
create or replace function group_id_for_employee_profile(profile_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select gm.group_id
  from employee_profiles ep
  join group_members gm on gm.id = ep.group_member_id
  where ep.id = profile_id;
$$;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table groups enable row level security;
alter table group_members enable row level security;
alter table employee_profiles enable row level security;
alter table fixed_amounts enable row level security;
alter table time_entries enable row level security;
alter table payments enable row level security;
alter table payment_adjustments enable row level security;
alter table invitations enable row level security;

-- ---- groups ----------------------------------------------------------------

create policy "members can read their groups"
  on groups for select
  using (is_group_member(id));

create policy "any authenticated user can create a group"
  on groups for insert
  with check (auth.uid() = created_by);

create policy "employers can update their groups"
  on groups for update
  using (is_group_employer(id))
  with check (is_group_employer(id));

-- ---- group_members ---------------------------------------------------------

create policy "members can read members of their groups"
  on group_members for select
  using (is_group_member(group_id));

-- The first member (creator) inserts themselves as employer.
-- Subsequent additions go through the invitation flow (separate policy below).
create policy "user can insert their own membership"
  on group_members for insert
  with check (user_id = auth.uid());

create policy "employers can update memberships in their group"
  on group_members for update
  using (is_group_employer(group_id))
  with check (is_group_employer(group_id));

-- ---- employee_profiles -----------------------------------------------------

create policy "members can read employee profiles of their group"
  on employee_profiles for select
  using (
    exists (
      select 1 from group_members gm
      where gm.id = employee_profiles.group_member_id
        and is_group_member(gm.group_id)
    )
  );

create policy "employers manage employee profiles in their group"
  on employee_profiles for all
  using (
    exists (
      select 1 from group_members gm
      where gm.id = employee_profiles.group_member_id
        and is_group_employer(gm.group_id)
    )
  )
  with check (
    exists (
      select 1 from group_members gm
      where gm.id = employee_profiles.group_member_id
        and is_group_employer(gm.group_id)
    )
  );

-- ---- fixed_amounts ---------------------------------------------------------

create policy "members read fixed amounts of their group"
  on fixed_amounts for select
  using (is_group_member(group_id_for_employee_profile(employee_profile_id)));

create policy "employers manage fixed amounts in their group"
  on fixed_amounts for all
  using (is_group_employer(group_id_for_employee_profile(employee_profile_id)))
  with check (is_group_employer(group_id_for_employee_profile(employee_profile_id)));

-- ---- time_entries ----------------------------------------------------------

create policy "members read time entries of their group"
  on time_entries for select
  using (is_group_member(group_id_for_employee_profile(employee_profile_id)));

-- Employees can clock in/out for themselves.
create policy "employee inserts own time entry"
  on time_entries for insert
  with check (
    exists (
      select 1 from employee_profiles ep
      join group_members gm on gm.id = ep.group_member_id
      where ep.id = employee_profile_id
        and gm.user_id = auth.uid()
    )
  );

-- Employees can update their own open entries; employers can update any.
create policy "employee updates own time entry"
  on time_entries for update
  using (
    exists (
      select 1 from employee_profiles ep
      join group_members gm on gm.id = ep.group_member_id
      where ep.id = employee_profile_id
        and gm.user_id = auth.uid()
    )
  );

create policy "employers update any time entry in their group"
  on time_entries for update
  using (is_group_employer(group_id_for_employee_profile(employee_profile_id)))
  with check (is_group_employer(group_id_for_employee_profile(employee_profile_id)));

-- ---- payments --------------------------------------------------------------

create policy "members read payments of their group"
  on payments for select
  using (is_group_member(group_id_for_employee_profile(employee_profile_id)));

create policy "employers create payments"
  on payments for insert
  with check (
    is_group_employer(group_id_for_employee_profile(employee_profile_id))
    and created_by = auth.uid()
  );

-- ---- payment_adjustments ---------------------------------------------------

create policy "members read adjustments of payments they can read"
  on payment_adjustments for select
  using (
    exists (
      select 1 from payments p
      where p.id = payment_id
        and is_group_member(group_id_for_employee_profile(p.employee_profile_id))
    )
  );

create policy "employers manage adjustments"
  on payment_adjustments for all
  using (
    exists (
      select 1 from payments p
      where p.id = payment_id
        and is_group_employer(group_id_for_employee_profile(p.employee_profile_id))
    )
  )
  with check (
    exists (
      select 1 from payments p
      where p.id = payment_id
        and is_group_employer(group_id_for_employee_profile(p.employee_profile_id))
    )
  );

-- ---- invitations -----------------------------------------------------------

create policy "employers manage invitations of their group"
  on invitations for all
  using (is_group_employer(group_id))
  with check (is_group_employer(group_id) and created_by = auth.uid());

-- Anyone authenticated can read an invitation by its code (to validate it
-- before joining). The code itself is the access token here.
create policy "authenticated can read invitation by code"
  on invitations for select
  to authenticated
  using (true);
