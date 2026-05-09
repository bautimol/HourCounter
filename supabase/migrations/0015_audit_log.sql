-- ============================================================================
-- HourCounter — Shift edit audit log
-- ============================================================================
-- Every edit to a time_entry (employee self-edit, employer edit, verify,
-- unverify, bulk-verify) writes one row per changed field into shift_edits.
-- Visible to anyone who can read the shift itself (group members), so
-- there's a paper trail when employer and employee disagree:
--
--   "El sistema dice 17:30 pero el empleado dice 18:00"
--   → audit log shows when and who edited it.
--
-- Inserts only happen via SECURITY DEFINER helpers; no INSERT policy is
-- defined so direct writes are blocked.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Table + RLS
-- ----------------------------------------------------------------------------

create table shift_edits (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references time_entries (id) on delete cascade,
  edited_by uuid not null references auth.users (id) on delete restrict,
  edited_at timestamptz not null default now(),
  field text not null check (
    field in ('clock_out', 'notes', 'status', 'verified')
  ),
  before_value text,
  after_value text
);

create index shift_edits_shift_idx on shift_edits (shift_id, edited_at desc);
create index shift_edits_editor_idx on shift_edits (edited_by);

alter table shift_edits enable row level security;

create policy "members read shift_edits of their group"
  on shift_edits for select
  using (
    exists (
      select 1 from time_entries te
      where te.id = shift_edits.shift_id
        and is_group_member(group_id_for_employee_profile(te.employee_profile_id))
    )
  );

-- ----------------------------------------------------------------------------
-- 2) record_shift_edit — internal helper used by every edit RPC
-- ----------------------------------------------------------------------------
-- Inserts ONE row per actually-changed field. NULL-vs-NULL is a no-op.
-- We use is distinct from to handle NULLs symmetrically.

create or replace function record_shift_edit(
  p_shift_id uuid,
  p_field text,
  p_before text,
  p_after text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_before is distinct from p_after then
    insert into shift_edits (shift_id, edited_by, field, before_value, after_value)
    values (p_shift_id, auth.uid(), p_field, p_before, p_after);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) update_my_time_entry — recreated, now records edits
-- ----------------------------------------------------------------------------

create or replace function update_my_time_entry(
  entry_id uuid,
  new_clock_out timestamptz,
  new_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  entry time_entries;
  trimmed text := nullif(trim(coalesce(new_notes, '')), '');
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  select * into entry from time_entries where id = entry_id;
  if entry is null then
    raise exception 'time entry not found';
  end if;

  if not exists (
    select 1
      from employee_profiles ep
      join group_members gm on gm.id = ep.group_member_id
     where ep.id = entry.employee_profile_id
       and gm.user_id = caller
  ) then
    raise exception 'cannot edit this time entry';
  end if;

  if entry.verified_at is not null then
    raise exception 'time entry already verified';
  end if;

  if new_clock_out is null or new_clock_out <= entry.clock_in then
    raise exception 'invalid clock out time';
  end if;

  update time_entries
     set clock_out = new_clock_out,
         status = 'closed',
         notes = trimmed
   where id = entry_id;

  perform record_shift_edit(
    entry_id, 'clock_out',
    entry.clock_out::text,
    new_clock_out::text
  );
  perform record_shift_edit(
    entry_id, 'notes', entry.notes, trimmed
  );
  perform record_shift_edit(
    entry_id, 'status', entry.status::text, 'closed'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) employer_update_shift — recreated, now records edits + verify
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
  before_row time_entries;
  trimmed_notes text := nullif(trim(coalesce(new_notes, '')), '');
  was_verified boolean;
  will_verify boolean;
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

  if new_status <> 'open' and new_clock_out is null then
    raise exception 'closed/needs_review shift must have a clock_out';
  end if;

  select * into before_row from time_entries where id = target_shift_id;

  if new_clock_out is not null and new_clock_out <= before_row.clock_in then
    raise exception 'clock_out must be after clock_in';
  end if;

  was_verified := before_row.verified_at is not null;
  will_verify := also_verify and new_status <> 'open';

  update time_entries
     set clock_out = new_clock_out,
         notes = trimmed_notes,
         status = new_status,
         verified_by = case when will_verify then caller else verified_by end,
         verified_at = case when will_verify then now() else verified_at end
   where id = target_shift_id;

  perform record_shift_edit(
    target_shift_id, 'clock_out',
    before_row.clock_out::text,
    new_clock_out::text
  );
  perform record_shift_edit(
    target_shift_id, 'notes', before_row.notes, trimmed_notes
  );
  perform record_shift_edit(
    target_shift_id, 'status',
    before_row.status::text, new_status::text
  );

  -- Record verify transition (NULL → present, present → present-still, etc.)
  if will_verify and not was_verified then
    perform record_shift_edit(
      target_shift_id, 'verified', null, 'verified'
    );
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) verify_shift — recreated, records verify transition
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
  before_row time_entries;
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

  select * into before_row from time_entries where id = target_shift_id;

  if before_row.status = 'open' then
    raise exception 'cannot verify an open shift';
  end if;

  update time_entries
     set verified_by = caller,
         verified_at = now(),
         status = case when status = 'needs_review' then 'closed'
                       else status end
   where id = target_shift_id;

  if before_row.verified_at is null then
    perform record_shift_edit(
      target_shift_id, 'verified', null, 'verified'
    );
  end if;

  if before_row.status = 'needs_review' then
    perform record_shift_edit(
      target_shift_id, 'status', 'needs_review', 'closed'
    );
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) unverify_shift — recreated, records unverify
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
  before_row time_entries;
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

  select * into before_row from time_entries where id = target_shift_id;

  update time_entries
     set verified_by = null,
         verified_at = null
   where id = target_shift_id;

  if before_row.verified_at is not null then
    perform record_shift_edit(
      target_shift_id, 'verified', 'verified', null
    );
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) verify_shifts_bulk — recreated, records verify per row
-- ----------------------------------------------------------------------------

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
    select te.id, te.status as before_status, te.verified_at as before_verified_at
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
     returning id
  ),
  -- Audit row per newly verified shift
  audit_verified as (
    insert into shift_edits (shift_id, edited_by, field, before_value, after_value)
    select a.id, caller, 'verified', null, 'verified'
      from allowed a
     where a.before_verified_at is null
       and a.id in (select id from upd)
    returning 1
  ),
  -- Audit row per shift whose status changed from needs_review → closed
  audit_status as (
    insert into shift_edits (shift_id, edited_by, field, before_value, after_value)
    select a.id, caller, 'status', 'needs_review', 'closed'
      from allowed a
     where a.before_status = 'needs_review'
       and a.id in (select id from upd)
    returning 1
  )
  select count(*) into affected from upd;

  return coalesce(affected, 0);
end;
$$;
