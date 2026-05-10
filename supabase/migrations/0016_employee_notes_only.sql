-- ============================================================================
-- HourCounter — Restrict employee self-edit to notes only
-- ============================================================================
-- The previous update_my_time_entry let the employee change the clock_out
-- of an unverified shift. That's a trust hole: an employee could inflate
-- their hours by bumping clock_out forward, knowing the employer probably
-- won't audit every shift.
--
-- New rule:
--   * The employee can ONLY edit `notes` on their own shifts (still
--     restricted to unverified ones).
--   * If the system-recorded clock_out is wrong (e.g. they forgot to
--     close and the auto-close fired), they leave a note explaining,
--     and the employer adjusts the clock_out at verification time.
--
-- The signature changes: the function now takes (entry_id, new_notes)
-- only. Calling with the old 3-arg shape will fail loudly (good — surfaces
-- any caller that hasn't been updated).
-- ============================================================================

drop function if exists update_my_time_entry(uuid, timestamptz, text);

create or replace function update_my_time_entry(
  entry_id uuid,
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

  -- Only update notes; do NOT touch clock_out.
  update time_entries
     set notes = trimmed
   where id = entry_id;

  perform record_shift_edit(
    entry_id, 'notes', entry.notes, trimmed
  );
end;
$$;
