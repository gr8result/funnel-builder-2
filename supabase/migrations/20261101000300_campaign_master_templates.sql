-- Campaign documents share the existing catalogue without converting their originals to HTML.
alter table public.funnels
  add column if not exists template_kind text not null default 'funnel',
  add column if not exists template_payload jsonb,
  add column if not exists template_source_campaign_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'funnels_template_payload_shape') then
    alter table public.funnels add constraint funnels_template_payload_shape check (
      (template_kind = 'funnel' and template_payload is null and template_source_campaign_id is null)
      or (template_kind = 'campaign' and is_master_template and template_source_campaign_id is not null and template_payload is not null
          and jsonb_typeof(template_payload) = 'object')
    );
  end if;
end $$;

create unique index if not exists funnels_campaign_master_source_idx
  on public.funnels (workspace_id, template_source_campaign_id)
  where template_kind = 'campaign';

create or replace function public.guard_funnel_master_template_fields()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and old.template_kind = 'campaign' and (
    new.template_payload is distinct from old.template_payload
    or new.template_source_campaign_id is distinct from old.template_source_campaign_id
    or new.template_kind is distinct from old.template_kind
  ) then
    raise exception 'Campaign master snapshots are immutable' using errcode = '42501';
  end if;
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      if new.is_master_template or new.template_description is not null or new.template_thumbnail is not null
        or new.template_kind <> 'funnel' or new.template_payload is not null or new.template_source_campaign_id is not null then
        raise exception 'Master template metadata must be managed through the authenticated Funnel Builder API'
          using errcode = '42501';
      end if;
    elsif new.is_master_template is distinct from old.is_master_template
      or new.template_description is distinct from old.template_description
      or new.template_thumbnail is distinct from old.template_thumbnail
      or new.template_kind is distinct from old.template_kind
      or new.template_payload is distinct from old.template_payload
      or new.template_source_campaign_id is distinct from old.template_source_campaign_id then
      raise exception 'Master template metadata must be managed through the authenticated Funnel Builder API'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

alter table public.landing_campaigns
  add column if not exists template_origin_id uuid references public.funnels(id) on delete set null,
  add column if not exists template_clone_request_id uuid;
create unique index if not exists landing_campaigns_template_clone_request_idx
  on public.landing_campaigns (workspace_id, created_by, template_clone_request_id)
  where template_clone_request_id is not null;

create or replace function public.lp_remap_template_links(p_value jsonb, p_slugs jsonb)
returns jsonb language plpgsql immutable set search_path = pg_catalog, public as $$
declare result jsonb; pair record; item jsonb; text_value text;
begin
  if jsonb_typeof(p_value) = 'object' then
    result := '{}'::jsonb;
    for pair in select * from jsonb_each(p_value) loop
      result := result || jsonb_build_object(pair.key, public.lp_remap_template_links(pair.value, p_slugs));
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    result := '[]'::jsonb;
    for item in select value from jsonb_array_elements(p_value) loop
      result := result || jsonb_build_array(public.lp_remap_template_links(item, p_slugs));
    end loop;
  elsif jsonb_typeof(p_value) = 'string' then
    text_value := p_value #>> '{}';
    for pair in select * from jsonb_each_text(p_slugs) loop
      if text_value = pair.key or left(text_value, length(pair.key) + 1) in (pair.key || '?', pair.key || '#') then
        return to_jsonb(pair.value || substr(text_value, length(pair.key) + 1));
      end if;
    end loop;
    result := p_value;
  else
    result := p_value;
  end if;
  return result;
end $$;
revoke all on function public.lp_remap_template_links(jsonb, jsonb) from public, anon, authenticated;

