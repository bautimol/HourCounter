-- 0028_compensation_privacy.sql
-- ============================================================================
-- An employee cannot see what a colleague earns
-- ============================================================================
-- Confirmed by impersonating an employee's JWT against this database: any
-- active member could read every colleague's hourly_rate, all of their shifts,
-- their clock-in coordinates, their viáticos and their audit trail — straight
-- through PostgREST with the public anon key. Nothing in the UI ever showed
-- that data to an employee; it was reachable only by asking the API directly.
-- Which is exactly why nobody noticed.
--
-- This is the item 0020 deferred in its own footer and 0023 named again. Both
-- left it open for the same reason: the group-detail page's "Trabajando"
-- indicator reads coworkers' profiles and open shifts for BOTH roles, so
-- tightening the policies without a replacement breaks the live member list.
-- Section 8 is that replacement.
--
-- FOUR THINGS MOVE TOGETHER OR THE FIX IS COSMETIC:
--
--   1. employee_profiles.hourly_rate — the override, when there is one.
--   2. positions.hourly_rate — the INHERITED rate, which is where the number
--      lives for anyone invited into a rol. Verified live: an employee reading
--      `positions` got the whole rate card (Cajero 20005, Cocinero 26622).
--      Locking only (1) leaves the common case wide open.
--   3. time_entries.hourly_rate — the per-shift snapshot 0025 added. No row
--      carries a value yet, so this is a trap that arms itself the first time
--      an employer dates a rate change, not a leak bleeding today.
--   4. effective_employee_profile() — SECURITY DEFINER, gated only by
--      is_group_member, executable by authenticated, never revoked. Verified
--      live: an employee POSTed a colleague's profile UUID and got the rate
--      back. It bypasses every table policy by construction. Section 7.
--
-- SAFE TO APPLY LIVE. These are SELECT policies only; every write path already
-- goes through a SECURITY DEFINER function, which bypasses RLS. Every employer
-- screen is guarded by an is_group_employer branch. Every employee screen reads
-- only her own rows and is covered by the "or owner" branch — that half is
-- load-bearing, and dropping it would blank her clock card, her recent shifts
-- and her own payment receipt with no error at all (the payments policy from
-- 0020 reads employee_profiles through an inline subquery, so it inherits
-- whatever happens here).
--
-- DEPLOY ORDER. This migration is safe on its own, but until the matching
-- change to groups/[id]/page.tsx ships, an employee viewing the members list
-- stops seeing colleagues' "Trabajando" badge and job title. That is the fix
-- working; it is not a crash, and employers are unaffected.
--
-- RE-RUNNABLE. Applied by hand in the SQL editor, so it is one transaction (a
-- failure rolls back rather than leaving a half-applied state that looks
-- identical to never having run), every policy is drop-if-exists + create, and
-- every function is create-or-replace.

begin;

-- ----------------------------------------------------------------------------
-- 1) Helpers: "is this row mine?"
-- ----------------------------------------------------------------------------
-- Every owner branch below needs this question answered. Asked inline as an
-- `exists (select 1 from employee_profiles ...)` the subquery would itself be
-- filtered by employee_profiles' RLS — the coupling that already makes the
-- payments policy depend on this table. SECURITY DEFINER breaks the loop, the
-- same reason is_group_member exists.
--
-- Deliberately no `status = 'active'` check: someone archived out of a group
-- keeps reading her own history, matching how 0020 wrote the payments owner
-- branch. She sees nothing else anyway — group_members, groups and the members
-- list all still gate on is_group_member, which does require active.

create or replace function owns_employee_profile(profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from employee_profiles ep
      join group_members gm on gm.id = ep.group_member_id
     where ep.id = profile_id
       and gm.user_id = auth.uid()
  );
$$;

create or replace function owns_shift(target_shift_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from time_entries te
      join employee_profiles ep on ep.id = te.employee_profile_id
      join group_members gm on gm.id = ep.group_member_id
     where te.id = target_shift_id
       and gm.user_id = auth.uid()
  );
