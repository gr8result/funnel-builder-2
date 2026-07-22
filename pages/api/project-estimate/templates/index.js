// GET  /api/project-estimate/templates?workspace_id=...
//      List templates visible to the workspace: the protected system
//      default (workspace_id is null) plus every template owned by this
//      workspace. Page bodies are NOT included here (list view only).
//
// POST /api/project-estimate/templates
//      Create a new organisation template. Body: { workspace_id, templateName,
//      description?, pageOrder?, settings?, pages?, setAsOrganisationDefault? }
//      `pages` (if provided) must already be fully materialized by the client
//      (see ProjectEstimateApiClient.ts) — this endpoint never resolves
//      registry defaults itself.

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import {
  replaceTemplatePages,
  shapeTemplateRowForClient,
  createTemplateVersionSnapshot,
} from "../../../../lib/projectEstimate/estimateBuilderDb";

async function clearOrganisationDefault(workspaceId) {
  const { error } = await supabaseAdmin
    .from("estimate_templates")
    .update({ is_organisation_default: false })
    .eq("workspace_id", workspaceId)
    .eq("is_organisation_default", true);
  if (error) throw error;
}

async function handler(req, res) {
  const { workspaceId, user } = req;

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("estimate_templates")
      .select("*")
      .or(`is_system_default.eq.true,workspace_id.eq.${workspaceId}`)
      .order("is_system_default", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, templates: (data || []).map(shapeTemplateRowForClient) });
  }

  if (req.method === "POST") {
    const templateName = String(req.body?.templateName || "").trim();
    if (!templateName) return res.status(400).json({ ok: false, error: "templateName is required" });

    const pages = Array.isArray(req.body?.pages) ? req.body.pages : [];
    const pageOrder = Array.isArray(req.body?.pageOrder) && req.body.pageOrder.length
      ? req.body.pageOrder
      : pages.map((page) => page.pageKey || page.pageType);

    const { data: template, error: insertError } = await supabaseAdmin
      .from("estimate_templates")
      .insert({
        workspace_id: workspaceId,
        owner_user_id: user.id,
        template_name: templateName,
        description: String(req.body?.description || ""),
        is_system_default: false,
        is_organisation_default: false,
        page_order: pageOrder,
        settings: req.body?.settings || {},
        version: 1,
        source_template_id: req.body?.sourceTemplateId || null,
      })
      .select("*")
      .single();
    if (insertError) return res.status(500).json({ ok: false, error: insertError.message });

    try {
      const savedPages = await replaceTemplatePages(template.id, pages);
      if (req.body?.setAsOrganisationDefault) {
        await clearOrganisationDefault(workspaceId);
        await supabaseAdmin.from("estimate_templates").update({ is_organisation_default: true }).eq("id", template.id);
      }
      await createTemplateVersionSnapshot({ templateId: template.id, label: "Initial version", createdBy: user.id });
      const { data: finalTemplate } = await supabaseAdmin.from("estimate_templates").select("*").eq("id", template.id).single();
      return res.status(200).json({ ok: true, template: shapeTemplateRowForClient(finalTemplate || template), pages: savedPages });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error?.message || "Could not save template pages" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

export default withWorkspace(handler);
