-- Publish only complete snapshots. Run after the Quotation V1 tenant migrations.
begin;
create or replace function public.builder_promote_quotation_snapshot(
  p_workspace_id uuid, p_project_id uuid, p_snapshot_id uuid,
  p_sections integer, p_items integer, p_procurement integer
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  candidate public.builder_estimate_snapshots%rowtype;
begin
  -- Serialize promotion per project, including requests that finish out of order.
  perform 1 from public.builder_commercial_projects
    where id = p_project_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'Commercial project not found'; end if;
  select * into candidate from public.builder_estimate_snapshots
    where id = p_snapshot_id and project_id = p_project_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'Quotation snapshot not found'; end if;
  if candidate.status not in ('draft', 'current') then return false; end if;
  if p_sections is null or p_items is null or p_procurement is null
    or least(p_sections, p_items, p_procurement) < 0 then
    raise exception 'Expected snapshot counts are required';
  end if;
  if (select count(*) from public.builder_boq_sections where workspace_id = p_workspace_id and project_id = p_project_id and snapshot_id = p_snapshot_id) <> p_sections
    or (select count(*) from public.builder_boq_items where workspace_id = p_workspace_id and project_id = p_project_id and snapshot_id = p_snapshot_id) <> p_items
    or (select count(*) from public.builder_procurement_items where workspace_id = p_workspace_id and project_id = p_project_id and snapshot_id = p_snapshot_id) <> p_procurement then
    raise exception 'Quotation snapshot is incomplete';
  end if;
  if exists (select 1 from public.builder_estimate_snapshots
    where workspace_id = p_workspace_id and project_id = p_project_id
      and status = 'current' and snapshot_number > candidate.snapshot_number) then
    update public.builder_estimate_snapshots set status = 'superseded' where id = candidate.id;
    return false;
  end if;
  update public.builder_estimate_snapshots set status = 'superseded'
    where workspace_id = p_workspace_id and project_id = p_project_id
      and status = 'current' and id <> candidate.id;
  update public.builder_estimate_snapshots set status = 'current' where id = candidate.id;
  update public.builder_commercial_projects
    set original_estimate_total = candidate.final_quote_total, contract_total = candidate.final_quote_total
    where id = p_project_id and workspace_id = p_workspace_id;
  return true;
end;
$$;
-- Only the authenticated, workspace-authorized server route may promote snapshots.
revoke all on function public.builder_promote_quotation_snapshot(uuid, uuid, uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.builder_promote_quotation_snapshot(uuid, uuid, uuid, integer, integer, integer) to service_role;
commit;