$$;

comment on function owns_employee_profile(uuid) is
  'True when the calling user is the employee behind this profile. Policy helper.';
comment on function owns_shift(uuid) is
  'True when the calling user is the employee whose shift this is. Policy helper.';

-- NOT revoked, on purpose. RLS policy expressions execute as the querying role,
-- so these must stay executable by authenticated — the same carve-out 0024
-- documented. Worst case for anon is an oracle that always answers false,
-- because auth.uid() is null.

-- ----------------------------------------------------------------------------
-- 2) employee_profiles: the override rate
-- ----------------------------------------------------------------------------
-- The old policy let any member of the group read any profile row. This table
-- also feeds the payments owner branch from 0020 through an inline subquery, so
-- the "or owner" half here is what keeps an employee able to open her own
-- comprobante. Employer-only would silently revoke the concession 0020 granted.

drop policy if exists "members can read employee profiles of their group" on employee_profiles;
drop policy if exists "employer or owner reads employee profiles" on employee_profiles;

create policy "employer or owner reads employee profiles"
  on employee_profiles for select
  using (
    is_group_employer(group_id_for_employee_profile(id))
    or owns_employee_profile(id)
  );

-- ----------------------------------------------------------------------------
-- 3) fixed_amounts: viáticos and bonos are compensation too
-- ----------------------------------------------------------------------------
-- A colleague's monthly viático is her pay by any reading of the rule, and no
-- employee-facing screen has ever read this table — not even for her own row.
-- The old policy was pure exposure with no feature behind it.

drop policy if exists "members read fixed amounts of their group" on fixed_amounts;
drop policy if exists "employer or owner reads fixed amounts" on fixed_amounts;

create policy "employer or owner reads fixed amounts"
  on fixed_amounts for select
  using (
    is_group_employer(group_id_for_employee_profile(employee_profile_id))
    or owns_employee_profile(employee_profile_id)
  );

-- ----------------------------------------------------------------------------
-- 4) time_entries: hours, the rate snapshot, and the clock-in coordinates
-- ----------------------------------------------------------------------------
-- CAREFUL — this table is not like the others. employee_profiles,
-- fixed_amounts, positions and position_fixed_amounts each already carry an
-- `employers manage ... for all` policy, and FOR ALL covers SELECT, so for
-- those the employer survives even a bare drop. time_entries' only other policy
-- is `for update`: the policy being replaced here is the ONLY thing granting an
-- employer SELECT. Drop it without this replacement and the employer loses the
-- shift queue, the review page, both reports and the payment draft — no error,
-- just zero rows everywhere.
--
-- This is also where the GPS goes away. The coordinates are not masked column
-- by column: they simply live on rows a colleague can no longer see. Column
-- GRANTs were not an option — employer and employee are both the `authenticated`
-- Postgres role, so revoking clock_in_lat from it would take the geofence
-- banner away from the employer, which is the entire feature. The employee
-- keeps her own coordinates: they are hers, and she is the one who granted the
-- browser permission that produced them.

drop policy if exists "members read time entries of their group" on time_entries;
drop policy if exists "employer or owner reads time entries" on time_entries;

create policy "employer or owner reads time entries"
  on time_entries for select
  using (
    is_group_employer(group_id_for_employee_profile(employee_profile_id))
    or owns_employee_profile(employee_profile_id)
  );

-- ----------------------------------------------------------------------------
-- 5) positions + position_fixed_amounts: the rate card
-- ----------------------------------------------------------------------------
-- positions.hourly_rate is NOT NULL and accept_invitation creates profiles with
-- every override left NULL, which CLAUDE.md defines as "inherits from position".
-- So for anyone invited into a rol, the number to hide is not on
-- employee_profiles at all — it is here, and an employee already knows her own
-- group_id from the URL.
--
-- No replacement policy needed: `employers manage positions of their group` is
-- FOR ALL and keeps every employer screen working, including the
-- INSERT ... RETURNING in positions/new/actions.ts — an insert whose .select()
-- is filtered by the SELECT policy, which is why "it's only a write" is not a
-- reason to skip checking it.
--
-- The one employee-reachable read was the job-title label on the members list,
-- and it asked for `name`, never the rate. Section 8 hands that back. The public
-- invite landing is untouched: it reads through get_invitation_by_code, which is
-- SECURITY DEFINER.

