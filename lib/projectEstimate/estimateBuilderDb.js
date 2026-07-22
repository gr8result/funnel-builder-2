// lib/projectEstimate/estimateBuilderDb.js
//
// Shared persistence helpers for the Project Estimate multi-user page
// builder (estimate_templates / estimate_template_pages /
// estimate_template_versions / project_estimate_instances /
// project_estimate_instance_pages — see
// supabase/migrations/20260722_project_estimate_builder.sql).
//
// A page row's `blocks` column may be null, meaning "this page has no
// persisted overrides — resolve its content from the compiled
// ProjectEstimateRegistry defaults for its page_type at render time."
// That resolution happens client-side (see ProjectEstimateApiClient.ts),
// not here — this module only ever stores/returns whatever it is given.

import { supabaseAdmin } from "../supabaseAdmin";

export function shapePageRowForClient(row) {
  return {
    id: row.id,
    pageKey: row.page_key,
    pageName: row.page_name,
    pageType: row.page_type,
    pageOrder: row.page_order,
    width: row.width,
    height: row.height,
    orientation: row.orientation,
    background: row.background || {},
    importedDocument: row.imported_document || null,
    blocks: row.blocks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function shapeClientPageForRow(page, index, ownerIdColumn, ownerId) {
  return {
    [ownerIdColumn]: ownerId,
    page_key: String(page.pageKey || page.page_type || page.pageType || page.id || `page-${index}`),
    page_name: String(page.pageName || page.title || page.navigationTitle || page.pageKey || `Page ${index + 1}`),
    page_type: String(page.pageType || page.page_type || page.pageKey || ""),
    page_order: Number.isFinite(page.pageOrder) ? page.pageOrder : index,
    width: Number(page.width) || 794,
    height: Number(page.height) || 1123,
    orientation: page.orientation === "landscape" ? "landscape" : "portrait",
    background: page.background || {},
    imported_document: page.importedDocument || null,
    blocks: page.blocks === undefined ? null : page.blocks,
  };
}

export function shapeTemplateRowForClient(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ownerUserId: row.owner_user_id,
    templateName: row.template_name,
    description: row.description,
    isSystemDefault: row.is_system_default,
    isOrganisationDefault: row.is_organisation_default,
    pageOrder: row.page_order || [],
    settings: row.settings || {},
    version: row.version,
    sourceTemplateId: row.source_template_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function shapeInstanceRowForClient(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    templateId: row.template_id,
    ownerUserId: row.owner_user_id,
    pageOrder: row.page_order || [],
    settings: row.settings || {},
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchTemplateWithPages(templateId) {
  const { data: template, error: templateError } = await supabaseAdmin
    .from("estimate_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  if (templateError) throw templateError;
  if (!template) return null;

  const { data: pages, error: pagesError } = await supabaseAdmin
    .from("estimate_template_pages")
    .select("*")
    .eq("template_id", templateId)
    .order("page_order", { ascending: true });
  if (pagesError) throw pagesError;

  return {
    ...shapeTemplateRowForClient(template),
    pages: (pages || []).map(shapePageRowForClient),
  };
}

export async function replaceTemplatePages(templateId, pages = []) {
  const { error: deleteError } = await supabaseAdmin
    .from("estimate_template_pages")
    .delete()
    .eq("template_id", templateId);
  if (deleteError) throw deleteError;

  if (!pages.length) return [];
  const rows = pages.map((page, index) => shapeClientPageForRow(page, index, "template_id", templateId));
  const { data, error: insertError } = await supabaseAdmin
    .from("estimate_template_pages")
    .insert(rows)
    .select("*");
  if (insertError) throw insertError;
  return (data || []).sort((a, b) => a.page_order - b.page_order).map(shapePageRowForClient);
}

export async function fetchInstanceWithPages(instanceId) {
  const { data: instance, error: instanceError } = await supabaseAdmin
    .from("project_estimate_instances")
    .select("*")
    .eq("id", instanceId)
    .maybeSingle();
  if (instanceError) throw instanceError;
  if (!instance) return null;

  const { data: pages, error: pagesError } = await supabaseAdmin
    .from("project_estimate_instance_pages")
    .select("*")
    .eq("instance_id", instanceId)
    .order("page_order", { ascending: true });
  if (pagesError) throw pagesError;

  return {
    ...shapeInstanceRowForClient(instance),
    pages: (pages || []).map(shapePageRowForClient),
  };
}

export async function replaceInstancePages(instanceId, pages = []) {
  const { error: deleteError } = await supabaseAdmin
    .from("project_estimate_instance_pages")
    .delete()
    .eq("instance_id", instanceId);
  if (deleteError) throw deleteError;

  if (!pages.length) return [];
  const rows = pages.map((page, index) => shapeClientPageForRow(page, index, "instance_id", instanceId));
  const { data, error: insertError } = await supabaseAdmin
    .from("project_estimate_instance_pages")
    .insert(rows)
    .select("*");
  if (insertError) throw insertError;
  return (data || []).sort((a, b) => a.page_order - b.page_order).map(shapePageRowForClient);
}

export async function nextTemplateVersionNumber(templateId) {
  const { data, error } = await supabaseAdmin
    .from("estimate_template_versions")
    .select("version_number")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.version_number || 0) + 1;
}

export async function createTemplateVersionSnapshot({ templateId, label, createdBy }) {
  const template = await fetchTemplateWithPages(templateId);
  if (!template) throw new Error("Template not found");
  const versionNumber = await nextTemplateVersionNumber(templateId);
  const { data, error } = await supabaseAdmin
    .from("estimate_template_versions")
    .insert({
      template_id: templateId,
      version_number: versionNumber,
      label: label || "",
      snapshot: template,
      created_by: createdBy || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
