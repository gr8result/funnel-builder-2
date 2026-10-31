-- REVIEW ONLY. Do not apply.
-- MERGED 2026-10-15 into central_contacts_migration_draft.sql ("Lead-row consent projection").
-- The columns below are now created there and kept in step with contact_consent_events by a trigger.
-- Kept for reference only.

alter table public.leads
  add column if not exists email_marketing_consent boolean not null default false,
  add column if not exists email_marketing_consent_at timestamptz,
  add column if not exists email_marketing_consent_source text,
  add column if not exists email_marketing_opt_out boolean not null default false,
  add column if not exists email_marketing_opt_out_at timestamptz,
  add column if not exists sms_marketing_consent boolean not null default false,
  add column if not exists sms_marketing_consent_at timestamptz,
  add column if not exists sms_marketing_consent_source text,
  add column if not exists sms_marketing_opt_out boolean not null default false,
  add column if not exists sms_marketing_opt_out_at timestamptz;

create index if not exists leads_workspace_email_marketing_consent_idx
  on public.leads (workspace_id, email)
  where email_marketing_consent = true and email_marketing_opt_out = false;

create index if not exists leads_workspace_sms_marketing_consent_idx
  on public.leads (workspace_id, id)
  where sms_marketing_consent = true and sms_marketing_opt_out = false;