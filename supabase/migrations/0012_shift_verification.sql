-- ============================================================================
-- HourCounter — Shift verification (employer side)
-- ============================================================================
-- Lets an employer of a group review the closed shifts of their employees:
--   - approve a shift (sets verified_by + verified_at = now)
--   - undo an approval
--   - edit any field of a shift (clock_out, notes, status), optionally
--     approving in the same call
--   - bulk-approve a list of shift ids
--
-- All four functions are SECURITY DEFINER and validate that the caller is
-- an active employer of the group that owns the shift. They bypass per-table
-- RLS for the cross-table joins, but the auth check is internal.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- helper: returns the group_id of a shift (NULL if not found)
-- ----------------------------------------------------------------------------

create or replace function group_id_for_shift(target_shift_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select gm.group_id
    from time_entries te
    join employee_profiles ep on ep.id = te.employee_profile_id
    join group_members gm on gm.id = ep.group_member_id
   where te.id = target_shift_id;
$$;

-- ----------------------------------------------------------------------------
-- verify_shift — single-row approve
-- ----------------------------------------------------------------------------

create or replace function verify_shift(target_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  shift_group uuid;
  shift_status time_entry_status;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  shift_group := group_id_for_shift(target_shift_id);
  if shift_group is null then
    raise exception 'shift not found';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = shift_group
      and user_id = caller
      and role = 'employer'
      and status = 'active'
  ) then
    raise exception 'only employers can verify shifts';
  end if;

  select status into shift_status from time_entries where id = target_shift_id;
  if shift_status = 'open' then
    raise exception 'cannot verify an open shift';
  end if;

  update time_entries
     set verified_by = caller,
         verified_at = now(),
         -- if the shift was flagged for review, approving clears that flag
         status = case when status = 'needs_review' then 'closed'
                       else status end
   where id = target_shift_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- unverify_shift — undo an approval (in case of mistake)
-- ----------------------------------------------------------------------------

create or replace function unverify_shift(target_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  shift_group uuid;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  shift_group := group_id_for_shift(target_shift_id);
  if shift_group is null then
    raise exception 'shift not found';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = shift_group
      and user_id = caller
      and role = 'employer'
      and status = 'active'
  ) then
    raise exception 'only employers can unverify shifts';
  end if;

  update time_entries
     set verified_by = null,
         verified_at = null
   where id = target_shift_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- employer_update_shift — edit clock_out/notes/status, optionally verify
-- ----------------------------------------------------------------------------

create or replace function employer_update_shift(
  target_shift_id uuid,
  new_clock_out timestamptz,
  new_notes text,
  new_status time_entry_status,
  also_verify boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  shift_group uuid;
  shift_clock_in timestamptz;
  trimmed_notes text := nullif(trim(coalesce(new_notes, '')), '');
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  shift_group := group_id_for_shift(target_shift_id);
  if shift_group is null then
    raise exception 'shift not found';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = shift_group
      and user_id = caller
      and role = 'employer'
      and status = 'active'
  ) then
    raise exception 'only employers can edit shifts';
  end if;

  -- We require a non-null clock_out for non-open statuses. If someone wants
  -- to keep a shift "open" but edit it, they'd need a different RPC; for
  -- now this is the verification flow only.
  if new_status <> 'open' and new_clock_out is null then
    raise exception 'closed/needs_review shift must have a clock_out';
  end if;

  if new_clock_out is not null then
    select clock_in into shift_clock_in
      from time_entries where id = target_shift_id;
    if new_clock_out <= shift_clock_in then
      raise exception 'clock_out must be after clock_in';
    end if;
  end if;

  update time_entries
     set clock_out = new_clock_out,
         notes = trimmed_notes,
         status = new_status,
         verified_by = case when also_verify and new_status <> 'open'
                            then caller else verified_by end,
         verified_at = case when also_verify and new_status <> 'open'
                            then now() else verified_at end
   where id = target_shift_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- verify_shifts_bulk — approve many shifts at once
-- ----------------------------------------------------------------------------
-- Returns the number of shifts actually verified. Skips silently any shift
-- that the caller is not authorized to verify (different group, not
-- employer, or the shift is open).

create or replace function verify_shifts_bulk(shift_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  affected integer;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  with allowed as (
    select te.id
      from time_entries te
      join employee_profiles ep on ep.id = te.employee_profile_id
      join group_members gm_target on gm_target.id = ep.group_member_id
      join group_members gm_caller on gm_caller.group_id = gm_target.group_id
                                   and gm_caller.user_id = caller
                                   and gm_caller.role = 'employer'
                                   and gm_caller.status = 'active'
     where te.id = any (shift_ids)
       and te.status <> 'open'
  ),
  upd as (
    update time_entries
       set verified_by = caller,
           verified_at = now(),
           status = case when status = 'needs_review' then 'closed'
                         else status end
     where id in (select id from allowed)
     returning 1
  )
  select count(*) into affected from upd;

  return coalesce(affected, 0);
end;
$$;
