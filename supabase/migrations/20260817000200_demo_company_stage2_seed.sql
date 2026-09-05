-- Demo Company Stage 2 permanent dataset.
-- Adds a hard-scoped reset/reseed function for the canonical demo workspace.

create extension if not exists pgcrypto;

create or replace function public.reset_demo_company_stage2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  demo_workspace constant uuid := '00000000-0000-4000-8000-000000000001';
  seed_user_id uuid;
  lead_record jsonb;
  lead_id uuid;
  project_record jsonb;
  project_id uuid;
  snapshot_id uuid;
  section_id uuid;
  supplier_foundations uuid;
  supplier_frame uuid;
  supplier_roofing uuid;
  supplier_finishes uuid;
  selection_session_id uuid;
  selection_id uuid;
  variation_id uuid;
  purchase_order_id uuid;
  procurement_id uuid;
  project_index integer := 0;
begin
  if not exists (
    select 1
    from public.workspaces
    where id = demo_workspace
      and is_demo = true
  ) then
    raise exception 'Demo workspace is missing or is not marked as demo';
  end if;

  select wm.user_id
    into seed_user_id
  from public.workspace_members wm
  where wm.workspace_id = demo_workspace
    and coalesce(wm.status, 'active') = 'active'
  order by
    case coalesce(wm.role, '') when 'owner' then 0 when 'admin' then 1 else 2 end,
    wm.created_at nulls last
  limit 1;

  if seed_user_id is null then
    select w.owner_id
      into seed_user_id
    from public.workspaces w
    where w.id = demo_workspace;
  end if;

  if seed_user_id is null then
    select u.id
      into seed_user_id
    from auth.users u
    order by u.created_at nulls last
    limit 1;
  end if;

  -- Remove only demo-workspace transactional data. Global catalogues remain intact.
  if to_regclass('public.builder_selection_history') is not null then
    delete from public.builder_selection_history where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_client_selections') is not null then
    delete from public.builder_client_selections where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_selection_categories') is not null then
    delete from public.builder_selection_categories where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_selection_budget_settings') is not null then
    delete from public.builder_selection_budget_settings where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_selection_sessions') is not null then
    delete from public.builder_selection_sessions where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_purchase_order_items') is not null then
    delete from public.builder_purchase_order_items where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_purchase_orders') is not null then
    delete from public.builder_purchase_orders where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_supplier_invoice_items') is not null then
    delete from public.builder_supplier_invoice_items where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_supplier_invoices') is not null then
    delete from public.builder_supplier_invoices where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_procurement_items') is not null then
    delete from public.builder_procurement_items where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_variation_items') is not null then
    delete from public.builder_variation_items where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_variations') is not null then
    delete from public.builder_variations where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_quote_approvals') is not null then
    delete from public.builder_quote_approvals where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_project_documents') is not null then
    delete from public.builder_project_documents where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_rfis') is not null then
    delete from public.builder_rfis where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_budget_actuals') is not null then
    delete from public.builder_budget_actuals where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_boq_items') is not null then
    delete from public.builder_boq_items where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_boq_sections') is not null then
    delete from public.builder_boq_sections where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_estimate_snapshots') is not null then
    delete from public.builder_estimate_snapshots where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_commercial_projects') is not null then
    delete from public.builder_commercial_projects where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_supplier_price_items') is not null then
    delete from public.builder_supplier_price_items where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_supplier_price_books') is not null then
    delete from public.builder_supplier_price_books where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.builder_suppliers') is not null then
    delete from public.builder_suppliers where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.crm_tasks') is not null then
    delete from public.crm_tasks where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.bookings') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'workspace_id'
  ) then
    delete from public.bookings where workspace_id = demo_workspace;
  end if;
  if to_regclass('public.leads') is not null then
    delete from public.leads where workspace_id = demo_workspace;
  end if;

  create temporary table if not exists pg_temp.demo_stage2_leads (
    lead_key text primary key,
    id uuid not null
  ) on commit drop;
  truncate table pg_temp.demo_stage2_leads;

  if to_regclass('public.leads') is not null then
    for lead_record in
      select * from jsonb_array_elements('[
        {"key":"enq-01","name":"Amelia Hart","email":"amelia.hart@example.com","phone":"+61 2 5550 0101","company":"Hart Family","status":"new","stage":"New","source":"website","suburb":"Buderim","notes":"Custom acreage home enquiry. Wants a first call after school pickup."},
        {"key":"enq-02","name":"Lucas Nguyen","email":"lucas.nguyen@example.com","phone":"+61 2 5550 0102","company":"Nguyen Family","status":"assigned","stage":"Assigned","source":"Google Ads","suburb":"North Lakes","notes":"Knockdown rebuild enquiry. Assigned to Sarah for site feasibility."},
        {"key":"enq-03","name":"Priya Shah","email":"priya.shah@example.com","phone":"+61 2 5550 0103","company":"Shah Family","status":"contacted","stage":"Contacted","source":"Facebook","suburb":"Springfield Lakes","notes":"Discussed split-level options and budget range."},
        {"key":"enq-04","name":"Ethan Walker","email":"ethan.walker@example.com","phone":"+61 2 5550 0104","company":"Walker Family","status":"contacted","stage":"Follow-up","source":"referral","suburb":"Redcliffe","notes":"Waiting on land contract before estimate can proceed."},
        {"key":"enq-05","name":"Mia Thompson","email":"mia.thompson@example.com","phone":"+61 2 5550 0105","company":"Thompson Family","status":"quoted","stage":"Quote requested","source":"phone","suburb":"Cleveland","notes":"Requested preliminary quote for coastal facade upgrades."},
        {"key":"enq-06","name":"Oliver Bennett","email":"oliver.bennett@example.com","phone":"+61 2 5550 0106","company":"Bennett Family","status":"quoted","stage":"Proposal","source":"display-home enquiry","suburb":"Pimpama","notes":"Proposal pack drafted with two inclusion levels."},
        {"key":"enq-07","name":"Chloe Martin","email":"chloe.martin@example.com","phone":"+61 2 5550 0107","company":"Martin Family","status":"assigned","stage":"Appointment booked","source":"website","suburb":"Mango Hill","notes":"Showroom consultation booked for next Thursday."},
        {"key":"enq-08","name":"Noah Wilson","email":"noah.wilson@example.com","phone":"+61 2 5550 0108","company":"Wilson Family","status":"new","stage":"New","source":"Google Ads","suburb":"Ormeau","notes":"Interested in house and land package alternatives."},
        {"key":"enq-09","name":"Grace Taylor","email":"grace.taylor@example.com","phone":"+61 2 5550 0109","company":"Taylor Family","status":"contacted","stage":"Follow-up","source":"referral","suburb":"Samford Valley","notes":"Needs bushfire overlay advice before committing."},
        {"key":"enq-10","name":"Henry Cooper","email":"henry.cooper@example.com","phone":"+61 2 5550 0110","company":"Cooper Family","status":"quoted","stage":"Quote requested","source":"Facebook","suburb":"Caloundra West","notes":"Seeking fixed price guidance after finance pre-approval."}
      ]'::jsonb)
    loop
      lead_id := gen_random_uuid();
      insert into public.leads (
        id,
        workspace_id,
        user_id,
        name,
        email,
        phone,
        company,
        notes,
        lead_status,
        lead_source,
        stage,
        lead_owner_user_id,
        assigned_at,
        created_at,
        updated_at
      )
      values (
        lead_id,
        demo_workspace,
        seed_user_id,
        lead_record->>'name',
        lead_record->>'email',
        lead_record->>'phone',
        lead_record->>'company',
        concat(lead_record->>'notes', E'\nSuburb: ', lead_record->>'suburb', E'\nDemo data: non-deliverable contact details.'),
        lead_record->>'status',
        lead_record->>'source',
        lead_record->>'stage',
        seed_user_id,
        now() - ((9 - greatest(1, (right(lead_record->>'key', 2))::integer))::text || ' weeks')::interval,
        now() - ((8 + (right(lead_record->>'key', 2))::integer)::text || ' weeks')::interval,
        now() - ((right(lead_record->>'key', 2))::integer::text || ' days')::interval
      );

      insert into pg_temp.demo_stage2_leads (lead_key, id)
      values (lead_record->>'key', lead_id);
    end loop;
  end if;

  if to_regclass('public.crm_tasks') is not null and seed_user_id is not null then
    insert into public.crm_tasks (user_id, workspace_id, lead_id, title, due_at, status, meta)
    select
      seed_user_id,
      demo_workspace,
      l.id,
      task_title,
      task_due,
      task_status,
      jsonb_build_object('demo', true, 'assigned_staff', assigned_staff)
    from (
      values
        ('enq-01', 'Call Amelia about acreage design brief', now() + interval '1 day', 'open', 'Sarah'),
        ('enq-02', 'Send North Lakes knockdown rebuild checklist', now() - interval '2 days', 'open', 'Ben'),
        ('enq-03', 'Confirm Springfield Lakes contour plan received', now() + interval '3 days', 'open', 'Priya'),
        ('enq-04', 'Follow up Redcliffe land contract timing', now() - interval '5 days', 'open', 'Maddison'),
        ('enq-06', 'Review proposal options before client call', now() + interval '2 days', 'open', 'Sarah')
    ) as t(lead_key, task_title, task_due, task_status, assigned_staff)
    join pg_temp.demo_stage2_leads l on l.lead_key = t.lead_key;
  end if;

  if to_regclass('public.bookings') is not null and seed_user_id is not null then
    insert into public.bookings (
      user_id,
      service_id,
      workspace_id,
      client_name,
      client_email,
      client_phone,
      start_datetime,
      end_datetime,
      status,
      custom_field_data,
      created_at
    )
    values
      (seed_user_id, null, demo_workspace, 'Chloe Martin', 'chloe.martin@example.com', '+61 2 5550 0107', now() + interval '4 days', now() + interval '4 days 45 minutes', 'confirmed', '{"demo":true,"appointment_type":"Showroom consultation"}'::jsonb, now() - interval '10 days'),
      (seed_user_id, null, demo_workspace, 'Oliver Bennett', 'oliver.bennett@example.com', '+61 2 5550 0106', now() + interval '8 days', now() + interval '8 days 45 minutes', 'confirmed', '{"demo":true,"appointment_type":"Proposal review"}'::jsonb, now() - interval '15 days');
  end if;

  insert into public.builder_suppliers (workspace_id, name, contact_name, email, phone, trade_category, status, metadata, notes)
  values
    (demo_workspace, 'Demo Concrete and Civil', 'Mark Lawson', 'concrete@example.com', '+61 2 5550 0201', 'Concrete and earthworks', 'preferred', '{"demo":true}'::jsonb, 'Demo supplier only.'),
    (demo_workspace, 'Demo Frame and Truss Co', 'Tara Mills', 'frames@example.com', '+61 2 5550 0202', 'Frame and truss', 'preferred', '{"demo":true}'::jsonb, 'Demo supplier only.'),
    (demo_workspace, 'Demo Roofing Supply', 'Josh Patel', 'roofing@example.com', '+61 2 5550 0203', 'Roofing', 'active', '{"demo":true}'::jsonb, 'Demo supplier only.'),
    (demo_workspace, 'Demo Selections Studio', 'Elena Ross', 'selections@example.com', '+61 2 5550 0204', 'Selections', 'active', '{"demo":true}'::jsonb, 'Demo supplier only.')
  on conflict (workspace_id, name) do update
  set status = excluded.status,
      metadata = excluded.metadata,
      notes = excluded.notes,
      updated_at = now();

  select id into supplier_foundations from public.builder_suppliers where workspace_id = demo_workspace and name = 'Demo Concrete and Civil';
  select id into supplier_frame from public.builder_suppliers where workspace_id = demo_workspace and name = 'Demo Frame and Truss Co';
  select id into supplier_roofing from public.builder_suppliers where workspace_id = demo_workspace and name = 'Demo Roofing Supply';
  select id into supplier_finishes from public.builder_suppliers where workspace_id = demo_workspace and name = 'Demo Selections Studio';

  for project_record in
    select * from jsonb_array_elements('[
      {"n":1,"number":"DEMO-001","name":"Buderim Ridge Custom Home","client":"Amelia Hart","email":"amelia.hart@example.com","phone":"+61 2 5550 0301","address":"12 Rainforest Rise, Buderim QLD 4556","stage":"Initial consultation","staff":"Sarah","value":815000,"months":9},
      {"n":2,"number":"DEMO-002","name":"North Lakes Knockdown Rebuild","client":"Lucas Nguyen","email":"lucas.nguyen@example.com","phone":"+61 2 5550 0302","address":"8 Grevillea Circuit, North Lakes QLD 4509","stage":"Early sales","staff":"Ben","value":742000,"months":8},
      {"n":3,"number":"DEMO-003","name":"Springfield Lakes Family Home","client":"Priya Shah","email":"priya.shah@example.com","phone":"+61 2 5550 0303","address":"31 Lakeside Avenue, Springfield Lakes QLD 4300","stage":"Estimate issued","staff":"Sarah","value":689000,"months":8},
      {"n":4,"number":"DEMO-004","name":"Cleveland Coastal Facade","client":"Mia Thompson","email":"mia.thompson@example.com","phone":"+61 2 5550 0304","address":"19 Shore Street, Cleveland QLD 4163","stage":"Proposal issued","staff":"Maddison","value":936000,"months":7},
      {"n":5,"number":"DEMO-005","name":"Pimpama Dual Living Build","client":"Oliver Bennett","email":"oliver.bennett@example.com","phone":"+61 2 5550 0305","address":"44 Yawalpah Road, Pimpama QLD 4209","stage":"Accepted","staff":"Ben","value":775000,"months":7},
      {"n":6,"number":"DEMO-006","name":"Mango Hill Hamptons Home","client":"Chloe Martin","email":"chloe.martin@example.com","phone":"+61 2 5550 0306","address":"6 Ashwood Parade, Mango Hill QLD 4509","stage":"Contracts underway","staff":"Sarah","value":708000,"months":6},
      {"n":7,"number":"DEMO-007","name":"Samford Valley Acreage","client":"Grace Taylor","email":"grace.taylor@example.com","phone":"+61 2 5550 0307","address":"52 Ironbark Lane, Samford Valley QLD 4520","stage":"Design and engineering","staff":"Priya","value":1185000,"months":6},
      {"n":8,"number":"DEMO-008","name":"Redcliffe Narrow Lot","client":"Ethan Walker","email":"ethan.walker@example.com","phone":"+61 2 5550 0308","address":"27 Oxley Avenue, Redcliffe QLD 4020","stage":"Approvals","staff":"Maddison","value":641000,"months":5},
      {"n":9,"number":"DEMO-009","name":"Caloundra West Lowset","client":"Henry Cooper","email":"henry.cooper@example.com","phone":"+61 2 5550 0309","address":"16 Bells Reach Drive, Caloundra West QLD 4551","stage":"Selections underway","staff":"Elena","value":598000,"months":5},
      {"n":10,"number":"DEMO-010","name":"Ormeau Family Upgrade","client":"Noah Wilson","email":"noah.wilson@example.com","phone":"+61 2 5550 0310","address":"23 Prairie Avenue, Ormeau QLD 4208","stage":"Selections underway","staff":"Elena","value":662000,"months":4},
      {"n":11,"number":"DEMO-011","name":"Wynnum Bayside Home","client":"Ava Robinson","email":"ava.robinson@example.com","phone":"+61 2 5550 0311","address":"11 Sorrento Street, Wynnum QLD 4178","stage":"Selections completed","staff":"Elena","value":724000,"months":4},
      {"n":12,"number":"DEMO-012","name":"Narangba Pre-start Package","client":"Jack Harris","email":"jack.harris@example.com","phone":"+61 2 5550 0312","address":"5 Oakey Flat Road, Narangba QLD 4504","stage":"Pre-start","staff":"Priya","value":681000,"months":4},
      {"n":13,"number":"DEMO-013","name":"Rochedale Site Start","client":"Sophie King","email":"sophie.king@example.com","phone":"+61 2 5550 0313","address":"38 Gardner Road, Rochedale QLD 4123","stage":"Earthworks","staff":"Ben","value":803000,"months":3},
      {"n":14,"number":"DEMO-014","name":"Ipswich Base Stage","client":"William Scott","email":"william.scott@example.com","phone":"+61 2 5550 0314","address":"74 Pine Mountain Road, Ipswich QLD 4305","stage":"Slab base","staff":"Ben","value":577000,"months":3},
      {"n":15,"number":"DEMO-015","name":"Mooloolaba Frame Stage","client":"Isla Green","email":"isla.green@example.com","phone":"+61 2 5550 0315","address":"21 Amarina Avenue, Mooloolaba QLD 4557","stage":"Frame","staff":"Sarah","value":948000,"months":3},
      {"n":16,"number":"DEMO-016","name":"The Gap Lock-up","client":"Liam Young","email":"liam.young@example.com","phone":"+61 2 5550 0316","address":"9 Glen Affric Street, The Gap QLD 4061","stage":"Lock-up","staff":"Maddison","value":864000,"months":2},
      {"n":17,"number":"DEMO-017","name":"Helensvale Fixing Stage","client":"Emily Lewis","email":"emily.lewis@example.com","phone":"+61 2 5550 0317","address":"47 Monterey Keys Drive, Helensvale QLD 4212","stage":"Fixing","staff":"Priya","value":735000,"months":2},
      {"n":18,"number":"DEMO-018","name":"Carina Internal Finishes","client":"Thomas Hall","email":"thomas.hall@example.com","phone":"+61 2 5550 0318","address":"18 Gallipoli Road, Carina QLD 4152","stage":"Internal finishes","staff":"Elena","value":692000,"months":2},
      {"n":19,"number":"DEMO-019","name":"Palmwoods Practical Completion","client":"Charlotte Allen","email":"charlotte.allen@example.com","phone":"+61 2 5550 0319","address":"29 Jubilee Drive, Palmwoods QLD 4555","stage":"Practical completion","staff":"Sarah","value":789000,"months":1},
      {"n":20,"number":"DEMO-020","name":"Tamborine Handover Prep","client":"James Wright","email":"james.wright@example.com","phone":"+61 2 5550 0320","address":"14 Beacon Road, Tamborine Mountain QLD 4272","stage":"Handover preparation","staff":"Maddison","value":905000,"months":1}
    ]'::jsonb)
  loop
    project_index := (project_record->>'n')::integer;

    insert into public.builder_commercial_projects (
      workspace_id,
      source_quote_number,
      project_name,
      client_name,
      client_email,
      client_phone,
      site_address,
      status,
      original_estimate_total,
      approved_variations_total,
      contract_total,
      source_metadata,
      notes,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    values (
      demo_workspace,
      project_record->>'number',
      project_record->>'name',
      project_record->>'client',
      project_record->>'email',
      project_record->>'phone',
      project_record->>'address',
      'active',
      (project_record->>'value')::numeric,
      case when project_index in (12, 18) then 12450 else 0 end,
      (project_record->>'value')::numeric + case when project_index in (12, 18) then 12450 else 0 end,
      jsonb_build_object(
        'demo', true,
        'lifecycle_stage', project_record->>'stage',
        'assigned_staff', project_record->>'staff',
        'region', 'South East Queensland',
        'standard_dataset', 'stage2'
      ),
      concat('Demo lifecycle: ', project_record->>'stage', '. Historical activity distributed over ', project_record->>'months', ' months.'),
      seed_user_id,
      seed_user_id,
      now() - ((project_record->>'months')::integer::text || ' months')::interval,
      now() - (greatest(1, 22 - project_index)::text || ' days')::interval
    )
    returning id into project_id;

    insert into public.builder_estimate_snapshots (
      workspace_id,
      project_id,
      snapshot_number,
      snapshot_label,
      status,
      source_quote_number,
      source_quote_date,
      source_template_key,
      source_template_name,
      summary,
      base_line_item_subtotal,
      preliminaries_total,
      overheads_total,
      margin_total,
      profit_total,
      gst_total,
      final_quote_total,
      created_by,
      created_at,
      updated_at
    )
    values (
      demo_workspace,
      project_id,
      1,
      'Demo current estimate',
      case when project_index <= 2 then 'draft' when project_index <= 4 then 'current' else 'approved' end,
      project_record->>'number',
      (current_date - ((project_record->>'months')::integer * 25 || ' days')::interval)::date,
      'demo-residential',
      'Demo Residential Standard',
      jsonb_build_object('demo', true, 'lifecycle_stage', project_record->>'stage'),
      round(((project_record->>'value')::numeric * 0.72)::numeric, 2),
      round(((project_record->>'value')::numeric * 0.08)::numeric, 2),
      round(((project_record->>'value')::numeric * 0.05)::numeric, 2),
      round(((project_record->>'value')::numeric * 0.06)::numeric, 2),
      round(((project_record->>'value')::numeric * 0.04)::numeric, 2),
      round(((project_record->>'value')::numeric / 11)::numeric, 2),
      (project_record->>'value')::numeric,
      seed_user_id,
      now() - (((project_record->>'months')::integer * 25)::text || ' days')::interval,
      now() - (greatest(1, 20 - project_index)::text || ' days')::interval
    )
    returning id into snapshot_id;

    insert into public.builder_boq_sections (workspace_id, project_id, snapshot_id, source_section_key, source_section_name, display_name, section_number, sort_order, subtotal, metadata, created_by)
    values
      (demo_workspace, project_id, snapshot_id, 'site-base', 'Site and base', 'Site and base', '01', 10, round(((project_record->>'value')::numeric * 0.18)::numeric, 2), '{"demo":true}'::jsonb, seed_user_id)
    returning id into section_id;

    insert into public.builder_boq_items (workspace_id, project_id, snapshot_id, section_id, supplier_id, source_section_key, source_section_name, item_name, description, quantity, unit, unit_rate, line_total, status, metadata, created_by)
    values
      (demo_workspace, project_id, snapshot_id, section_id, supplier_foundations, 'site-base', 'Site and base', 'Site establishment and slab package', 'Earthworks, piers, drainage preparation and slab/base works.', 1, 'sum', round(((project_record->>'value')::numeric * 0.18)::numeric, 2), round(((project_record->>'value')::numeric * 0.18)::numeric, 2), 'active', '{"demo":true}'::jsonb, seed_user_id);

    insert into public.builder_boq_sections (workspace_id, project_id, snapshot_id, source_section_key, source_section_name, display_name, section_number, sort_order, subtotal, metadata, created_by)
    values
      (demo_workspace, project_id, snapshot_id, 'frame-roof', 'Frame and roof', 'Frame and roof', '02', 20, round(((project_record->>'value')::numeric * 0.24)::numeric, 2), '{"demo":true}'::jsonb, seed_user_id)
    returning id into section_id;

    insert into public.builder_boq_items (workspace_id, project_id, snapshot_id, section_id, supplier_id, source_section_key, source_section_name, item_name, description, quantity, unit, unit_rate, line_total, status, metadata, created_by)
    values
      (demo_workspace, project_id, snapshot_id, section_id, supplier_frame, 'frame-roof', 'Frame and roof', 'Frame, truss and roof package', 'Structural frame, trusses, bracing and roofing allowance.', 1, 'sum', round(((project_record->>'value')::numeric * 0.24)::numeric, 2), round(((project_record->>'value')::numeric * 0.24)::numeric, 2), 'active', '{"demo":true}'::jsonb, seed_user_id);

    insert into public.builder_boq_sections (workspace_id, project_id, snapshot_id, source_section_key, source_section_name, display_name, section_number, sort_order, subtotal, metadata, created_by)
    values
      (demo_workspace, project_id, snapshot_id, 'finishes', 'Selections and finishes', 'Selections and finishes', '03', 30, round(((project_record->>'value')::numeric * 0.16)::numeric, 2), '{"demo":true}'::jsonb, seed_user_id)
    returning id into section_id;

    insert into public.builder_boq_items (workspace_id, project_id, snapshot_id, section_id, supplier_id, source_section_key, source_section_name, item_name, description, quantity, unit, unit_rate, line_total, status, metadata, created_by)
    values
      (demo_workspace, project_id, snapshot_id, section_id, supplier_finishes, 'finishes', 'Selections and finishes', 'Client selections allowance', 'Kitchen, fixtures, tiles, flooring and finish selections.', 1, 'sum', round(((project_record->>'value')::numeric * 0.16)::numeric, 2), round(((project_record->>'value')::numeric * 0.16)::numeric, 2), 'active', '{"demo":true}'::jsonb, seed_user_id);

    insert into public.builder_project_documents (workspace_id, project_id, snapshot_id, document_type, title, description, file_name, mime_type, file_size_bytes, related_table, related_record_id, status, metadata, created_by)
    values (
      demo_workspace,
      project_id,
      snapshot_id,
      case when project_index <= 4 then 'quote' when project_index <= 8 then 'contract' when project_index <= 18 then 'photo' else 'approval' end,
      concat(project_record->>'number', ' demo project pack'),
      concat('Demo metadata for ', project_record->>'stage', '. No file is published or sent.'),
      concat(lower(project_record->>'number'), '-demo-pack.pdf'),
      'application/pdf',
      245760 + project_index,
      'builder_commercial_projects',
      project_id,
      'active',
      jsonb_build_object('demo', true, 'lifecycle_stage', project_record->>'stage'),
      seed_user_id
    );

    if project_index >= 3 then
      insert into public.builder_quote_approvals (workspace_id, project_id, snapshot_id, approval_number, status, approved_amount, signer_name, signer_email, signed_at, approval_snapshot, metadata, created_by, updated_by)
      values (
        demo_workspace,
        project_id,
        snapshot_id,
        concat('QA-', lpad(project_index::text, 3, '0')),
        case when project_index <= 4 then 'sent' else 'approved' end,
        (project_record->>'value')::numeric,
        case when project_index <= 4 then null else project_record->>'client' end,
        case when project_index <= 4 then null else project_record->>'email' end,
        case when project_index <= 4 then null else now() - ((21 - project_index)::text || ' days')::interval end,
        jsonb_build_object('demo', true, 'quote_number', project_record->>'number'),
        '{"demo":true}'::jsonb,
        seed_user_id,
        seed_user_id
      );
    end if;

    if project_index between 9 and 18 then
      insert into public.builder_selection_sessions (workspace_id, project_id, snapshot_id, session_name, original_estimate_total, private_upgrade_ceiling, current_net_selection_variation, current_updated_estimate_total, selection_budget_status, status, metadata, created_by, updated_by)
      values (
        demo_workspace,
        project_id,
        snapshot_id,
        'Demo client selections',
        (project_record->>'value')::numeric,
        35000,
        case when project_index = 10 then 4200 when project_index = 11 then -1800 else 0 end,
        (project_record->>'value')::numeric + case when project_index = 10 then 4200 when project_index = 11 then -1800 else 0 end,
        case when project_index = 10 then 'approaching_limit' else 'within_budget' end,
        case when project_index in (11, 12) then 'summary_ready' else 'active' end,
        jsonb_build_object('demo', true, 'lifecycle_stage', project_record->>'stage'),
        seed_user_id,
        seed_user_id
      )
      returning id into selection_session_id;

      insert into public.builder_selection_categories (workspace_id, project_id, session_id, category, original_allowance, selected_value, net_difference, metadata, created_by, updated_by)
      values
        (demo_workspace, project_id, selection_session_id, 'Kitchen appliances', 8500, case when project_index = 10 then 12700 else 8300 end, case when project_index = 10 then 4200 else -200 end, '{"demo":true}'::jsonb, seed_user_id, seed_user_id),
        (demo_workspace, project_id, selection_session_id, 'Flooring', 14500, case when project_index = 11 then 12900 else 14500 end, case when project_index = 11 then -1600 else 0 end, '{"demo":true}'::jsonb, seed_user_id, seed_user_id);

      insert into public.builder_client_selections (
        workspace_id, project_id, snapshot_id, session_id, category, title, description,
        included_in_contract, allowance_amount, selected_supplier_id, selected_supplier_name,
        selected_product_name, selected_colour, selected_finish, selected_details, status,
        required_by, selected_at, approved_at, approved_by_name, metadata, notes, created_by, updated_by,
        subcategory, room, supplier, brand, product_name, colour, finish, included_allowance,
        supplier_cost, builder_cost, installation_cost, builder_markup_percent,
        calculated_client_selection_price, client_selection_price, variation_amount,
        selection_status, is_included_selection, is_active
      )
      values (
        demo_workspace, project_id, snapshot_id, selection_session_id, 'Kitchen appliances', 'Kitchen appliance package',
        'Demo appliance selection linked to the selections budget.',
        false, 8500, supplier_finishes, 'Demo Selections Studio',
        case when project_index = 10 then 'Premium induction and oven package' else 'Standard appliance package' end,
        'Stainless steel', 'Brushed',
        jsonb_build_object('demo', true, 'priceState', case when project_index = 10 then 'over_allowance' else 'within_allowance' end),
        case when project_index in (11, 12, 18) then 'approved' else 'selected' end,
        current_date + interval '14 days',
        now() - interval '20 days',
        case when project_index in (11, 12, 18) then now() - interval '10 days' else null end,
        case when project_index in (11, 12, 18) then project_record->>'staff' else null end,
        jsonb_build_object('demo', true, 'scenario', case when project_index = 10 then 'selection over allowance' else 'normal selection' end),
        'Demo selection. Non-production data.',
        seed_user_id, seed_user_id,
        'Appliances', 'Kitchen', 'Demo Selections Studio', 'Demo Brand',
        case when project_index = 10 then 'Premium induction and oven package' else 'Standard appliance package' end,
        'Stainless steel', 'Brushed', 8500,
        case when project_index = 10 then 11200 else 7600 end,
        case when project_index = 10 then 11200 else 7600 end,
        0, 10,
        case when project_index = 10 then 12700 else 8300 end,
        case when project_index = 10 then 12700 else 8300 end,
        case when project_index = 10 then 4200 else -200 end,
        case when project_index in (11, 12, 18) then 'approved' else 'selected' end,
        project_index <> 10,
        true
      )
      returning id into selection_id;

      insert into public.builder_selection_history (workspace_id, project_id, session_id, selection_id, action, user_id, user_role, changed_by, previous_variation, new_variation, new_value, reason, created_by, updated_by)
      values (
        demo_workspace, project_id, selection_session_id, selection_id, 'selected', seed_user_id, 'builder_staff', seed_user_id,
        0,
        case when project_index = 10 then 4200 else -200 end,
        jsonb_build_object('demo', true, 'title', 'Kitchen appliance package'),
        'Demo selection activity.',
        seed_user_id,
        seed_user_id
      );
    end if;

    if project_index in (10, 12) then
      insert into public.builder_variations (workspace_id, project_id, snapshot_id, variation_number, title, reason, status, subtotal, gst_total, total, submitted_at, approved_at, approved_by_name, approved_by_email, metadata, notes, created_by, updated_by)
      values (
        demo_workspace,
        project_id,
        snapshot_id,
        concat('VAR-', lpad(project_index::text, 3, '0')),
        case when project_index = 10 then 'Kitchen appliance upgrade' else 'Driveway finish upgrade' end,
        'Client requested upgrade during selections.',
        case when project_index = 12 then 'approved' else 'submitted' end,
        case when project_index = 10 then 3818.18 else 11318.18 end,
        case when project_index = 10 then 381.82 else 1131.82 end,
        case when project_index = 10 then 4200 else 12450 end,
        now() - interval '16 days',
        case when project_index = 12 then now() - interval '8 days' else null end,
        case when project_index = 12 then project_record->>'client' else null end,
        case when project_index = 12 then project_record->>'email' else null end,
        jsonb_build_object('demo', true, 'scenario', case when project_index = 12 then 'approved variation' else 'pending variation' end),
        'Demo variation record.',
        seed_user_id,
        seed_user_id
      )
      returning id into variation_id;

      insert into public.builder_variation_items (workspace_id, project_id, variation_id, snapshot_id, description, quantity, unit, unit_cost, unit_price, gst_rate, cost_total, line_total, status, metadata, created_by)
      values (
        demo_workspace,
        project_id,
        variation_id,
        snapshot_id,
        case when project_index = 10 then 'Upgrade appliance package' else 'Exposed aggregate driveway finish' end,
        1,
        'sum',
        case when project_index = 10 then 3100 else 9100 end,
        case when project_index = 10 then 4200 else 12450 end,
        10,
        case when project_index = 10 then 3100 else 9100 end,
        case when project_index = 10 then 4200 else 12450 end,
        'active',
        '{"demo":true}'::jsonb,
        seed_user_id
      );
    end if;

    if project_index in (13, 15, 16) then
      insert into public.builder_procurement_items (workspace_id, project_id, snapshot_id, supplier_id, item_name, description, section_name, procurement_category, quantity, unit, estimated_rate, estimated_total, required_by, order_by, order_status, delivery_status, status, metadata, created_by, updated_by)
      values (
        demo_workspace,
        project_id,
        snapshot_id,
        case when project_index = 13 then supplier_foundations when project_index = 15 then supplier_frame else supplier_roofing end,
        case when project_index = 13 then 'Concrete pump booking' when project_index = 15 then 'Frame and truss delivery' else 'Roofing delivery' end,
        'Demo procurement activity linked to construction progress.',
        case when project_index = 13 then 'Site and base' when project_index = 15 then 'Frame and roof' else 'Frame and roof' end,
        'Construction supply',
        1,
        'sum',
        case when project_index = 13 then 6800 when project_index = 15 then 42600 else 31200 end,
        case when project_index = 13 then 6800 when project_index = 15 then 42600 else 31200 end,
        current_date + (project_index || ' days')::interval,
        current_date + ((project_index - 5) || ' days')::interval,
        case when project_index = 13 then 'not_started' else 'ordered' end,
        case when project_index = 15 then 'scheduled' else 'not_required_yet' end,
        'active',
        jsonb_build_object('demo', true, 'scenario', 'procurement activity'),
        seed_user_id,
        seed_user_id
      )
      returning id into procurement_id;

      insert into public.builder_purchase_orders (workspace_id, project_id, snapshot_id, supplier_id, po_number, status, supplier_name, supplier_email, issue_date, required_by, issued_at, subtotal, gst_total, total, delivery_address, notes, metadata, created_by, updated_by, issued_by)
      values (
        demo_workspace,
        project_id,
        snapshot_id,
        case when project_index = 13 then supplier_foundations when project_index = 15 then supplier_frame else supplier_roofing end,
        concat('DEMO-PO-', lpad(project_index::text, 3, '0')),
        case when project_index = 13 then 'draft' else 'issued' end,
        case when project_index = 13 then 'Demo Concrete and Civil' when project_index = 15 then 'Demo Frame and Truss Co' else 'Demo Roofing Supply' end,
        case when project_index = 13 then 'concrete@example.com' when project_index = 15 then 'frames@example.com' else 'roofing@example.com' end,
        current_date - interval '4 days',
        current_date + (project_index || ' days')::interval,
        case when project_index = 13 then null else now() - interval '3 days' end,
        case when project_index = 13 then 6800 when project_index = 15 then 42600 else 31200 end,
        case when project_index = 13 then 680 when project_index = 15 then 4260 else 3120 end,
        case when project_index = 13 then 7480 when project_index = 15 then 46860 else 34320 end,
        project_record->>'address',
        'Demo purchase order. No supplier email is sent.',
        '{"demo":true}'::jsonb,
        seed_user_id,
        seed_user_id,
        seed_user_id
      )
      returning id into purchase_order_id;

      insert into public.builder_purchase_order_items (workspace_id, project_id, purchase_order_id, snapshot_id, procurement_item_id, description, quantity_ordered, quantity_received, unit, unit_cost, gst_rate, line_total, status, metadata, created_by)
      values (
        demo_workspace,
        project_id,
        purchase_order_id,
        snapshot_id,
        procurement_id,
        case when project_index = 13 then 'Concrete pump booking' when project_index = 15 then 'Frame and truss delivery' else 'Roofing delivery' end,
        1,
        case when project_index = 15 then 1 else 0 end,
        'sum',
        case when project_index = 13 then 6800 when project_index = 15 then 42600 else 31200 end,
        10,
        case when project_index = 13 then 6800 when project_index = 15 then 42600 else 31200 end,
        case when project_index = 15 then 'received' else 'ordered' end,
        '{"demo":true}'::jsonb,
        seed_user_id
      );
    end if;

    if project_index = 14 then
      insert into public.builder_rfis (workspace_id, project_id, snapshot_id, rfi_number, subject, question, status, priority, asked_by_name, asked_by_email, due_date, metadata, notes, created_by, updated_by)
      values (
        demo_workspace,
        project_id,
        snapshot_id,
        'RFI-014',
        'Confirm slab set-down at alfresco threshold',
        'Please confirm final set-down detail before waterproofing coordination.',
        'open',
        'high',
        project_record->>'client',
        project_record->>'email',
        current_date + interval '3 days',
        '{"demo":true,"scenario":"open RFI"}'::jsonb,
        'Demo RFI for construction coordination.',
        seed_user_id,
        seed_user_id
      );
    end if;
  end loop;

  insert into public.demo_action_log (workspace_id, action_type, provider, simulated_result, created_by)
  values (
    demo_workspace,
    'reset-stage2-reseeded',
    'internal',
    jsonb_build_object(
      'ok', true,
      'enquiries', (select count(*) from public.leads where workspace_id = demo_workspace),
      'projects', (select count(*) from public.builder_commercial_projects where workspace_id = demo_workspace),
      'message', 'Demo Company Stage 2 dataset reset and reseeded.'
    ),
    seed_user_id
  );

  return jsonb_build_object(
    'ok', true,
    'workspace_id', demo_workspace,
    'enquiries', (select count(*) from public.leads where workspace_id = demo_workspace),
    'projects', (select count(*) from public.builder_commercial_projects where workspace_id = demo_workspace),
    'builder_client_selections', (select count(*) from public.builder_client_selections where workspace_id = demo_workspace),
    'builder_variations', (select count(*) from public.builder_variations where workspace_id = demo_workspace),
    'builder_procurement_items', (select count(*) from public.builder_procurement_items where workspace_id = demo_workspace),
    'builder_rfis', (select count(*) from public.builder_rfis where workspace_id = demo_workspace),
    'message', 'Demo Company Stage 2 dataset reset and reseeded.'
  );
end;
$$;

create or replace function public.reset_demo_company_stage1()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.reset_demo_company_stage2();
end;
$$;
