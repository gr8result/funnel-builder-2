// GET  /api/project-estimate/instances?workspace_id=...&projectId=...&templateId=...
//      Get-or-create semantics: returns the existing instance for this
//      (workspace, project) if one exists; otherwise materializes a new
//      instance from `templateId` (falling back to the workspace's
//      organisation-default template, then the system default).
//
// POST /api/project-estimate/instances
//      Force-create a fresh instance from a template, even if one already
//      exists for the project (used by "Reset to Organisation Default" /
//      "Reset to System Default" flows, which replace the current
//      instance's pages rather than losing the instance id — see the
//      resetToTemplate action on instances/[id].js for the normal path;
//      this endpoint is only used the very first time a project estimate
//      is opened for a job).

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import {
  fetchInstanceWithPages,
  fetchTemplateWithPages,
  replaceInstancePages,
  shapeInstanceRowForClient,
} from "../../../../lib/projectEstimate/estimateBuilderDb";

async function resolveDefaultTemplateId(workspaceId) {
  const { data: orgDefault } = await supabaseAdmin
    .from("estimate_templates")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("is_organisation_default", true)
    .maybeSingle();
  if (orgDefault?.id) return orgDefault.id;

  const { data: systemDefault } = await supabaseAdmin
    .from("estimate_templates")
    .select("id")
    .eq("is_system_default", true)
    .maybeSingle();
  return systemDefault?.id || null;
}

async function createInstanceFromTemplate({ workspaceId, projectId, templateId, ownerUserId }) {
  const resolvedTemplateId = templateId || await resolveDefaultTemplateId(workspaceId);
  if (!resolvedTemplateId) throw new Error("No template available to create this estimate from");
  const template = await fetchTemplateWithPages(resolvedTemplateId);
  if (!template) throw new Error("Template not found");

  const { data: instance, error: insertError } = await supabaseAdmin
    .from("project_estimate_instances")
    .insert({
      workspace_id: workspaceId,
      project_id: projectId || null,
      template_id: resolvedTemplateId,
      owner_user_id: ownerUserId,
      page_order: template.pageOrder || [],
      settings: template.settings || {},
      status: "draft",
    })
    .select("*")
    .single();
  if (insertError) throw insertError;

  const pages = await replaceInstancePages(instance.id, template.pages || []);
  return { ...shapeInstanceRowForClient(instance), pages };
}

async function handler(req, res) {
  const { workspaceId, user } = req;

  if (req.method === "GET") {
    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const templateId = req.query.templateId ? String(req.query.templateId) : null;

    try {
      if (projectId) {
        const { data: existingRow } = await supabaseAdmin
          .from("project_estimate_instances")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("project_id", projectId)
          .maybeSingle();
        if (existingRow?.id) {
          const instance = await fetchInstanceWithPages(existingRow.id);
          return res.status(200).json({ ok: true, instance, created: false });
        }
      }
      const instance = await createInstanceFromTemplate({ workspaceId, projectId, templateId, ownerUserId: user.id });
      return res.status(200).json({ ok: true, instance, created: true });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error?.message || "Could not load or create estimate instance" });
    }
  }

  if (req.method === "POST") {
    const projectId = req.body?.projectId ? String(req.body.projectId) : null;
    const templateId = req.body?.templateId ? String(req.body.templateId) : null;
    try {
      const instance = await createInstanceFromTemplate({ workspaceId, projectId, templateId, ownerUserId: user.id });
      return res.status(200).json({ ok: true, instance, created: true });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error?.message || "Could not create estimate instance" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

export default withWorkspace(handler);
