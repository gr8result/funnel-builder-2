// GET   /api/project-estimate/templates/:id   Fetch template + pages
// PATCH /api/project-estimate/templates/:id   Rename / update settings /
//        replace pages / set-as-organisation-default. Rejects any write to
//        a system-default (protected) template with 403.
// DELETE /api/project-estimate/templates/:id  Delete an organisation
//        template. Rejects system-default with 403.

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import {
  fetchTemplateWithPages,
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

async function loadAuthorizedTemplate(id, workspaceId) {
  const { data, error } = await supabaseAdmin.from("estimate_templates").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.is_system_default) return data;
  if (data.workspace_id !== workspaceId) return "forbidden";
  return data;
}

async function handler(req, res) {
  const { workspaceId, user } = req;
  const id = String(req.query.id || "");
  if (!id) return res.status(400).json({ ok: false, error: "Template id is required" });

  const existing = await loadAuthorizedTemplate(id, workspaceId).catch((error) => {
    res.status(500).json({ ok: false, error: error?.message || "Could not load template" });
    return "errored";
  });
  if (existing === "errored") return;
  if (!existing) return res.status(404).json({ ok: false, error: "Template not found" });
  if (existing === "forbidden") return res.status(403).json({ ok: false, error: "You do not have access to this template" });

  if (req.method === "GET") {
    try {
      const template = await fetchTemplateWithPages(id);
      return res.status(200).json({ ok: true, template });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error?.message || "Could not load template" });
    }
  }

  if (req.method === "PATCH") {
    if (existing.is_system_default) {
      return res.status(403).json({ ok: false, error: "The system default template is protected and cannot be edited. Save it as your own template first." });
    }

    const updates = {};
    if (typeof req.body?.templateName === "string" && req.body.templateName.trim()) updates.template_name = req.body.templateName.trim();
    if (typeof req.body?.description === "string") updates.description = req.body.description;
    if (Array.isArray(req.body?.pageOrder)) updates.page_order = req.body.pageOrder;
    if (req.body?.settings && typeof req.body.settings === "object") updates.settings = req.body.settings;
    if (Object.keys(updates).length) updates.version = (existing.version || 1) + 1;

    try {
      if (Object.keys(updates).length) {
        const { error } = await supabaseAdmin.from("estimate_templates").update(updates).eq("id", id);
        if (error) throw error;
      }

      let savedPages = null;
      if (Array.isArray(req.body?.pages)) {
        savedPages = await replaceTemplatePages(id, req.body.pages);
      }

      if (req.body?.setAsOrganisationDefault === true) {
        await clearOrganisationDefault(workspaceId);
        await supabaseAdmin.from("estimate_templates").update({ is_organisation_default: true }).eq("id", id);
      } else if (req.body?.setAsOrganisationDefault === false) {
        await supabaseAdmin.from("estimate_templates").update({ is_organisation_default: false }).eq("id", id);
      }

      if (req.body?.createVersionSnapshot) {
        await createTemplateVersionSnapshot({ templateId: id, label: req.body?.versionLabel || "", createdBy: user.id });
      }

      const { data: finalTemplate, error: finalError } = await supabaseAdmin.from("estimate_templates").select("*").eq("id", id).single();
      if (finalError) throw finalError;
      return res.status(200).json({ ok: true, template: shapeTemplateRowForClient(finalTemplate), pages: savedPages });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error?.message || "Could not update template" });
    }
  }

  if (req.method === "DELETE") {
    if (existing.is_system_default) {
      return res.status(403).json({ ok: false, error: "The system default template cannot be deleted." });
    }
    const { error } = await supabaseAdmin.from("estimate_templates").delete().eq("id", id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

export default withWorkspace(handler);
