-- Client Portal operational layer for Project Workspace.
-- Additive only: keeps builder_commercial_projects and related modules as source records.

create extension if not exists pgcrypto;

create table if not exists public.client_portal_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  portal_enabled boolean not null default false,
  access_suspended boolean not null default false,
  status text not null default 'not_set_up'
    check (status in ('not_set_up', 'invitation_not_sent', 'invitation_sent', 'client_activated', 'access_suspended')),
  enabled_sections jsonb not null default '{
    "overview": true,
    "documents": true,
    "selections": true,
    "variations": true,
    "progress": true,
    "messages": true,
    "approvals": true
  }'::jsonb,
  visibility jsonb not null default '{
    "commencementDate": false,
    "completionDate": false,
    "progressPercentage": false,
    "currentStage": true,
    "upcomingMilestones": false,
    "supervisorDetails": false,
    "projectEstimate": false,
    "formalQuote": false,
    "contractValue": false,
    "progressPayments": false
  }'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  last_invitation_sent_at timestamptz,
  last_client_login_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, project_id),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade
);

create table if not exists public.client_portal_clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  client_name text not null default '',
  client_email text not null,
  status text not null default 'invitation_not_sent'
    check (status in ('invitation_not_sent', 'invited', 'active', 'suspended', 'revoked')),
  last_invitation_sent_at timestamptz,
  last_login_at timestamptz,
  accepted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade
);

create table if not exists public.client_portal_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  client_id uuid references public.client_portal_clients(id) on delete cascade,
  recipient_name text not null default '',
  recipient_email text not null,
  token_hash text not null unique,
  status text not null default 'created'
    check (status in ('created', 'sent', 'accepted', 'expired', 'revoked')),
  sent_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  sent_by uuid references auth.users(id) on delete set null,
  accepted_user_id uuid references auth.users(id) on delete set null,
  email_preview jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade
);

create table if not exists public.client_portal_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  parent_message_id uuid references public.client_portal_messages(id) on delete set null,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_name text not null default '',
  sender_role text not null default 'client' check (sender_role in ('client', 'builder')),
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  read_by jsonb not null default '{}'::jsonb,
  status text not null default 'sent' check (status in ('sent', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade
);

create table if not exists public.client_portal_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  related_table text,
  related_record_id uuid,
  item_title text not null,
  approval_type text not null default 'other',
  date_issued timestamptz not null default now(),
  due_date timestamptz,
  status text not null default 'awaiting_client'
    check (status in ('not_issued', 'awaiting_client', 'viewed', 'changes_requested', 'approved', 'rejected', 'superseded')),
  view_url text,
  allow_reject boolean not null default true,
  requires_signature boolean not null default false,
  response_comment text,
  response_name text,
  response_user_id uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  response_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, project_id, related_table, related_record_id, approval_type),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade
);

create table if not exists public.client_portal_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  user_role text not null default 'unknown',
  action text not null,
  related_table text,
  related_record_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (project_id, workspace_id)
    references public.builder_commercial_projects(id, workspace_id) on delete cascade
);

alter table public.builder_project_documents
  add column if not exists client_visible boolean not null default false,
  add column if not exists client_category text,
  add column if not exists client_version text,
  add column if not exists client_published_at timestamptz,
  add column if not exists requires_client_approval boolean not null default false,
  add column if not exists requires_client_signature boolean not null default false,
  add column if not exists client_download_allowed boolean not null default true,
  add column if not exists client_status text not null default 'not_published';

alter table public.builder_client_selections
  add column if not exists client_visible boolean not null default false,
  add column if not exists client_status text,
  add column if not exists client_published_at timestamptz,
  add column if not exists client_approved_at timestamptz,
  add column if not exists client_approved_by uuid references auth.users(id) on delete set null;

alter table public.builder_variations
  add column if not exists client_visible boolean not null default false,
  add column if not exists client_status text,
  add column if not exists client_published_at timestamptz,
  add column if not exists requires_client_approval boolean not null default false,
  add column if not exists client_approved_at timestamptz,
  add column if not exists client_approved_by uuid references auth.users(id) on delete set null;

alter table public.gantt_tasks
  add column if not exists client_visible boolean not null default false,
  add column if not exists client_update text,
  add column if not exists client_expected_date date;

create index if not exists client_portal_settings_project_idx on public.client_portal_settings(workspace_id, project_id);
create index if not exists client_portal_clients_project_idx on public.client_portal_clients(workspace_id, project_id);
create index if not exists client_portal_clients_user_idx on public.client_portal_clients(user_id);
create unique index if not exists client_portal_clients_project_email_uidx
  on public.client_portal_clients(workspace_id, project_id, lower(client_email));
create index if not exists client_portal_invitations_project_idx on public.client_portal_invitations(workspace_id, project_id);
create index if not exists client_portal_messages_project_idx on public.client_portal_messages(workspace_id, project_id, created_at);
create index if not exists client_portal_approvals_project_idx on public.client_portal_approvals(workspace_id, project_id, status);
create index if not exists client_portal_audit_project_idx on public.client_portal_audit_events(workspace_id, project_id, created_at desc);
create index if not exists builder_project_documents_client_visible_idx on public.builder_project_documents(workspace_id, project_id, client_visible);
create index if not exists builder_client_selections_client_visible_idx on public.builder_client_selections(workspace_id, project_id, client_visible);
create index if not exists builder_variations_client_visible_idx on public.builder_variations(workspace_id, project_id, client_visible);
