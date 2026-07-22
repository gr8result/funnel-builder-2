// GET   /api/project-estimate/instances/:id                Fetch instance + pages
// PATCH /api/project-estimate/instances/:id                Save changes to this
//       estimate. Body: { pages?, pageOrder?, settings?, expectedUpdatedAt?,
//       action?: "resetToTemplate" }
//
// Optimistic concurrency: pass the `updatedAt` you last loaded as
// `expectedUpdatedAt`; if the row has since changed, the request is
// rejected with 409 so a stale save can never silently clobber newer work.

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import {
  fetchInstanceWithPages,
  fetchTemplateWithPages,
  replaceInstancePages,
  shapeInstanceRowForClient,
} from "../../../../lib/projectEstimate/estimateBuilderDb";

async function loadAuthorizedInstance(id, workspaceId) {
  const { data, error } = await supabaseAdmin.from("project_estimate_instances").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.workspace_id !== workspaceId) return "forbidden";
  return data;
}

async function handler(req, res) {
  const { workspaceId } = req;
  const id = String(req.query.id || "");
  if (!id) return res.status(400).json({ ok: false, error: "Instance id is required" });

  const existing = await loadAuthorizedInstance(id, workspaceId).catch((error) => {
    res.status(500).json({ ok: false, error: error?.message || "Could not load estimate instance" });
    return "errored";
  });
  if (existing === "errored") return;
  if (!existing) return res.status(404).json({ ok: false, error: "Estimate instance not found" });
  if (existing === "forbidden") return res.status(403).json({ ok: false, error: "You do not have access to this estimate" });

  if (req.method === "GET") {
    try {
      const instance = await fetchInstanceWithPages(id);
      return res.status(200).json({ ok: true, instance });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error?.message || "Could not load estimate instance" });
    }
  }

  if (req.method === "PATCH") {
    if (req.body?.expectedUpdatedAt) {
      const currentUpdatedAt = new Date(existing.updated_at).getTime();
      const expectedUpdatedAt = new Date(req.body.expectedUpdatedAt).getTime();
      if (Number.isFinite(currentUpdatedAt) && Number.isFinite(expectedUpdatedAt) && currentUpdatedAt !== expectedUpdatedAt) {
        return res.status(409).json({
          ok: false,
          error: "This estimate was updated elsewhere since you last loaded it. Reload to see the latest version before saving.",
          conflict: true,
        });
      }
    }

    try {
      if (req.body?.action === "resetToTemplate") {
        const templateId = req.body?.templateId || existing.template_id;
        if (!templateId) return res.status(400).json({ ok: false, error: "No template to reset to" });
        const template = await fetchTemplateWithPages(templateId);
        if (!template) return res.status(404).json({ ok: false, error: "Template not found" });

        await supabaseAdmin
          .from("project_estimate_instances")
          .update({ template_id: templateId, page_order: template.pageOrder || [], settings: template.settings || {} })
          .eq("id", id);
        const pages = await replaceInstancePages(id, template.pages || []);
        const { data: finalInstance } = await supabaseAdmin.from("project_estimate_instances").select("*").eq("id", id).single();
        return res.status(200).json({ ok: true, instance: { ...shapeInstanceRowForClient(finalInstance), pages } });
      }

      const updates = {};
      if (Array.isArray(req.body?.pageOrder)) updates.page_order = req.body.pageOrder;
      if (req.body?.settings && typeof req.body.settings === "object") updates.settings = req.body.settings;
      if (req.body?.status) updates.status = req.body.status;
      if (typeof req.body?.templateId === "string" && req.body.templateId) updates.template_id = req.body.templateId;
      if (Object.keys(updates).length) {
        const { error } = await supabaseAdmin.from("project_estimate_instances").update(updates).eq("id", id);
        if (error) throw error;
      }

      let savedPages = null;
      if (Array.isArray(req.body?.pages)) {
        savedPages = await replaceInstancePages(id, req.body.pages);
      }

      const { data: finalInstance, error: finalError } = await supabaseAdmin.from("project_estimate_instances").select("*").eq("id", id).single();
      if (finalError) throw finalError;
      return res.status(200).json({ ok: true, instance: shapeInstanceRowForClient(finalInstance), pages: savedPages });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error?.message || "Could not save estimate instance" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

export default withWorkspace(handler);
