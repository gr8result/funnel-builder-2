import crypto from "node:crypto";
import {
  createOnlyOfficeAccessKey,
  downloadStandardInclusionsAsset,
  loadStandardInclusionsDocumentById,
} from "../../../../lib/standard-inclusions/onlyoffice";

function accessKeysMatch(received, expected) {
  const receivedBuffer = Buffer.from(String(received || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const documentId = String(req.query?.documentId || "").trim();
    const accessKey = String(req.query?.accessKey || "").trim();
    if (!documentId || !accessKey) return res.status(400).json({ ok: false, error: "documentId and accessKey are required" });
    const document = await loadStandardInclusionsDocumentById(documentId);
    if (!document) return res.status(404).json({ ok: false, error: "Standard Inclusions document not found." });
    const expected = createOnlyOfficeAccessKey(document.id, document.current_pptx_asset_id, Number(document.version || 1));
    if (!accessKeysMatch(accessKey, expected)) return res.status(403).json({ ok: false, error: "Invalid document access key." });
    const buffer = await downloadStandardInclusionsAsset(document.current_pptx_asset_id);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(document.source_file_name || "standard-inclusions.pptx")}"`);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ ok: false, error: error?.message || "Could not stream presentation." });
  }
}
