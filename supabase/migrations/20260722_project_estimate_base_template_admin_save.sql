-- Admin-only transactional replacement for the active Project Estimate system
-- base template. This function is intended to be called only by the
-- service-role backed API after platform-admin auth has succeeded.

create or replace function public.replace_project_estimate_system_base_template(
  p_pages jsonb,
  p_page_order jsonb,
  p_settings jsonb,
  p_updated_by uuid,
  p_version_label text default 'Updated base template'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.estimate_templates%rowtype;
  v_template_id uuid;
  v_next_version integer;
  v_page jsonb;
  v_index integer := 0;
begin
  if jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) = 0 then
    raise exception 'Base template pages must be a non-empty array';
  end if;

  select *
    into v_template
    from public.estimate_templates
   where is_system_default = true
   order by created_at asc
   limit 1
   for update;

  if not found then
    insert into public.estimate_templates (
      workspace_id, owner_user_id, template_name, description,
      is_system_default, is_organisation_default, page_order, settings, version
    ) values (
      null, null, 'Approved Project Estimate', 'Protected system default Project Estimate template.',
      true, false, coalesce(p_page_order, '[]'::jsonb), coalesce(p_settings, '{}'::jsonb), 1
    )
    returning * into v_template;
  end if;

  v_template_id := v_template.id;
  v_next_version := coalesce(v_template.version, 1) + 1;

  insert into public.estimate_template_versions (
    template_id,
    version_number,
    label,
    snapshot,
    created_by
  )
  values (
    v_template_id,
    coalesce((
      select max(version_number) + 1
      from public.estimate_template_versions
      where template_id = v_template_id
    ), 1),
    coalesce(nullif(p_version_label, ''), 'Before base template update'),
    jsonb_build_object(
      'id', v_template.id,
      'workspaceId', v_template.workspace_id,
      'ownerUserId', v_template.owner_user_id,
      'templateName', v_template.template_name,
      'description', v_template.description,
      'isSystemDefault', v_template.is_system_default,
      'isOrganisationDefault', v_template.is_organisation_default,
      'pageOrder', v_template.page_order,
      'settings', v_template.settings,
      'version', v_template.version,
      'sourceTemplateId', v_template.source_template_id,
      'createdAt', v_template.created_at,
      'updatedAt', v_template.updated_at,
      'pages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'pageKey', p.page_key,
          'pageName', p.page_name,
          'pageType', p.page_type,
          'pageOrder', p.page_order,
          'width', p.width,
          'height', p.height,
          'orientation', p.orientation,
          'background', p.background,
          'importedDocument', p.imported_document,
          'blocks', p.blocks,
          'createdAt', p.created_at,
          'updatedAt', p.updated_at
        ) order by p.page_order)
        from public.estimate_template_pages p
        where p.template_id = v_template_id
      ), '[]'::jsonb)
    ),
    p_updated_by
  );

  delete from public.estimate_template_pages
   where template_id = v_template_id;

  for v_page in select * from jsonb_array_elements(p_pages)
  loop
    insert into public.estimate_template_pages (
      template_id,
      page_key,
      page_name,
      page_type,
      page_order,
      width,
      height,
      orientation,
      background,
      imported_document,
      blocks
    )
    values (
      v_template_id,
      coalesce(nullif(v_page->>'pageKey', ''), nullif(v_page->>'pageType', ''), 'page-' || v_index),
      coalesce(nullif(v_page->>'pageName', ''), nullif(v_page->>'pageKey', ''), 'Page ' || (v_index + 1)),
      coalesce(nullif(v_page->>'pageType', ''), nullif(v_page->>'pageKey', '')),
      coalesce((v_page->>'pageOrder')::integer, v_index),
      coalesce((v_page->>'width')::integer, 794),
      coalesce((v_page->>'height')::integer, 1123),
      case when v_page->>'orientation' = 'landscape' then 'landscape' else 'portrait' end,
      coalesce(v_page->'background', '{}'::jsonb),
      null,
      case when jsonb_typeof(v_page->'blocks') = 'array' then v_page->'blocks' else null end
    );
    v_index := v_index + 1;
  end loop;

  update public.estimate_templates
     set page_order = coalesce(p_page_order, '[]'::jsonb),
         settings = coalesce(p_settings, '{}'::jsonb),
         version = v_next_version,
         updated_at = now()
   where id = v_template_id;

  return jsonb_build_object(
    'templateId', v_template_id,
    'version', v_next_version,
    'pageCount', jsonb_array_length(p_pages)
  );
end;
$$;

grant execute on function public.replace_project_estimate_system_base_template(jsonb, jsonb, jsonb, uuid, text) to service_role;
