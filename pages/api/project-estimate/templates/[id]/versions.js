// GET  /api/project-estimate/templates/:id/versions   List version history
// POST /api/project-estimate/templates/:id/versions   Restore a version
//      Body: { versionId } — replaces the template's metadata + pages with
//      the chosen snapshot. Rejects system-default templates (they have no
//      version history since they are never edited).

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../../../lib/withWorkspace";
import { replaceTemplatePages, shapeTemplateRowForClient } from "../../../../../lib/projectEstimate/estimateBuilderDb";

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
  const templateId = String(req.query.id || "");
  if (!templateId) return res.status(400).json({ ok: false, error: "Template id is required" });

  const existing = await loadAuthorizedTemplate(templateId, workspaceId).catch((error) => {
    res.status(500).json({ ok: false, error: error?.message || "Could not load template" });
    return "errored";
  });
  if (existing === "errored") return;
  if (!existing) return res.status(404).json({ ok: false, error: "Template not found" });
  if (existing === "forbidden") return res.status(403).json({ ok: false, error: "You do not have access to this template" });

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("estimate_template_versions")
      .select("id, version_number, label, created_by, created_at")
      .eq("template_id", templateId)
      .order("version_number", { ascending: false });
    if (error) return res.status(500).json({ ok: false, error: error.message });

    const userIds = [...new Set((data || []).map((row) => row.created_by).filter(Boolean))];
    const userEmails = {};
    await Promise.all(userIds.map(async (uid) => {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(uid).catch(() => ({ data: null }));
      if (userData?.user?.email) userEmails[uid] = userData.user.email;
    }));

    return res.status(200).json({
      ok: true,
      versions: (data || []).map((row) => ({
        id: row.id,
        versionNumber: row.version_number,
        label: row.label,
        createdBy: row.created_by,
        createdByEmail: userEmails[row.created_by] || "",
        createdAt: row.created_at,
      })),
    });
  }

  if (req.method === "POST") {
    if (existing.is_system_default) {
      return res.status(403).json({ ok: false, error: "The system default template has no version history." });
    }
    const versionId = String(req.body?.versionId || "");
    if (!versionId) return res.status(400).json({ ok: false, error: "versionId is required" });

    const { data: version, error: versionError } = await supabaseAdmin
      .from("estimate_template_versions")
      .select("*")
      .eq("id", versionId)
      .eq("template_id", templateId)
      .maybeSingle();
    if (versionError) return res.status(500).json({ ok: false, error: versionError.message });
    if (!version) return res.status(404).json({ ok: false, error: "Version not found" });

    const snapshot = version.snapshot || {};
    try {
      await supabaseAdmin
        .from("estimate_templates")
        .update({
          template_name: snapshot.templateName || existing.template_name,
          description: snapshot.description ?? existing.description,
          page_order: snapshot.pageOrder || existing.page_order,
          settings: snapshot.settings || existing.settings,
          version: (existing.version || 1) + 1,
        })
        .eq("id", templateId);
      const restoredPages = await replaceTemplatePages(templateId, snapshot.pages || []);
      const { data: finalTemplate } = await supabaseAdmin.from("estimate_templates").select("*").eq("id", templateId).single();
      return res.status(200).json({ ok: true, template: shapeTemplateRowForClient(finalTemplate), pages: restoredPages });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error?.message || "Could not restore version" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

export default withWorkspace(handler);
