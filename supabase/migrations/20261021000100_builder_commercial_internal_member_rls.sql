-- Prevent client-role workspace members from reading or mutating internal commercial records
-- through direct Supabase/PostgREST requests. Portal reads remain available through the
-- authenticated Client Portal APIs, which project only published client-safe fields.
begin;

create or replace function public.builder_commercial_is_internal_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and coalesce(wm.status, 'active') = 'active'
      and wm.role in (
        'owner', 'admin', 'builder', 'builder_admin', 'builder_staff',
        'estimator', 'interior_designer', 'sales'
      )
  );
$$;

revoke all on function public.builder_commercial_is_internal_member(uuid) from public;
grant execute on function public.builder_commercial_is_internal_member(uuid) to authenticated;

do $$
declare
  table_name text;
  internal_tables text[] := array[
    'builder_commercial_projects',
    'builder_estimate_snapshots',
    'builder_boq_sections',
    'builder_boq_items',
    'builder_suppliers',
    'builder_supplier_price_books',
    'builder_supplier_price_items',
    'builder_products',
    'builder_product_configurations',
    'builder_product_suppliers',
    'builder_product_manufacturers',
    'builder_product_price_options',
    'builder_procurement_items',
    'builder_purchase_orders',
    'builder_purchase_order_items',
    'builder_variations',
    'builder_variation_items',
    'builder_budget_actuals',
    'builder_client_selections',
    'builder_quote_approvals',
    'builder_quote_proposals',
    'builder_project_documents',
    'builder_rfis',
    'builder_supplier_invoices',
    'builder_supplier_invoice_items',
    'builder_selection_sessions',
    'builder_selection_books',
    'builder_selection_configurations',
    'builder_selection_aliases',
    'builder_selection_quote_mappings',
    'builder_requirement_quote_mappings',
    'builder_inclusion_schedules',
    'builder_inclusion_schedule_items',
    'builder_inclusion_templates',
    'builder_inclusion_template_sections',
    'builder_inclusion_template_items',
    'builder_standard_specifications',
    'builder_standard_specification_items',
    'builder_trade_contracts',
    'builder_trade_contract_milestones',
    'builder_trade_contract_claims',
    'builder_trade_contract_invoices',
    'builder_trade_contract_audit',
    'client_portal_settings',
    'client_portal_clients',
    'client_portal_invitations',
    'client_portal_messages',
    'client_portal_approvals',
    'client_portal_audit_events'
  ];
begin
  foreach table_name in array internal_tables loop
    if to_regclass('public.' || table_name) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists internal_workspace_members_only on public.%I', table_name);
    execute format(
      'create policy internal_workspace_members_only on public.%I as restrictive for all to authenticated using (public.builder_commercial_is_internal_member(workspace_id)) with check (public.builder_commercial_is_internal_member(workspace_id))',
      table_name
    );
  end loop;
end $$;

commit;