-- Create automation_email_queue table for automation email processing
-- Columns align with tick engine and flush-queue usage

create table if not exists public.automation_email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  flow_id uuid not null,
  node_id text not null,
  lead_id uuid not null,
  to_email text not null,
  subject text,
  html_content text,
  variant text,
  status text not null default 'pending',
  last_error text,
  sendgrid_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz
);

-- Helpful indexes
create index if not exists idx_automation_email_queue_flow_node on public.automation_email_queue(flow_id, node_id);
create index if not exists idx_automation_email_queue_status on public.automation_email_queue(status);
create index if not exists idx_automation_email_queue_lead on public.automation_email_queue(lead_id);
create index if not exists idx_automation_email_queue_sent_at on public.automation_email_queue(sent_at);
create index if not exists idx_automation_email_queue_opened_at on public.automation_email_queue(opened_at);
