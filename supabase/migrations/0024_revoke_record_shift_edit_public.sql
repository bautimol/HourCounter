-- 0024_revoke_record_shift_edit_public.sql
--
-- Fixes an incomplete revoke from 0023. The Supabase security advisor caught it.
--
-- 0023 ran `revoke execute on function record_shift_edit(...) from authenticated,
-- anon` to stop direct audit-log forgery. But Postgres grants EXECUTE to PUBLIC
-- by default, and PUBLIC applies to every role — so anon/authenticated could
-- STILL call it through the PUBLIC grant (the explicit per-role revoke doesn't
-- touch PUBLIC). record_shift_edit is only ever invoked via PERFORM inside other
-- SECURITY DEFINER functions, which run as the owner and keep working.
--
-- Also pins haversine_meters' search_path (advisor: function_search_path_mutable;
-- low risk since it's not SECURITY DEFINER, but trivial to fix).

revoke execute on function public.record_shift_edit(uuid, text, text, text)
  from public, anon, authenticated;

alter function public.haversine_meters(numeric, numeric, numeric, numeric)
  set search_path = pg_catalog;

-- Advisor items NOT handled here (low / dashboard):
--   - extension_in_public (btree_gist in public): cosmetic best-practice.
--   - public_bucket_allows_listing (avatars): storage policy, dashboard.
--   - auth_leaked_password_protection disabled: Auth setting, dashboard.
--   - the ~29 "SECURITY DEFINER function executable by anon/authenticated"
--     warnings are mostly noise: those functions validate auth.uid()+role
--     internally, and the helpers (is_group_member etc.) MUST stay executable
--     by authenticated because the RLS policies call them.
