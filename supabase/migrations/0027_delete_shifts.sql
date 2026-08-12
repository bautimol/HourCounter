-- ============================================================================
-- HourCounter — Deleting shifts
-- ============================================================================
-- 0026 deliberately refused to delete anything the employee had clocked: a
-- real shift gets corrected, never destroyed. In a month of real use that
-- turned out to be too strict in one direction. A shift opened by mistake
-- (a stray tap, a clock-in the employee never meant) closes itself and then
-- sits in Pendientes forever, because the only two things an employer can do
-- to it are approve it — which pays for work nobody did — or edit it, which
-- leaves the junk row there anyway. They pile up and hide the shifts that
-- actually need review.
--
-- So deletion is now allowed for clocked shifts too, with one hard rail:
--
--   A shift that falls inside a recorded payment period CANNOT be deleted.
--
-- That is the line that matters. Payments store hours and totals as they were
-- calculated, and the printed comprobante is handed to the employee; letting
-- the underlying shifts vanish would leave a receipt that can never be
-- reconciled against the data again. Everything the employer might genuinely
-- want to clean up is, by definition, not paid yet.
--
-- The audit trail is kept rather than dropped. shift_edits.shift_id used to
-- cascade, so deleting a shift also erased every trace that it had existed —
-- exactly backwards for the one action that most deserves a record. It now
-- nulls out instead, and the delete writes a 'deleted' row holding a readable
-- snapshot of what was removed. Nothing renders those orphans today (the
-- shift detail page queries by shift_id, which is gone); they exist so a
-- dispute has an answer.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Let audit rows outlive the shift they describe
-- ----------------------------------------------------------------------------

alter table shift_edits
  alter column shift_id drop not null;

alter table shift_edits
  drop constraint shift_edits_shift_id_fkey;

alter table shift_edits
  add constraint shift_edits_shift_id_fkey
    foreign key (shift_id) references time_entries (id) on delete set null;

comment on column shift_edits.shift_id is
  'NULL once the shift was deleted — the audit row survives on purpose. See the ''deleted'' field for a snapshot of what was removed.';

-- ----------------------------------------------------------------------------
-- 2) employer_delete_entry — now covers clocked shifts, blocks paid ones
-- ----------------------------------------------------------------------------
-- Kept under the same name because the manual-days screen already calls it;
-- that screen only ever lists manual days, so widening what the function
-- accepts does not widen what that screen can reach.

create or replace function employer_delete_entry(target_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  entry_group uuid;
  entry record;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  entry_group := group_id_for_shift(target_entry_id);
  if entry_group is null then
    raise exception 'entry not found';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = entry_group
      and user_id = caller
      and role = 'employer'
      and status = 'active'
  ) then
    raise exception 'only employers can delete shifts';
  end if;

  select id, employee_profile_id, clock_in, clock_out, concept, created_by
    into entry
    from time_entries
   where id = target_entry_id;

  -- The one hard rail: never remove a shift the employee has been paid for.
  if exists (
    select 1
      from payments p
     where p.employee_profile_id = entry.employee_profile_id
       and entry.clock_in >= p.period_start
       and entry.clock_in <= p.period_end
  ) then
    raise exception 'SHIFT_ALREADY_PAID';
  end if;

  -- Snapshot first: the FK nulls out on delete, so this row is all that is
  -- left afterwards.
  insert into shift_edits (shift_id, edited_by, field, before_value, after_value)
  values (
    target_entry_id,
    caller,
    'deleted',
    format(
      '%s %s → %s (%s)',
      coalesce(entry.concept, 'worked'),
      to_char(entry.clock_in at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
      coalesce(
        to_char(entry.clock_out at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'),
        'sin cierre'
      ),
      case when entry.created_by is null then 'fichado' else 'cargado a mano' end
    ),
    null
  );

  delete from time_entries where id = target_entry_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) Bulk variant, for clearing several junk rows at once
-- ----------------------------------------------------------------------------
-- Mirrors verify_shifts_bulk: silently skips anything the caller may not
-- touch rather than failing the whole batch, and returns how many went. The
-- paid-shift rail is expressed as a NOT EXISTS in `allowed`, so a selection
-- that mixes paid and unpaid deletes the unpaid ones and reports the count —
-- the caller compares it against what it asked for.

create or replace function employer_delete_entries(shift_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  allowed_ids uuid[];
  affected integer;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  -- Resolve the deletable subset once. Anything the caller does not employ,
  -- or that a payment already covers, simply is not in here.
  select array_agg(te.id) into allowed_ids
    from time_entries te
    join employee_profiles ep on ep.id = te.employee_profile_id
    join group_members gm_target on gm_target.id = ep.group_member_id
    join group_members gm_caller on gm_caller.group_id = gm_target.group_id
                                 and gm_caller.user_id = caller
                                 and gm_caller.role = 'employer'
                                 and gm_caller.status = 'active'
   where te.id = any (shift_ids)
     and not exists (
       select 1
         from payments p
        where p.employee_profile_id = te.employee_profile_id
          and te.clock_in >= p.period_start
          and te.clock_in <= p.period_end
     );

  if allowed_ids is null then
    return 0;
  end if;

  -- Audit BEFORE deleting, as two statements rather than data-modifying CTEs:
  -- within one statement Postgres does not order them, so the insert could run
  -- after the delete and fail the foreign key.
  insert into shift_edits (shift_id, edited_by, field, before_value, after_value)
  select
    te.id,
    caller,
    'deleted',
    format(
      '%s %s → %s (%s)',
      coalesce(te.concept, 'worked'),
      to_char(te.clock_in at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
      coalesce(
        to_char(te.clock_out at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'),
        'sin cierre'
      ),
      case when te.created_by is null then 'fichado' else 'cargado a mano' end
    ),
    null
    from time_entries te
   where te.id = any (allowed_ids);

  delete from time_entries where id = any (allowed_ids);
  get diagnostics affected = row_count;

  return coalesce(affected, 0);
end;
$$;

revoke all on function employer_delete_entries(uuid[]) from public;
grant execute on function employer_delete_entries(uuid[]) to authenticated;
