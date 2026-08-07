import { withWorkspace } from "../../../../../lib/withWorkspace.js";
import { createCanvaAppImportSession } from "../../../../../lib/standard-inclusions/canvaAppImport.js";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const organisationId = String(req.body?.organisationId || req.workspaceId || "");
  const { session, token } = createCanvaAppImportSession({
    workspaceId: req.workspaceId,
    userId: req.user.id,
    organisationId,
  });
  return res.status(200).json({
    ok: true,
    session,
    importToken: token,
    expiresAt: session.expiresAt,
    appInstructions: "Paste this import token into the private Canva App named Send to Gr8 Result, or configure it in the app environment for this admin import.",
  });
}

export default withWorkspace(handler, { roles: ["owner", "admin"] });
