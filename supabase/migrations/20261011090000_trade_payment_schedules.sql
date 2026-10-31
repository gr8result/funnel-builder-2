-- Trade payment schedules (NOT APPLIED - review and apply deliberately).
-- Builder master templates, plus the server record of job trade contracts, milestones, claims, invoices and audit.
-- Job files remain the working store (workbook.tradeContracts); these tables give builders shared templates and reporting.
--
-- Tenant rules:
--   * every row carries workspace_id, and every child points at its parent with a composite (id, workspace_id) key, so a
--     child row can never name another builder's contract, milestone, claim, supplier, project or purchase order;
--   * workspace and parent keys are immutable after insert;
--   * members read; owners/admins/builder admins manage contracts, approve and record payments; staff record completion,
--     claims and invoices; templates are owner/admin only;
--   * the audit trail is written by triggers only. Nobody holds insert, update or delete on it.
-- Isolation reuses public.builder_commercial_is_workspace_member / builder_selection_is_config_admin /
-- builder_selection_immutable_workspace / builder_commercial_set_updated_at from earlier migrations.

begin;

-- ---- Roles ------------------------------------------------------------------------------------------------------------

create or replace function public.builder_trade_can_manage(p_workspace_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
    and coalesce(m.status, 'active') = 'active' and coalesce(m.role, '') in ('owner', 'admin', 'builder_admin'));
$$;

create or replace function public.builder_trade_can_claim(p_workspace_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
    and coalesce(m.status, 'active') = 'active' and coalesce(m.role, '') in ('owner', 'admin', 'builder_admin', 'builder_staff'));
$$;

-- ---- Tables -----------------------------------------------------------------------------------------------------------

create table if not exists public.builder_trade_payment_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  trade text not null check (trade <> ''),
  name text not null,
  source_section text not null,
  revision integer not null default 1 check (revision >= 1),
  milestones jsonb not null check (jsonb_typeof(milestones) = 'array'),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, trade)
);

create table if not exists public.builder_trade_contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  job_id text not null check (job_id <> ''),
  contract_key text not null check (contract_key <> ''),
  trade text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CANCELLED', 'CLOSED')),
  supplier_id uuid,
  supplier_name text,
  contract_amount numeric(14,2) not null default 0 check (contract_amount >= 0),
  amount_mode text not null default 'QUOTATION' check (amount_mode in ('QUOTATION', 'AGREED')),
  agreed_amount numeric(14,2) check (agreed_amount is null or agreed_amount >= 0),
  purchase_order_id uuid,
  template_id text,
  template_revision integer,
  approved_variations jsonb not null default '[]'::jsonb check (jsonb_typeof(approved_variations) = 'array'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, job_id, contract_key),
  -- No delete action: a project, supplier or purchase order that carries a trade contract is not removed from under it.
  foreign key (project_id, workspace_id) references public.builder_commercial_projects(id, workspace_id),
  foreign key (supplier_id, workspace_id) references public.builder_suppliers(id, workspace_id),
  foreign key (purchase_order_id, workspace_id) references public.builder_purchase_orders(id, workspace_id)
);
-- One purchase order carries one trade contract: a second contract can never be hung on the same order.
create unique index if not exists builder_trade_contract_po_unique
  on public.builder_trade_contracts (workspace_id, purchase_order_id) where purchase_order_id is not null;

create table if not exists public.builder_trade_contract_milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contract_id uuid not null,
  milestone_key text not null check (milestone_key <> ''),
  label text not null,
  sort_order integer not null,
  percent numeric(6,3) check (percent is null or (percent >= 0 and percent <= 100)),
  is_remainder boolean not null default false,
  manual_amount numeric(14,2) check (manual_amount is null or manual_amount >= 0),
  construction_stage text,
  gantt_task_id text,
  job_board_job_id text,
  job_board_task_key text,
  forecast_date date,
  forecast_date_source text not null default 'NONE' check (forecast_date_source in ('NONE', 'GANTT', 'MANUAL')),
  completion_status text not null default 'NOT_STARTED' check (completion_status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE')),
  completion_source text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, contract_id, workspace_id),
  unique (contract_id, milestone_key),
  foreign key (contract_id, workspace_id) references public.builder_trade_contracts(id, workspace_id) on delete cascade
);

