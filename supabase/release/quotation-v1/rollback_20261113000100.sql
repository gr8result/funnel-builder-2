-- First roll back the API code to the previous release in a maintenance window.
-- Does not change or delete any existing quotation, draft or commercial record.
begin;
drop function if exists public.builder_promote_quotation_snapshot(uuid, uuid, uuid, integer, integer, integer);
commit;
