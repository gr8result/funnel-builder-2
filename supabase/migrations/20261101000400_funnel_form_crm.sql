alter table public.form_submissions
  add column if not exists workspace_id uuid,
  add column if not exists submission_key uuid,
  add column if not exists crm_lead_id uuid,
  add column if not exists crm_note_id uuid,
  add column if not exists crm_synced_at timestamptz,
  add column if not exists crm_attempts integer not null default 0,
  add column if not exists crm_error text;

create unique index if not exists form_submissions_funnel_request_idx
  on public.form_submissions (funnel_id, step_id, submission_key)
  where submission_key is not null;
create index if not exists form_submissions_funnel_retry_idx
  on public.form_submissions (id)
  where submission_key is not null and crm_synced_at is null;

alter table public.form_submissions enable row level security;
revoke all on public.form_submissions from public, anon, authenticated;
grant select on public.form_submissions to authenticated;
grant all on public.form_submissions to service_role;
drop policy if exists form_submissions_owner_read on public.form_submissions;
drop policy if exists form_submissions_owner_guard on public.form_submissions;
create policy form_submissions_owner_read on public.form_submissions for select to authenticated
  using (user_id = auth.uid() and (workspace_id is null or public.current_user_is_active_workspace_member(workspace_id)));
create policy form_submissions_owner_guard on public.form_submissions as restrictive for all to authenticated
  using (user_id = auth.uid() and (workspace_id is null or public.current_user_is_active_workspace_member(workspace_id)))
  with check (false);

create or replace function public.funnel_sync_submission(p_submission_id uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare submission public.form_submissions%rowtype; v_lead_id uuid; v_note_id uuid; email_lower text; label text;
begin
  select * into submission from public.form_submissions where id = p_submission_id for update;
  if not found or submission.submission_key is null or submission.workspace_id is null or submission.user_id is null then
    raise exception 'Scoped funnel submission not found' using errcode = 'P0002';
  end if;
  if submission.crm_synced_at is not null then return submission.crm_lead_id; end if;
  begin
    email_lower := lower(btrim(submission.email));
    perform pg_advisory_xact_lock(hashtextextended(submission.workspace_id::text || submission.user_id::text || email_lower, 0));
    select id into v_lead_id from public.leads
      where workspace_id = submission.workspace_id and user_id = submission.user_id and lower(btrim(email)) = email_lower
      order by created_at, id limit 1;
    label := coalesce(nullif(submission.payload->>'funnel_name', ''), 'Funnel enquiry');
    if v_lead_id is null then
      insert into public.leads (workspace_id,user_id,name,email,phone,source,lead_source,tags,lead_status)
        values (submission.workspace_id,submission.user_id,submission.name,email_lower,
          submission.payload->'fields'->>'phone','Funnel','Funnel: ' || label,
          'funnel,funnel:' || submission.funnel_id::text,'new')
        returning id into v_lead_id;
    end if;
    insert into public.lead_notes (lead_id,user_id,note)
      values (v_lead_id,submission.user_id,'Funnel enquiry: ' || label || E'\n' ||
        coalesce(jsonb_pretty(submission.payload->'fields'), '{}'))
      returning id into v_note_id;
    update public.form_submissions set crm_lead_id=v_lead_id,crm_note_id=v_note_id,
      crm_synced_at=now(),crm_attempts=crm_attempts+1,crm_error=null where id=submission.id;
    return v_lead_id;
  exception when others then
    update public.form_submissions set crm_attempts=crm_attempts+1,crm_error=left(sqlerrm,2000) where id=submission.id;
    raise warning 'Funnel CRM sync failed for submission %: %', submission.id, sqlerrm;
    return null;
  end;
end $$;
revoke all on function public.funnel_sync_submission(uuid) from public, anon, authenticated;
grant execute on function public.funnel_sync_submission(uuid) to service_role;