-- A claim is a request for one milestone. Approval is a separate, permissioned decision recorded on the same row.
create table if not exists public.builder_trade_contract_claims (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contract_id uuid not null,
  milestone_id uuid not null,
  status text not null default 'CLAIMED' check (status in ('CLAIMED', 'APPROVED', 'REJECTED')),
  claimed_amount numeric(14,2) not null check (claimed_amount > 0),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz not null default now(),
  approved_amount numeric(14,2) check (approved_amount is null or (approved_amount > 0 and approved_amount <= claimed_amount)),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_reason text,
  updated_at timestamptz not null default now(),
  unique (id, contract_id, workspace_id),
  check ((status = 'APPROVED') = (approved_amount is not null)),
  foreign key (contract_id, workspace_id) references public.builder_trade_contracts(id, workspace_id),
  foreign key (milestone_id, contract_id, workspace_id) references public.builder_trade_contract_milestones(id, contract_id, workspace_id)
);
-- A milestone holds at most one live claim (submitted or approved); a rejected claim may be followed by a new one.
create unique index if not exists builder_trade_claim_one_live_per_milestone
  on public.builder_trade_contract_claims (milestone_id) where status in ('CLAIMED', 'APPROVED');

-- The subcontractor's invoice for a claim, and what has been paid against it.
create table if not exists public.builder_trade_contract_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contract_id uuid not null,
  claim_id uuid not null,
  invoice_ref text not null check (btrim(invoice_ref) <> ''),
  amount numeric(14,2) not null check (amount > 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  paid_date date,
  paid_recorded_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (paid_amount <= amount),
  check (paid_amount = 0 or paid_date is not null),
  foreign key (contract_id, workspace_id) references public.builder_trade_contracts(id, workspace_id),
  foreign key (claim_id, contract_id, workspace_id) references public.builder_trade_contract_claims(id, contract_id, workspace_id)
);
-- One invoice reference per contract: prevents a duplicate milestone payment.
create unique index if not exists builder_trade_invoice_ref_unique
  on public.builder_trade_contract_invoices (contract_id, lower(btrim(invoice_ref)));

-- Append-only. A contract that has history cannot be deleted on its own (cancel it instead); it goes only with its workspace.
create table if not exists public.builder_trade_contract_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contract_id uuid not null,
  source_table text not null,
  source_id uuid,
  action text not null,
  actor_id uuid,
  from_value jsonb,
  to_value jsonb,
  created_at timestamptz not null default now(),
  foreign key (contract_id, workspace_id) references public.builder_trade_contracts(id, workspace_id)
);

create index if not exists builder_trade_contracts_job_idx on public.builder_trade_contracts (workspace_id, job_id);
create index if not exists builder_trade_milestones_contract_idx on public.builder_trade_contract_milestones (workspace_id, contract_id);
create index if not exists builder_trade_claims_contract_idx on public.builder_trade_contract_claims (workspace_id, contract_id);
create index if not exists builder_trade_invoices_contract_idx on public.builder_trade_contract_invoices (workspace_id, contract_id);
create index if not exists builder_trade_audit_contract_idx on public.builder_trade_contract_audit (workspace_id, contract_id, created_at);

-- ---- Guards -----------------------------------------------------------------------------------------------------------

-- Parent keys never move: a milestone, claim or invoice stays on the contract (and job) it was created for.
create or replace function public.builder_trade_immutable_keys() returns trigger language plpgsql as $$
declare k text;
begin
  foreach k in array array['contract_id', 'milestone_id', 'claim_id', 'job_id', 'contract_key'] loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      raise exception 'Trade payment key % is immutable', k using errcode = '23514';
    end if;
  end loop;
  return new;
end $$;

