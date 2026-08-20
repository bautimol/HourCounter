-- ============================================================================
-- 0029_auto_close_ceiling.sql — a per-group ceiling for open shifts
-- ============================================================================
-- Decision 11 says time tracking is lazy-close: auto_close_expired_shifts()
-- closes an open shift once it passes its `expected_minutes`, and runs at the
-- top of any read that cares about shift state. What the decision does not say
-- is that `expected_minutes` is OPTIONAL and almost nobody fills it in — 4 of
-- 44 shifts in production have it (the field is left blank in
-- src/app/app/groups/[id]/clock/actions.ts:28-51). For the other 91% the net is
-- not loose: it does not exist, because the WHERE requires
-- `expected_minutes is not null`.
--
-- The damage is not the long row, it is the block. one_open_shift_per_profile
-- (0009) is a partial unique index on (employee_profile_id) where status='open',
-- so an open shift stops THAT SAME PERSON from clocking in again. One shift ran
-- 13/08 10:39 → 18/08 11:28 (120.8 h) before anyone noticed, and the ~2.4 h she
-- did work in between were never recorded, because the app kept refusing her.
--
-- So the ceiling stops being the employee's optional declaration and becomes the
-- group's policy: past N hours an open shift is not a shift, it is an oversight.
-- The employer sets N per group.
--
-- Say the uncomfortable half out loud, because it is the easy one to miss:
-- TODAY a forgotten shift pays ZERO (it has no clock_out, and calculate_pay_draft
-- filters clock_out is not null). With a ceiling it pays N hours nobody worked,
-- if approved without reading. The ceiling MOVES the cost of the oversight from
-- the employee to the employer, and its value measures the move. That is why a
-- ceiling-closed shift lands in needs_review with auto_closed_at set, and not in
-- closed: nobody declared that duration, so nobody should be able to approve it
-- by reflex from the Pendientes list.

begin;

-- ----------------------------------------------------------------------------
-- 1) The ceiling lives on the group
-- ----------------------------------------------------------------------------
-- In minutes, to speak the same language as time_entries.expected_minutes so
-- least() converts nothing. The UI shows hours. The name follows the repo's
-- unit-suffix convention (geofence_radius_m, 0014).
--
-- NULL = no ceiling, which is exactly the pre-0029 behaviour. NULL and not 0 as
-- the "disabled" sentinel, for a concrete reason: least() ignores NULLs but does
-- NOT ignore zeros. With 0, least(expected_minutes, 0) = 0 for every open shift,
-- the cutoff becomes clock_in + 00:00:00, and the UPDATE writes
-- clock_out = clock_in — which violates the clock_out > clock_in check and, since
-- the sweep is global and runs on ordinary reads, takes down /app for EVERY user
-- because ONE group opted itself out.
--
-- `default 720` fills the existing groups on the first run (since PG11 a default
-- in ADD COLUMN applies to old rows without rewriting the table) and every new
-- group too, so create_group_with_owner (0002) needs no change. `if not exists`
-- makes a second paste a total no-op — which matters, because an employer who
-- deliberately set NULL must not get 720 back because someone was unsure whether
-- the file had already run. That is also why there is no backfill UPDATE here: a
-- backfill cannot tell "never set" from "set to no ceiling".

alter table groups
  add column if not exists auto_close_after_minutes integer default 720;

-- The RPC below is the convenient path, NOT the rail. `groups` has an UPDATE
-- policy for employers with no column restriction, and employer and employee
-- share the one `authenticated` Postgres role, so per-column GRANTs are not an
-- option (0028 explains why). Any employer with the anon key can PATCH this
-- column through PostgREST and skip the function's checks. What actually holds
-- is the CHECK on the table — the same reason 0014 put groups_geofence_complete
-- on the table rather than inside update_group_geofence.
--
-- Floor 240 (4 h): below that the ceiling stops being a net and becomes a silent,
-- unaudited way to trim whole shifts. An employer who wants to shorten one shift
-- already has employer_update_shift, which writes an audit row (0015).
-- Cap 1440 (24 h): past a day the net catches nothing, because the block on the
-- next clock-in bites the following day anyway. "Off" is NULL, not 168 h.

alter table groups
  drop constraint if exists groups_auto_close_range;

alter table groups
  add constraint groups_auto_close_range check (
    auto_close_after_minutes is null
    or auto_close_after_minutes between 240 and 1440
  );

comment on column groups.auto_close_after_minutes is
  'Ceiling for an open shift, in minutes. The sweep closes any open shift that reaches clock_in + this, leaves it in needs_review and stamps auto_closed_at, because nobody declared that duration. NULL = no ceiling (pre-0029 behaviour). 720 (12 h) is the default.';

-- ----------------------------------------------------------------------------
-- 2) The fabrication mark lives on the shift
-- ----------------------------------------------------------------------------
-- NULL = a person set the clock_out (the employee clocking out, or the employer
-- editing). Set = the system set it on reaching the group's ceiling.
--
-- Why a column rather than inferring it from status: verify_shift clears
-- needs_review on approval (0015), so status stops telling the truth exactly when
-- the argument shows up — three weeks later, on the comprobante. The column
-- survives approval. And why not infer it from clock_out - clock_in ==
-- expected_minutes: that breaks the moment the employer corrects the time or the
-- ceiling changes, which is precisely what we want to happen.
--
-- No shift_edits row is written for an automatic close, on purpose.
-- record_shift_edit inserts auth.uid() (0015) and the sweep runs inside whatever
-- request happens to trigger it — src/app/app/page.tsx:46 fires it under any
-- user's session — so it would record that employee A closed employee B's shift,
-- which post-0028 A cannot even read. A false attribution in a log whose only job
-- is attribution is worse than no row at all.

