// Builder sign-off, rejection (with a reason for the client) and invoicing of a client-approved
// selection variation (Variations module).
// The workspace role comes from workspace_members on the server (withWorkspace); sign-off and
// invoicing are owner / admin actions, like issuing a Standard Inclusions upgrade.
import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { planClientApprovedVariationTransition } from "../../../lib/builders/contractLock.js";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed." });
  const { projectId, variationId, action, expectedUpdatedAt, invoiceNumber = "", reason = "" } = req.body || {};
  if (!projectId || !variationId || !["sign_off", "invoice", "reject"].includes(action)) return res.status(400).json({ ok: false, error: "Project, variation and a supported action are required." });
  if (typeof expectedUpdatedAt !== "string" || !expectedUpdatedAt) return res.status(400).json({ ok: false, error: "The reviewed variation revision is required. Reload before continuing." });
  try {
    const { data: variation, error } = await supabaseAdmin.from("builder_variations").select("*")
      .eq("workspace_id", req.workspaceId).eq("project_id", projectId).eq("id", variationId).maybeSingle();
    if (error) throw error;
    if (!variation) return res.status(404).json({ ok: false, error: "Variation not found in this workspace and job." });
    if (!variation.updated_at || variation.updated_at !== expectedUpdatedAt) return res.status(409).json({ ok: false, error: "This variation changed since you opened it. Reload before continuing." });
    let patch;
    try { patch = planClientApprovedVariationTransition(variation, action, { userId: req.user.id, now: new Date().toISOString(), invoiceNumber, reason: String(reason || "") }); }
    catch (transitionError) { return res.status(409).json({ ok: false, error: transitionError.message }); }
    const updated = await supabaseAdmin.from("builder_variations").update({ ...patch, updated_by: req.user.id, updated_at: new Date().toISOString() })
      .eq("workspace_id", req.workspaceId).eq("project_id", projectId).eq("id", variation.id).eq("status", variation.status).eq("updated_at", variation.updated_at).select("*").maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) return res.status(409).json({ ok: false, error: "This variation changed while you were reviewing it. Reload before continuing." });
    return res.status(200).json({ ok: true, variation: updated.data });
  } catch (error) {
    console.error("[builders/selection-variation]", error?.message);
    return res.status(503).json({ ok: false, error: "The variation could not be updated. Reload and retry; no invoice has been recorded." });
  }
}

export default withWorkspace(handler, { roles: ["owner", "admin"], authTimeoutMs: 8000 });
