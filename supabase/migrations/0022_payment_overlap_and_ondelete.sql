-- 0022_payment_overlap_and_ondelete.sql
--
-- Two Tier-1 data-integrity fixes from the 2026-06-09 audit:
--
-- A) Anti-double-pay: there was NO constraint stopping two payments for the
--    same employee covering overlapping periods. A double-click on "confirmar
--    pago" (or a flaky-network retry) created two payments for the same hours.
--    Verified pre-flight: 0 overlapping payment rows exist today, so the
--    EXCLUDE constraint applies cleanly.
--
-- B) on-delete matrix: four person-attribution FKs were ON DELETE RESTRICT,
--    which blocks deleting a user (had to delete one by hand because of
--    invitations.created_by). Switch them to SET NULL so a user can be removed
--    without losing the financial/audit rows they touched — the row stays, the
--    "who" becomes null. Columns are made nullable for this.
--
-- Safe to apply live: brief locks on small tables, no data loss. All app INSERTs
-- still provide these columns, so new rows keep their attribution; only a future
-- user deletion nulls them.

begin;

-- ---- A) anti-double-pay -----------------------------------------------------
-- btree_gist lets us combine `uuid WITH =` and `range WITH &&` in one GiST
-- exclusion constraint.
create extension if not exists btree_gist;

alter table payments
  add constraint payments_no_overlap
  exclude using gist (
    employee_profile_id with =,
    tstzrange(period_start, period_end) with &&
  );

-- ---- B) on-delete: person FKs RESTRICT -> SET NULL --------------------------
-- groups.created_by
alter table groups alter column created_by drop not null;
alter table groups drop constraint groups_created_by_fkey;
alter table groups
  add constraint groups_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

-- payments.created_by  (keep the payment record = accounting; lose creator id)
alter table payments alter column created_by drop not null;
alter table payments drop constraint payments_created_by_fkey;
alter table payments
  add constraint payments_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

-- invitations.created_by
alter table invitations alter column created_by drop not null;
alter table invitations drop constraint invitations_created_by_fkey;
alter table invitations
  add constraint invitations_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

-- shift_edits.edited_by  (keep the audit row; lose editor id)
alter table shift_edits alter column edited_by drop not null;
alter table shift_edits drop constraint shift_edits_edited_by_fkey;
alter table shift_edits
  add constraint shift_edits_edited_by_fkey
  foreign key (edited_by) references auth.users (id) on delete set null;

commit;

-- NOT in this migration (still pending from the audit):
--   - one_shot fixed amounts: double-charge under concurrent create_payment,
--     and not reactivated when a payment is deleted (needs a snapshot table +
--     a delete_payment RPC).
--   - "shift verified AFTER its period was paid never gets paid": needs a
--     warning of unverified/late shifts in the draft.
--   - deletePaymentAction: no affected-rows check (silent no-op under RLS).