drop policy if exists "members read positions of their group" on positions;
drop policy if exists "members read position fixed amounts of their group" on position_fixed_amounts;

-- ----------------------------------------------------------------------------
-- 6) shift_edits: the paper trail follows the shift
-- ----------------------------------------------------------------------------
-- The old predicate reached into time_entries with an inline subquery, so
-- section 4 narrows this table for free. Rewritten anyway: the leftover
-- is_group_member term is the leak-shaped one, and a policy that only holds
-- because of a second policy's current wording is the kind of thing that comes
-- undone quietly. The employee keeps the log of her OWN shifts — that is the
-- whole stated purpose of 0015, and it is her half of the disagreement.
--
-- Both terms are null-safe: 0027 made shift_id nullable, and the orphaned
-- 'deleted' rows stay invisible to everyone, exactly as they are now. That is a
-- defect, not a decision, and it needs its own migration (see the footer).

drop policy if exists "members read shift_edits of their group" on shift_edits;
drop policy if exists "employer or owner reads shift_edits" on shift_edits;

create policy "employer or owner reads shift_edits"
  on shift_edits for select
  using (
    is_group_employer(group_id_for_shift(shift_id))
    or owns_shift(shift_id)
  );

-- ----------------------------------------------------------------------------
-- 7) effective_employee_profile: close the bypass
-- ----------------------------------------------------------------------------
-- Without this section every policy above is decoration. The function is
-- SECURITY DEFINER, so it reads past RLS by construction, and its only gate was
-- group membership — one POST with a colleague's profile UUID returns the rate.
-- 0023 fixed the cross-GROUP case and wrote down that the within-group case was
-- being left open.
--
-- Signature is unchanged, so create-or-replace is enough. Both internal callers
-- already require an employer (calculate_pay_draft, change_employee_rate) and
-- all three app call sites are employer-gated, so tightening breaks nothing.
--
-- The owner branch is kept although nothing calls it that way yet. Showing an
-- employee HER OWN rate is the obvious next screen, and this is the function
-- that should serve it.

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
  where ep.id = profile_id
    -- employer of the group, or the employee it describes. Nobody else.
    and (
      is_group_employer(group_id_for_employee_profile(profile_id))
      or owns_employee_profile(profile_id)
    );
$$;

-- Both real roles by name. `revoke ... from public` alone does NOT strip anon or
-- authenticated: Supabase grants EXECUTE to them explicitly via default
-- privileges, which is the lesson 0024 had to learn a second time for
-- record_shift_edit.
revoke all on function public.effective_employee_profile(uuid)
  from public, anon, authenticated;
grant execute on function public.effective_employee_profile(uuid)
  to authenticated;

-- ----------------------------------------------------------------------------
-- 8) group_members_overview: the safe-columns RPC 0020 asked for
-- ----------------------------------------------------------------------------
-- The members list shows, for every colleague, a "Trabajando" badge and a job
-- title. To get them it was reading every colleague's employee_profile and
-- every colleague's open time_entry — for both roles, with no employer branch.
-- That read is now gone, so the screen needs a source that answers only the two
-- questions it actually asks.
--
-- Returns three columns and nothing else. No profile id (the page must stop
-- needing colleagues' profile ids at all), no shift id, no clock_in (the old
-- query fetched it, stored it, and never rendered it), no rate, no coordinates.
-- Keyed on group_member_id, which is what the UI already renders rows by.
--
-- It sweeps expired shifts before answering. On this screen the sweep currently
-- runs inside the employee-only branch, four waves AFTER the badge query — so
-- the badges were computed from unswept data for everyone, and an employer never
-- swept here at all. Doing it inside makes the ordering guaranteed instead of
-- accidental, in one round trip. That is what makes this function volatile;
-- auto_close_expired_shifts is itself SECURITY DEFINER, so the perform runs as
-- the owner and is unaffected by any grant on it.
--
-- Gated on membership rather than employer because there is no money in the
-- return shape: a non-member gets an empty set, the same way
-- effective_employee_profile answers a stranger.
--
-- Dropped first so this file survives a later edit to the return shape —
-- create-or-replace cannot change a function's OUT columns.

