import { withAuth } from "../../../../lib/withWorkspace";
import {
  downloadStandardInclusionsAsset,
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
    if (!document.current_exported_pdf_asset_id) {
      return res.status(404).json({ ok: false, error: "This document has not been exported to PDF yet." });
    }
    const buffer = await downloadStandardInclusionsAsset(document.current_exported_pdf_asset_id);
    const fileName = String(document.source_file_name || "standard-inclusions.pptx").replace(/\.pptx$/i, ".pdf");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ ok: false, error: error?.message || "Could not download PDF." });
  }
}

export default withAuth(handler);