-- Structure is the manager's; completion, links and forecast dates may be kept current by staff.
-- An approved or paid milestone cannot be re-allocated or removed.
create or replace function public.builder_trade_milestone_guard() returns trigger language plpgsql as $$
declare v_locked boolean;
begin
  -- Rows removed by a cascade (the whole workspace going) are not a user edit.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  select exists (select 1 from public.builder_trade_contract_claims c where c.milestone_id = old.id and c.status = 'APPROVED') into v_locked;
  if tg_op = 'DELETE' then
    if v_locked then raise exception 'An approved or paid milestone cannot be removed' using errcode = '23514'; end if;
    return old;
  end if;
  if (new.percent, new.is_remainder, new.manual_amount, new.label, new.sort_order, new.milestone_key)
     is distinct from (old.percent, old.is_remainder, old.manual_amount, old.label, old.sort_order, old.milestone_key) then
    if not public.builder_trade_can_manage(new.workspace_id) then
      raise exception 'Only a contract manager can change a milestone allocation' using errcode = '42501';
    end if;
    if v_locked and (new.percent, new.is_remainder, new.manual_amount, new.milestone_key)
       is distinct from (old.percent, old.is_remainder, old.manual_amount, old.milestone_key) then
      raise exception 'An approved or paid milestone cannot be re-allocated' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

-- Claim: staff submit for completed work. Approval and rejection need a contract manager, signed in as a person, and are final.
create or replace function public.builder_trade_claim_guard() returns trigger language plpgsql as $$
declare v_complete boolean; v_ceiling numeric; v_approved numeric;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'CLAIMED' or new.approved_amount is not null or new.approved_by is not null or new.approved_at is not null then
      raise exception 'A claim starts as CLAIMED; approval is a separate action' using errcode = '23514';
    end if;
    select m.completion_status = 'COMPLETE' into v_complete from public.builder_trade_contract_milestones m
      where m.id = new.milestone_id and m.contract_id = new.contract_id and m.workspace_id = new.workspace_id;
    if v_complete is null then raise exception 'Milestone does not belong to this contract' using errcode = '23503'; end if;
    if not v_complete then raise exception 'The linked work is not complete' using errcode = '23514'; end if;
    new.claimed_by := auth.uid();
    return new;
  end if;
  if old.status <> 'CLAIMED' then raise exception 'A decided claim cannot be changed' using errcode = '23514'; end if;
  if new.status = 'CLAIMED' then
    if new.approved_amount is not null or new.approved_by is not null or new.approved_at is not null then
      raise exception 'Approval fields are set only by approving the claim' using errcode = '23514';
    end if;
    new.claimed_by := old.claimed_by;
    return new;
  end if;
  if auth.uid() is null or not public.builder_trade_can_manage(new.workspace_id) then
    raise exception 'Only a contract manager can approve or reject a claim' using errcode = '42501';
  end if;
  new.claimed_amount := old.claimed_amount; new.claimed_by := old.claimed_by; new.claimed_at := old.claimed_at;
  if new.status = 'REJECTED' then
    new.approved_amount := null; new.approved_by := auth.uid(); new.approved_at := now();
    return new;
  end if;
  new.approved_amount := coalesce(new.approved_amount, old.claimed_amount);
  select c.contract_amount + coalesce((select sum((v ->> 'amount')::numeric) from jsonb_array_elements(c.approved_variations) v), 0)
    into v_ceiling from public.builder_trade_contracts c where c.id = new.contract_id;
  select coalesce(sum(approved_amount), 0) into v_approved from public.builder_trade_contract_claims
    where contract_id = new.contract_id and status = 'APPROVED' and id <> new.id;
  if v_approved + new.approved_amount > v_ceiling then
    raise exception 'Approvals would exceed the contract plus approved variations' using errcode = '23514';
  end if;
  new.approved_by := auth.uid(); new.approved_at := now();
  return new;
end $$;

