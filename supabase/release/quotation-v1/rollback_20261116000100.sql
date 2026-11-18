-- Rollback for 20261116000100 (forward fixes). Normally NOT needed: the migration only removes a
-- constraint that wrongly rejected a second product in the same room and revokes anon from a helper.
-- Restoring the old behaviour would re-introduce those defects. Kept for completeness only.
begin;
revoke all on function public.builder_commercial_is_internal_member(uuid) from public;  -- anon left revoked (security)
-- The per-room unique rule is intentionally not re-created (it blocked valid data).
commit;
