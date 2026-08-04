import { supabaseAdmin } from "../../../../utils/supabase-admin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import { canvaConfig, canvaDatabaseStatus, canvaFetch, canvaSetupError, loadCanvaConnection, storeCanvaExportedPdf } from "../../../../lib/standard-inclusions/canvaConnect";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const documentId = String(req.body?.documentId || "");
  const designId = String(req.body?.designId || "");
  if (!documentId || !designId) return res.status(400).json({ ok: false, code: "CANVA_DESIGN_REQUIRED", error: "A Canva Standard Inclusions document is required before generating a PDF." });
  const setupError = canvaSetupError({ config: canvaConfig(req), database: await canvaDatabaseStatus() });
  if (setupError) return res.status(501).json({ ok: false, code: setupError.code, error: setupError.message, missing: setupError.missing || [] });
  const connection = await loadCanvaConnection({ workspaceId: req.workspaceId, userId: req.user.id, requireFresh: true });
  if (!connection) return res.status(401).json({ ok: false, code: "CANVA_NOT_CONNECTED", error: "Connect Canva Account before exporting a design." });
  const { data: document, error: loadError } = await supabaseAdmin.from("standard_inclusions_documents").select("*").eq("id", documentId).maybeSingle();
  if (loadError) throw loadError;
  if (!document || String(document.organisation_id || document.tenant_id) !== String(req.workspaceId)) return res.status(404).json({ ok: false, code: "CANVA_DESIGN_NOT_ACCESSIBLE", error: "This Canva design is not accessible in the current workspace." });

  const formats = await canvaFetch(connection, `/designs/${encodeURIComponent(designId)}/export-formats`);
  if (!formats?.formats?.pdf) return res.status(422).json({ ok: false, code: "CANVA_UNSUPPORTED_CAPABILITY", error: "This Canva design cannot be exported as PDF through Canva Connect." });
  const job = await canvaFetch(connection, "/exports", {
    method: "POST",
    body: JSON.stringify({ design_id: designId, format: { type: "pdf" } }),
  });
  const jobId = job?.job?.id || job?.id;
  if (!jobId) return res.status(502).json({ ok: false, code: "CANVA_EXPORT_FAILED", error: "Canva did not return an export job ID." });
  let exportJob = job;
  let exportStatus = exportJob?.job?.status || exportJob?.status || "";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    exportJob = await canvaFetch(connection, `/exports/${encodeURIComponent(jobId)}`);
    exportStatus = exportJob?.job?.status || exportJob?.status || "";
    if (exportStatus === "success") break;
    if (exportStatus === "failed") return res.status(502).json({ ok: false, code: "CANVA_EXPORT_FAILED", error: exportJob?.job?.error?.message || "Canva PDF export failed." });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (exportStatus !== "success") return res.status(504).json({ ok: false, code: "CANVA_EXPORT_TIMEOUT", error: "Canva PDF export timed out before the complete document was ready." });
  const urls = exportJob?.job?.urls || exportJob?.urls || [];
  const exportUrl = Array.isArray(urls) ? urls[0] : urls?.url;
  if (!exportUrl) return res.status(502).json({ ok: false, code: "CANVA_EXPORT_FAILED", error: "Canva did not return a PDF download URL." });
  const nextVersion = Number(document.version || 1) + 1;
  const stored = await storeCanvaExportedPdf({ workspaceId: req.workspaceId, userId: req.user.id, documentId, designId, exportUrl, versionNumber: nextVersion });
  const now = new Date().toISOString();
  const revision = {
    version: nextVersion,
    action: "canva-export-pdf",
    canvaDesignId: designId,
    exportPdfStorageKey: stored.storagePath,
    pageCount: stored.pageCount,
    createdAt: now,
    userId: req.user.id,
  };
  const revisionHistory = [...(Array.isArray(document.revision_history) ? document.revision_history : []), revision].slice(-100);
  const update = await supabaseAdmin.from("standard_inclusions_documents").update({
    version: nextVersion,
    current_exported_pdf_asset_id: stored.storagePath,
    current_export_pdf_storage_key: stored.storagePath,
    page_count: stored.pageCount,
    updated_at: now,
    revision_history: revisionHistory,
  }).eq("id", documentId).select("*").maybeSingle();
  if (update.error) throw update.error;
  await supabaseAdmin.from("standard_inclusions_versions").insert({
    document_id: documentId,
    version_number: nextVersion,
    canva_design_id: designId,
    export_pdf_storage_key: stored.storagePath,
    preview_storage_keys: [],
    created_reason: "canva-export-pdf",
    created_by: req.user.id,
  });
  return res.status(200).json({ ok: true, document: update.data, pdfUrl: stored.publicUrl, storageKey: stored.storagePath, pageCount: stored.pageCount });
}

export default withWorkspace(handler);