-- Payment: only a contract manager, only against an approved claim, never more than was approved, never taken back by an edit.
create or replace function public.builder_trade_invoice_guard() returns trigger language plpgsql as $$
declare v_status text; v_approved numeric; v_paid numeric; v_old_paid numeric := 0;
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    if old.paid_amount > 0 then raise exception 'A paid invoice cannot be removed' using errcode = '23514'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    v_old_paid := old.paid_amount;
    if old.paid_amount > 0 and (new.invoice_ref, new.amount) is distinct from (old.invoice_ref, old.amount) then
      raise exception 'A paid invoice cannot be re-written' using errcode = '23514';
    end if;
    if new.paid_amount < old.paid_amount then raise exception 'A recorded payment cannot be reduced' using errcode = '23514'; end if;
    new.created_by := old.created_by;
  else
    new.created_by := auth.uid();
  end if;
  select c.status, c.approved_amount into v_status, v_approved from public.builder_trade_contract_claims c where c.id = new.claim_id;
  if new.paid_amount is distinct from v_old_paid then
    if auth.uid() is null or not public.builder_trade_can_manage(new.workspace_id) then
      raise exception 'Only a contract manager can record a payment' using errcode = '42501';
    end if;
    if v_status is distinct from 'APPROVED' then raise exception 'Only an approved claim can be paid' using errcode = '23514'; end if;
    select coalesce(sum(paid_amount), 0) into v_paid from public.builder_trade_contract_invoices where claim_id = new.claim_id and id <> new.id;
    if v_paid + new.paid_amount > v_approved then raise exception 'Payment exceeds the approved amount' using errcode = '23514'; end if;
    new.paid_recorded_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.paid_recorded_by := old.paid_recorded_by; new.paid_date := old.paid_date;
  else
    new.paid_recorded_by := null;
  end if;
  return new;
end $$;

-- Master template revisions count every saved change; the client cannot choose or rewind the number.
create or replace function public.builder_trade_template_revision() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.revision := 1; else new.revision := old.revision + 1; end if;
  new.updated_by := auth.uid();
  return new;
end $$;

