create table if not exists founding_growth_partner_enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agency_name text not null,
  contact_name text not null,
  position text,
  email text not null,
  phone text,
  website text,
  country text not null,
  saas_experience text,
  message text not null,
  preferred_meeting_timing text not null,
  consent boolean not null default false,
  agency_slug text,
  source_path text not null default '/founding-growth-partner',
  ip_address text,
  user_agent text,
  status text not null default 'new'
);

create index if not exists founding_growth_partner_enquiries_created_at_idx
  on founding_growth_partner_enquiries (created_at desc);

create index if not exists founding_growth_partner_enquiries_email_idx
  on founding_growth_partner_enquiries (email);

alter table founding_growth_partner_enquiries enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'founding_growth_partner_enquiries'
      and policyname = 'Service role can manage founding growth partner enquiries'
  ) then
    create policy "Service role can manage founding growth partner enquiries"
      on founding_growth_partner_enquiries
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
