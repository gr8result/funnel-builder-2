import { withAuth } from "../../../../lib/withWorkspace";
import {
  buildOnlyOfficeEditorConfig,
  loadStandardInclusionsDocumentForUser,
} from "../../../../lib/standard-inclusions/onlyoffice";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const documentId = String(req.query?.documentId || "").trim();
    if (!documentId) return res.status(400).json({ ok: false, error: "documentId is required" });
    const document = await loadStandardInclusionsDocumentForUser(documentId, req.user.id);
    if (!document) return res.status(404).json({ ok: false, error: "Standard Inclusions document not found." });
    const editor = buildOnlyOfficeEditorConfig({ document, user: req.user, req });
    return res.status(200).json({ ok: true, document, editor });
  } catch (error) {
    return res.status(error?.statusCode || (error?.code === "ONLYOFFICE_DOCUMENT_SERVER_MISSING" ? 501 : 500)).json({
      ok: false,
      error: error?.message || "Could not create ONLYOFFICE editor configuration.",
      code: error?.code || "ONLYOFFICE_CONFIG_FAILED",
    });
  }
}

export default withAuth(handler);