drop function if exists group_members_overview(uuid);

create or replace function group_members_overview(target_group_id uuid)
returns table (
  member_id uuid,
  position_name text,
  is_working boolean
)
language plpgsql
security definer
set search_path = public
volatile
as $$
begin
  if not is_group_member(target_group_id) then
    return;
  end if;

  perform auto_close_expired_shifts();

  return query
    select
      gm.id,
      p.name::text,
      exists (
        select 1
          from time_entries te
         where te.employee_profile_id = ep.id
           and te.status = 'open'
      )
      from group_members gm
      left join employee_profiles ep on ep.group_member_id = gm.id
      left join positions p on p.id = ep.position_id
     where gm.group_id = target_group_id
       and gm.status = 'active'
     order by gm.joined_at;
end;
$$;

comment on function group_members_overview(uuid) is
  'Members list support: presence + job title only, never compensation. '
  'Replaces the direct coworker reads of employee_profiles and time_entries.';

revoke all on function public.group_members_overview(uuid)
  from public, anon, authenticated;
grant execute on function public.group_members_overview(uuid)
  to authenticated;

commit;

-- ============================================================================
-- 9) Adjacent hardening. Not about the rate leak; separate transaction so it
--    can be dropped without touching anything above.
-- ============================================================================
-- auto_close_expired_shifts is SECURITY DEFINER with NO authorization check of
-- any kind, wrapping a bare UPDATE over every open shift in the database, and
-- has never been revoked — any caller holding the public anon key can fire it.
-- The damage is bounded (it writes exactly the clock_out the next legitimate
-- sweep would write, cannot close a shift early and cannot pick a victim), so
-- this is unauthenticated write amplification, not corruption.
--
-- The other two ran the one-line revoke idiom that 0024 already proved
-- insufficient, and are executable by anon today. Both raise on a non-employer
-- caller, so this is tidiness plus advisor noise, not an open door.

begin;

revoke all on function public.auto_close_expired_shifts()
  from public, anon, authenticated;
grant execute on function public.auto_close_expired_shifts()
  to authenticated;

revoke all on function public.change_employee_rate(uuid, numeric, date)
  from public, anon, authenticated;
grant execute on function public.change_employee_rate(uuid, numeric, date)
  to authenticated;

revoke all on function public.employer_delete_entries(uuid[])
  from public, anon, authenticated;
grant execute on function public.employer_delete_entries(uuid[])
  to authenticated;

commit;

-- ============================================================================
-- NOT in this migration (deliberate, each one a real item):
--   - shift_edits' orphaned 'deleted' rows are readable by nobody, employer
--     included, because the predicate joins on a shift_id that is NULL. Needs
--     shift_edits.group_id + a rewrite of the delete RPCs; the already-orphaned
--     rows cannot be backfilled.
--   - create_payment has no employer check of its own and inherits it entirely
--     from calculate_pay_draft — a function recreated four times that already
--     suffered one silent parallel-rewrite collision (CLAUDE.md 14). The gate
--     should be duplicated locally.
--   - `employers update any time entry in their group` lets an employer PATCH
--     time_entries straight through PostgREST, writing NO shift_edits row. A
--     hole in the audit guarantee, not in this one.
--   - The stale 3-arg create_invitation overload from 0004 is still live: 0005
--     changed the arity with create-or-replace and never dropped it.
-- ============================================================================
