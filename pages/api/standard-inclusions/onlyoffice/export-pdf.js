import { withAuth } from "../../../../lib/withWorkspace";
import {
  STANDARD_INCLUSIONS_TABLE,
  createOnlyOfficeAccessKey,
  downloadStandardInclusionsAsset,
  loadStandardInclusionsDocumentForUser,
  onlyOfficeDocumentKey,
  onlyOfficeDocumentServerUrl,
  signOnlyOfficeJwt,
  uploadStandardInclusionsAsset,
  appBaseUrl,
} from "../../../../lib/standard-inclusions/onlyoffice";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const documentId = String(req.body?.documentId || "").trim();
    if (!documentId) return res.status(400).json({ ok: false, error: "documentId is required" });
    const document = await loadStandardInclusionsDocumentForUser(documentId, req.user.id);
    if (!document) return res.status(404).json({ ok: false, error: "Standard Inclusions document not found." });
    const documentServerUrl = onlyOfficeDocumentServerUrl();
    if (!documentServerUrl) {
      return res.status(501).json({
        ok: false,
        error: "ONLYOFFICE_DOCUMENT_SERVER_URL is not configured, so PPTX to PDF export cannot run.",
        code: "ONLYOFFICE_DOCUMENT_SERVER_MISSING",
      });
    }

    const version = Number(document.version || 1);
    const accessKey = createOnlyOfficeAccessKey(document.id, document.current_pptx_asset_id, version);
    const requestBody = {
      async: false,
      filetype: "pptx",
      key: `${onlyOfficeDocumentKey(document)}-pdf`,
      outputtype: "pdf",
      title: document.source_file_name || "Standard Inclusions.pptx",
      url: `${appBaseUrl(req)}/api/standard-inclusions/onlyoffice/file?documentId=${encodeURIComponent(document.id)}&accessKey=${accessKey}`,
    };
    const token = signOnlyOfficeJwt(requestBody);
    const response = await fetch(`${documentServerUrl}/converter?shardkey=${encodeURIComponent(requestBody.key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(token ? { token } : requestBody),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error) {
      return res.status(502).json({ ok: false, error: payload?.message || `ONLYOFFICE PDF conversion failed (${payload?.error || response.status}).` });
    }
    const pdfUrl = String(payload?.fileUrl || payload?.url || "").trim();
    if (!pdfUrl) return res.status(502).json({ ok: false, error: "ONLYOFFICE conversion did not return a PDF URL." });
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) return res.status(502).json({ ok: false, error: `Could not download converted PDF (${pdfResponse.status}).` });
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const pdfPath = `${document.owner_user_id}/standard-inclusions/${document.tenant_id}/${document.id}/exports/v${version}.pdf`;
    await uploadStandardInclusionsAsset(pdfPath, pdfBuffer, "application/pdf", true);
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from(STANDARD_INCLUSIONS_TABLE)
      .update({
        current_exported_pdf_asset_id: pdfPath,
        updated_at: now,
      })
      .eq("id", document.id);
    if (error) throw error;

    return res.status(200).json({ ok: true, documentId: document.id, pdfAssetId: pdfPath });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ ok: false, error: error?.message || "Could not export Standard Inclusions PDF." });
  }
}

export default withAuth(handler);