-- Every insert and update is recorded by the database, as the signed-in user, so history cannot be skipped or forged.
create or replace function public.builder_trade_audit_write() returns trigger language plpgsql security definer set search_path = public as $$
declare v_contract uuid;
begin
  v_contract := coalesce((to_jsonb(new) ->> 'contract_id')::uuid, new.id);
  insert into public.builder_trade_contract_audit (workspace_id, contract_id, source_table, source_id, action, actor_id, from_value, to_value)
  values (new.workspace_id, v_contract, tg_table_name, new.id, tg_op, auth.uid(), case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return null;
end $$;

-- Belt and braces behind the missing grants: history is never rewritten, by anyone, through SQL.
create or replace function public.builder_trade_audit_readonly() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception 'Trade payment audit history is append-only' using errcode = '42501';
end $$;

do $$
declare t text;
begin
  foreach t in array array['builder_trade_payment_templates', 'builder_trade_contracts', 'builder_trade_contract_milestones',
    'builder_trade_contract_claims', 'builder_trade_contract_invoices', 'builder_trade_contract_audit'] loop
    execute format('drop trigger if exists immutable_workspace on public.%I', t);
    execute format('create trigger immutable_workspace before update on public.%I for each row execute function public.builder_selection_immutable_workspace()', t);
  end loop;
  foreach t in array array['builder_trade_contracts', 'builder_trade_contract_milestones', 'builder_trade_contract_claims', 'builder_trade_contract_invoices'] loop
    execute format('drop trigger if exists immutable_keys on public.%I', t);
    execute format('create trigger immutable_keys before update on public.%I for each row execute function public.builder_trade_immutable_keys()', t);
    execute format('drop trigger if exists audit_write on public.%I', t);
    execute format('create trigger audit_write after insert or update on public.%I for each row execute function public.builder_trade_audit_write()', t);
  end loop;
  foreach t in array array['builder_trade_payment_templates', 'builder_trade_contracts', 'builder_trade_contract_milestones',
    'builder_trade_contract_claims', 'builder_trade_contract_invoices'] loop
    execute format('drop trigger if exists updated_at on public.%I', t);
    execute format('create trigger updated_at before update on public.%I for each row execute function public.builder_commercial_set_updated_at()', t);
  end loop;
end $$;

drop trigger if exists template_revision on public.builder_trade_payment_templates;
create trigger template_revision before insert or update on public.builder_trade_payment_templates for each row execute function public.builder_trade_template_revision();
drop trigger if exists milestone_guard on public.builder_trade_contract_milestones;
create trigger milestone_guard before update or delete on public.builder_trade_contract_milestones for each row execute function public.builder_trade_milestone_guard();
drop trigger if exists claim_guard on public.builder_trade_contract_claims;
create trigger claim_guard before insert or update on public.builder_trade_contract_claims for each row execute function public.builder_trade_claim_guard();
drop trigger if exists invoice_guard on public.builder_trade_contract_invoices;
create trigger invoice_guard before insert or update or delete on public.builder_trade_contract_invoices for each row execute function public.builder_trade_invoice_guard();
drop trigger if exists audit_readonly on public.builder_trade_contract_audit;
create trigger audit_readonly before update or delete on public.builder_trade_contract_audit for each row execute function public.builder_trade_audit_readonly();

-- ---- Row-level security -----------------------------------------------------------------------------------------------

do $$
declare t text; p record;
begin
  foreach t in array array['builder_trade_payment_templates', 'builder_trade_contracts', 'builder_trade_contract_milestones',
    'builder_trade_contract_claims', 'builder_trade_contract_invoices', 'builder_trade_contract_audit'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('revoke all on public.%I from anon, authenticated, public', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy tenant_read on public.%I for select to authenticated using (public.builder_commercial_is_workspace_member(workspace_id))', t);
  end loop;
end $$;

grant insert, update, delete on public.builder_trade_payment_templates to authenticated;
create policy template_write on public.builder_trade_payment_templates for all to authenticated
  using (public.builder_selection_is_config_admin(workspace_id)) with check (public.builder_selection_is_config_admin(workspace_id));

grant insert, update, delete on public.builder_trade_contracts to authenticated;
create policy contract_write on public.builder_trade_contracts for all to authenticated
  using (public.builder_trade_can_manage(workspace_id)) with check (public.builder_trade_can_manage(workspace_id));

grant insert, update, delete on public.builder_trade_contract_milestones to authenticated;
create policy milestone_insert on public.builder_trade_contract_milestones for insert to authenticated
  with check (public.builder_trade_can_manage(workspace_id));
create policy milestone_delete on public.builder_trade_contract_milestones for delete to authenticated
  using (public.builder_trade_can_manage(workspace_id));
create policy milestone_update on public.builder_trade_contract_milestones for update to authenticated
  using (public.builder_trade_can_claim(workspace_id)) with check (public.builder_trade_can_claim(workspace_id));

-- Claims are never deleted; a wrong claim is rejected.
grant insert, update on public.builder_trade_contract_claims to authenticated;
create policy claim_insert on public.builder_trade_contract_claims for insert to authenticated
  with check (public.builder_trade_can_claim(workspace_id));
create policy claim_update on public.builder_trade_contract_claims for update to authenticated
  using (public.builder_trade_can_claim(workspace_id)) with check (public.builder_trade_can_claim(workspace_id));

grant insert, update, delete on public.builder_trade_contract_invoices to authenticated;
create policy invoice_insert on public.builder_trade_contract_invoices for insert to authenticated
  with check (public.builder_trade_can_claim(workspace_id));
create policy invoice_update on public.builder_trade_contract_invoices for update to authenticated
  using (public.builder_trade_can_claim(workspace_id)) with check (public.builder_trade_can_claim(workspace_id));
create policy invoice_delete on public.builder_trade_contract_invoices for delete to authenticated
  using (public.builder_trade_can_manage(workspace_id));

-- builder_trade_contract_audit: select only. No write policy and no write grant exists for any client role.

notify pgrst, 'reload schema';
commit;
