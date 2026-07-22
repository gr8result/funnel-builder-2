import { withWorkspace } from "../../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  cloneMasterTemplateForTenant,
  loadStandardInclusionsDocumentForTenant,
  masterTemplateExists,
} from "../../../../lib/standard-inclusions/onlyoffice";

async function activeWorkspaceMemberIds(workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");
  if (error) throw error;
  return (data || []).map((row) => row.user_id).filter(Boolean);
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const tenantId = req.workspaceId;
    const existing = await loadStandardInclusionsDocumentForTenant(tenantId);
    if (existing) {
      return res.status(200).json({ ok: true, document: existing, created: false });
    }

    if (!(await masterTemplateExists())) {
      return res.status(501).json({
        ok: false,
        error: "The Standard Inclusions master template has not been uploaded yet.",
        code: "STANDARD_INCLUSIONS_MASTER_MISSING",
      });
    }

    const memberIds = await activeWorkspaceMemberIds(tenantId);
    const document = await cloneMasterTemplateForTenant({
      tenantId,
      ownerUserId: req.user.id,
      allowedEditorUserIds: memberIds,
    });

    return res.status(200).json({ ok: true, document, created: true });
  } catch (error) {
    const message = error?.message || "Could not open Standard Inclusions.";
    const missingTable = /standard_inclusions_documents|schema cache|does not exist|could not find/i.test(message);
    return res.status(missingTable ? 501 : (error?.statusCode || 500)).json({
      ok: false,
      error: missingTable
        ? "Standard Inclusions ONLYOFFICE storage is not deployed. Run the standard_inclusions_documents migration first."
        : message,
      code: missingTable ? "STANDARD_INCLUSIONS_STORAGE_NOT_DEPLOYED" : "STANDARD_INCLUSIONS_GET_OR_CREATE_FAILED",
    });
  }
}

export default withWorkspace(handler);
