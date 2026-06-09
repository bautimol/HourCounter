-- 0020_security_hardening.sql
-- (renumbered from 0019 to avoid clashing with 0019_fix_update_member_full_ambiguous)
--
-- Closes critical RLS holes exploitable directly through PostgREST with the
-- public anon key. Every one of these was reachable by an authenticated user
-- bypassing the app entirely (POST/PATCH/GET straight to /rest/v1/...).
--
-- SAFE TO APPLY ON A LIVE APP: every legitimate write path in the app goes
-- through a SECURITY DEFINER function (clock_in, clock_out, create_payment,
-- update_my_time_entry, accept_invitation, create_group_with_owner,
-- verify_shift, employer_update_shift), which bypasses RLS. The policies
-- dropped/tightened here only ever gated the *direct table* access that no
-- legitimate client uses. Verified: no app code does a direct insert/update on
-- these tables (only payments.delete, whose policy is left untouched).
--
-- Does NOT require a redeploy — it takes effect the moment it runs.

-- =============================================================================
-- 1) group_members: anyone could insert themselves as employer of any group
-- =============================================================================
-- The old policy only checked `user_id = auth.uid()`, leaving `role` and
-- `group_id` unconstrained. An attacker who learned any group UUID (e.g. from
-- an invite link) could POST {group_id, user_id:self, role:'employer'} and take
-- the group over. Legitimate membership creation goes through
-- create_group_with_owner() and accept_invitation() (both SECURITY DEFINER),
-- so this direct-insert policy is not needed at all.
drop policy if exists "user can insert their own membership" on group_members;

-- =============================================================================
-- 2) time_entries: employees could fabricate / inflate / self-verify shifts
-- =============================================================================
-- The INSERT and UPDATE policies only checked row ownership, not which columns
-- changed. An employee could PATCH their own row to set clock_out far in the
-- future and verified_at=now() (the exact hour-inflation that migration 0016
-- was meant to stop -- but 0016 only fixed the RPC, not the raw policy), or
-- POST a brand-new pre-verified shift. Clock in/out and the notes-only
-- self-edit all go through SECURITY DEFINER RPCs (clock_in / clock_out /
-- update_my_time_entry), so employees need no direct write access.
drop policy if exists "employee inserts own time entry" on time_entries;
drop policy if exists "employee updates own time entry" on time_entries;
-- (The employer policy "employers update any time entry in their group" stays:
--  it is correctly scoped to is_group_employer and is not a hole.)

-- =============================================================================
-- 3) payments / payment_adjustments: every employee could read the whole payroll
-- =============================================================================
-- SELECT was gated by is_group_member, so any employee could
-- GET /rest/v1/payments?select=* and read every coworker's pay. Restrict to:
-- employers of the group (see everything) OR the employee the payment belongs
-- to (sees only their own receipt).

drop policy if exists "members read payments of their group" on payments;

create policy "employer or owner reads payments"
  on payments for select
  using (
    is_group_employer(group_id_for_employee_profile(employee_profile_id))
    or exists (
      select 1
      from employee_profiles ep
      join group_members gm on gm.id = ep.group_member_id
      where ep.id = payments.employee_profile_id
        and gm.user_id = auth.uid()
    )
  );

drop policy if exists "members read adjustments of payments they can read" on payment_adjustments;

create policy "employer or owner reads adjustments"
  on payment_adjustments for select
  using (
    exists (
      select 1
      from payments p
      where p.id = payment_adjustments.payment_id
        and (
          is_group_employer(group_id_for_employee_profile(p.employee_profile_id))
          or exists (
            select 1
            from employee_profiles ep
            join group_members gm on gm.id = ep.group_member_id
            where ep.id = p.employee_profile_id
              and gm.user_id = auth.uid()
          )
        )
    )
  );

-- =============================================================================
-- 4) invitations: any authenticated user could read EVERY invitation row
-- =============================================================================
-- The policy was `for select to authenticated using (true)`, so
-- GET /rest/v1/invitations?select=* returned every code of every group. Since
-- the code is the access token, an attacker could enumerate all codes and join
-- any group as any role. The public landing page validates a code through the
-- SECURITY DEFINER get_invitation_by_code() RPC, and employers read their own
-- group's invitations through the existing "employers manage invitations of
-- their group" (FOR ALL) policy -- so this blanket-read policy is pure exposure.
drop policy if exists "authenticated can read invitation by code" on invitations;

-- =============================================================================
-- NOT in this migration (deferred on purpose):
--   - hourly_rate / clock_in_lat / clock_in_lng still visible to all group
--     members via the employee_profiles + time_entries SELECT policies. Fixing
--     this safely needs a refactor: the group-detail page's "trabajando"
--     indicator reads coworkers' profiles + open shifts for BOTH roles, so a
--     naive tightening would break the live member list. Handle with a
--     SECURITY DEFINER read RPC that returns only safe columns.
--   - payments period-overlap constraint, timezone in calculate_pay_draft,
--     on-delete FK matrix, NaN/amount checks -> Tier 1, separate migration.
-- =============================================================================