create or replace function public.lp_clone_master_template(
  p_template_id uuid, p_workspace_id uuid, p_user_id uuid, p_name text, p_request_id uuid, p_contact_email text default null
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  template public.funnels%rowtype;
  campaign public.landing_campaigns%rowtype;
  page jsonb; page_ids jsonb := '[]'::jsonb; new_pages jsonb := '[]'::jsonb;
  slug_map jsonb := '{}'::jsonb; page_id uuid; page_slug text; doc jsonb; clean_name text;
begin
  if p_request_id is null or not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_user_id and status = 'active'
  ) then
    raise exception 'Active workspace membership and a clone request ID are required' using errcode = '42501';
  end if;
  select * into template from public.funnels
    where id = p_template_id and is_master_template and template_kind = 'campaign';
  if not found then raise exception 'Campaign master template not found' using errcode = 'P0002'; end if;
  clean_name := left(btrim(p_name), 160);
  if clean_name is null or clean_name = '' then raise exception 'Campaign name is required' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || p_user_id::text || p_request_id::text, 0));
  select * into campaign from public.landing_campaigns
    where workspace_id = p_workspace_id and created_by = p_user_id and template_clone_request_id = p_request_id;
  if found then
    if campaign.template_origin_id is distinct from p_template_id then
      raise exception 'Clone request ID belongs to another template' using errcode = '22023';
    end if;
    select detail->'pageIds' into page_ids from public.landing_audit_log
      where workspace_id = p_workspace_id and entity_id = campaign.id and action = 'template_cloned'
      order by created_at limit 1;
    if page_ids is null then raise exception 'Clone receipt is unavailable' using errcode = '22023'; end if;
    return jsonb_build_object('campaign', jsonb_build_object('id', campaign.id, 'name', campaign.name), 'pageIds', page_ids);
  end if;
  if jsonb_typeof(template.template_payload->'pages') is distinct from 'array'
    or jsonb_array_length(template.template_payload->'pages') = 0 then
    raise exception 'Campaign template has no pages' using errcode = '22023';
  end if;
  insert into public.landing_campaigns (workspace_id, created_by, name, status, brief, interview, template_origin_id, template_clone_request_id)
  values (p_workspace_id, p_user_id, clean_name, 'draft',
    coalesce(template.template_payload->'brief', '{}'::jsonb) || jsonb_build_object('campaignName', clean_name, 'email', coalesce(p_contact_email, '')),
    coalesce(template.template_payload->'interview', '{}'::jsonb), p_template_id, p_request_id)
  returning * into campaign;
  for page in select value from jsonb_array_elements(template.template_payload->'pages') loop
    page_id := gen_random_uuid();
    page_slug := 'template-' || replace(page_id::text, '-', '');
    page_ids := page_ids || jsonb_build_array(page_id);
    new_pages := new_pages || jsonb_build_array(page || jsonb_build_object('id', page_id, 'slug', page_slug));
    if coalesce(page->>'sourceSlug', '') <> '' then
      slug_map := slug_map || jsonb_build_object('/lp/' || (page->>'sourceSlug'), '/lp/' || page_slug);
    end if;
  end loop;
  for page in select value from jsonb_array_elements(new_pages) loop
    doc := public.lp_remap_template_links(page->'document', slug_map);
    if jsonb_typeof(doc->'sections') is distinct from 'array' or jsonb_array_length(doc->'sections') = 0 then
      raise exception 'Campaign template page has no sections' using errcode = '22023';
    end if;
    doc := jsonb_set(doc, '{brand,email}', to_jsonb(coalesce(p_contact_email, '')), true);
    page_id := (page->>'id')::uuid;
    insert into public.landing_pages (id, workspace_id, campaign_id, created_by, title, slug, status, document)
      values (page_id, p_workspace_id, campaign.id, p_user_id, left(coalesce(page->>'title', 'Landing page'), 160), page->>'slug', 'draft', doc);
    insert into public.landing_page_versions (workspace_id, page_id, version_no, kind, label, document, created_by)
      values (p_workspace_id, page_id, 1, 'save', 'Created from master template', doc, p_user_id);
  end loop;
  insert into public.landing_audit_log (workspace_id, entity, entity_id, action, detail, actor)
    values (p_workspace_id, 'campaign', campaign.id, 'template_cloned', jsonb_build_object('templateId', p_template_id, 'pageIds', page_ids), p_user_id);
  return jsonb_build_object('campaign', jsonb_build_object('id', campaign.id, 'name', campaign.name), 'pageIds', page_ids);
end $$;
revoke all on function public.lp_clone_master_template(uuid, uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.lp_clone_master_template(uuid, uuid, uuid, text, uuid, text) to service_role;