alter table time_entries
  add column if not exists auto_closed_at timestamptz;

comment on column time_entries.auto_closed_at is
  'When the system closed this shift on reaching the group ceiling. NULL = a person set the clock_out. Survives approval, which is when it is needed.';

-- And a hole least() closes by accident and is worth closing on purpose:
-- expected_minutes only had `> 0` in the database. The 24 h cap lives solely in
-- the server action (clock/actions.ts:47-49) and clock_in is anon-callable, so a
-- direct RPC call with a huge expected_minutes overflows the timestamp range in
-- `clock_in + interval` — and since the sweep is global, that error surfaces in
-- ordinary reads for everyone. The real maximum today is 1320, so this CHECK
-- rejects no existing row.

alter table time_entries
  drop constraint if exists time_entries_expected_minutes_check;

alter table time_entries
  add constraint time_entries_expected_minutes_check check (
    expected_minutes is null
    or (expected_minutes > 0 and expected_minutes <= 1440)
  );

-- ----------------------------------------------------------------------------
-- 3) auto_close_expired_shifts — now sweeps against the ceiling too
-- ----------------------------------------------------------------------------
-- Cutoff = clock_in + least(declared minutes, group ceiling). least() ignores
-- NULLs, so:
--
--   declared + ceiling → whichever comes first
--   declared only      → the declared one   (exactly the previous behaviour)
--   ceiling only       → the ceiling        (the 91% this exists for)
--   neither            → NULL → make_interval is STRICT → clock_in + NULL is
--                        NULL → `NULL <= now()` is NULL → the row is untouched.
--                        A group with no ceiling behaves exactly as before.
--
-- `least(...) > 0` in the WHERE is belt and braces: if anyone ever proposes 0 as
-- the "no ceiling" sentinel again, this turns it into a no-op instead of a
-- clock_out = clock_in that violates the CHECK and knocks over a page read.
--
-- Status and mark are separated by ONE question: who decided the cut? If the
-- ceiling exists and is smaller than what was declared (or nothing was declared),
-- the group decided → needs_review + auto_closed_at. A tie counts as declared:
-- she said that number.
--
-- Still ONE statement. The joins are inner and every FK in the chain is NOT NULL
-- (0001), so the join cannot lose a row the old version swept, nor duplicate one.
-- group_members.status is deliberately NOT filtered: an archived member's
-- forgotten shift has to close too, and it did before.

create or replace function auto_close_expired_shifts()
returns void
language sql
security definer
set search_path = public
as $$
  update time_entries te
     set clock_out = te.clock_in
                   + make_interval(mins => least(te.expected_minutes,
                                                 g.auto_close_after_minutes)),
         status = case
                    when g.auto_close_after_minutes is not null
                     and (te.expected_minutes is null
                          or g.auto_close_after_minutes < te.expected_minutes)
                    then 'needs_review'::time_entry_status
                    else 'closed'::time_entry_status
                  end,
         auto_closed_at = case
                    when g.auto_close_after_minutes is not null
                     and (te.expected_minutes is null
                          or g.auto_close_after_minutes < te.expected_minutes)
                    then now()
                    else null
                  end
    from employee_profiles ep
    join group_members gm on gm.id = ep.group_member_id
    join groups g on g.id = gm.group_id
   where te.employee_profile_id = ep.id
     and te.status = 'open'
     and least(te.expected_minutes, g.auto_close_after_minutes) > 0
     and te.clock_in
         + make_interval(mins => least(te.expected_minutes,
                                       g.auto_close_after_minutes)) <= now();
$$;

comment on function auto_close_expired_shifts() is
  'Lazy-close sweep (decision 11). Closes an open shift at clock_in + least(its declared expected_minutes, its group auto_close_after_minutes). Declared -> closed. Ceiling -> needs_review + auto_closed_at, because nobody declared that duration.';

-- ----------------------------------------------------------------------------
-- 4) update_group_auto_close — employers only
-- ----------------------------------------------------------------------------
-- Modelled on update_group_geofence (0014). Pass NULL for "no ceiling".
--
-- It does NOT call auto_close_expired_shifts() at the end. The sweep is global
-- and unscoped, so saving a setting on group A would write rows for every other
-- group inside the same transaction; and if that sweep raised, it would roll back
-- the setting change, so the employer would see the save fail because of other
-- people's rows. The next page read sweeps anyway, seconds later.

create or replace function update_group_auto_close(
  target_group_id uuid,
  new_minutes integer
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
    raise exception 'only employers can update the auto-close ceiling';
  end if;

  if new_minutes is not null and new_minutes not between 240 and 1440 then
    raise exception 'auto-close ceiling must be between 4 and 24 hours';
  end if;

  update groups
     set auto_close_after_minutes = new_minutes
   where id = target_group_id;
end;
$$;

-- Name all three roles. `revoke ... from public` alone does not strip anon or
-- authenticated — Supabase grants them EXECUTE explicitly. That is the lesson
-- 0024 had to learn twice with record_shift_edit and that 0028 wrote down.
-- Verified against this database: update_group_geofence, the function this one is
-- modelled on, still has anon in its ACL. Not exploitable (it raises
-- 'not authenticated' first), but copying 0014 without copying 0028's idiom is
-- exactly how it happens again. This RPC turns a knob that shortens recorded
-- shifts across a whole group; it has no business being reachable with the anon key.

revoke all on function public.update_group_auto_close(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.update_group_auto_close(uuid, integer)
  to authenticated;

commit;
