import { supabaseAdmin } from "../../../../utils/supabase-admin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import { canvaConfig, canvaDatabaseStatus, canvaFetch, canvaSetupError, loadCanvaConnection, prepareCanvaEditUrl, storeCanvaExportedPdf } from "../../../../lib/standard-inclusions/canvaConnect";
import { createOnlyOfficeId } from "../../../../lib/standard-inclusions/onlyoffice";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const designId = String(req.body?.designId || "");
  if (!designId) return res.status(400).json({ ok: false, code: "CANVA_DESIGN_REQUIRED", error: "Select a Canva design before saving Standard Inclusions." });
  const setupError = canvaSetupError({ config: canvaConfig(req), database: await canvaDatabaseStatus() });
  if (setupError) return res.status(501).json({ ok: false, code: setupError.code, error: setupError.message, missing: setupError.missing || [] });
  const connection = await loadCanvaConnection({ workspaceId: req.workspaceId, userId: req.user.id, requireFresh: true });
  if (!connection) return res.status(401).json({ ok: false, code: "CANVA_NOT_CONNECTED", error: "Connect Canva Account before importing a design." });
  const design = await canvaFetch(connection, `/designs/${encodeURIComponent(designId)}`);
  const pages = await canvaFetch(connection, `/designs/${encodeURIComponent(designId)}/pages`).catch(() => ({ items: [] }));
  const exportFormats = await canvaFetch(connection, `/designs/${encodeURIComponent(designId)}/export-formats`).catch(() => ({ formats: {} }));
  if (!exportFormats?.formats?.pdf) {
    return res.status(422).json({ ok: false, code: "CANVA_UNSUPPORTED_CAPABILITY", error: "This Canva design cannot be exported as PDF through Canva Connect." });
  }
  const now = new Date().toISOString();
  const title = design?.title || design?.design?.title || "Canva Standard Inclusions";
  const thumbnail = design?.thumbnail?.url || design?.thumbnail_url || design?.design?.thumbnail?.url || "";
  const urls = design?.urls || design?.design?.urls || {};
  const templateInsert = await supabaseAdmin.from("canva_templates").insert({
    organisation_id: req.workspaceId,
    name: title,
    canva_design_id: designId,
    thumbnail_url: thumbnail,
    page_count: Array.isArray(pages?.items) ? pages.items.length : null,
    status: "active",
    created_by: req.user.id,
    created_at: now,
    updated_at: now,
  }).select("*").maybeSingle();
  if (templateInsert.error) throw templateInsert.error;
  const documentId = createOnlyOfficeId("std-inclusions-canva");
  const documentInsert = await supabaseAdmin.from("standard_inclusions_documents").insert({
    id: documentId,
    tenant_id: req.workspaceId,
    organisation_id: req.workspaceId,
    project_id: req.body?.projectId || null,
    owner_user_id: req.user.id,
    allowed_editor_user_ids: [req.user.id],
    version: 1,
    source_type: "canva",
    source_file_name: title,
    current_pptx_asset_id: "",
    template_id: templateInsert.data.id,
    canva_design_id: designId,
    thumbnail_url: thumbnail,
    page_count: Array.isArray(pages?.items) ? pages.items.length : null,
    status: "active",
    created_at: now,
    updated_at: now,
    revision_history: [{ version: 1, action: "import-canva-design", canvaDesignId: designId, createdAt: now, userId: req.user.id }],
    metadata: { editorMode: "canva", canvaDesign: design, canvaExportFormats: exportFormats.formats },
  }).select("*").maybeSingle();
  if (documentInsert.error) throw documentInsert.error;
  const exportJob = await canvaFetch(connection, "/exports", {
    method: "POST",
    body: JSON.stringify({ design_id: designId, format: { type: "pdf" } }),
  });
  const exportUrl = await waitForCanvaExport(connection, exportJob);
  const storedPdf = await storeCanvaExportedPdf({
    workspaceId: req.workspaceId,
    userId: req.user.id,
    documentId,
    designId,
    exportUrl,
    versionNumber: 1,
  });
  const update = await supabaseAdmin.from("standard_inclusions_documents").update({
    current_exported_pdf_asset_id: storedPdf.storagePath,
    current_export_pdf_storage_key: storedPdf.storagePath,
    original_pdf_storage_key: storedPdf.storagePath,
    page_count: storedPdf.pageCount,
    updated_at: now,
    metadata: {
      editorMode: "canva",
      canvaDesign: design,
      canvaExportFormats: exportFormats.formats,
      canvaFirst: {
        designId,
        designName: title,
        sourceDocumentId: documentId,
        exportedAt: now,
        lastRefreshAt: "",
        pdfStorageKey: storedPdf.storagePath,
        pdfUrl: storedPdf.publicUrl,
        pageCount: storedPdf.pageCount,
        pages: [],
        pageOrder: [],
        overlays: [],
      },
    },
  }).eq("id", documentId).select("*").maybeSingle();
  if (update.error) throw update.error;
  await supabaseAdmin.from("standard_inclusions_versions").insert({
    document_id: documentId,
    version_number: 1,
    canva_design_id: designId,
    original_pdf_storage_key: storedPdf.storagePath,
    export_pdf_storage_key: storedPdf.storagePath,
    preview_storage_keys: [],
    created_reason: "import-canva-design-export-pdf",
    created_by: req.user.id,
  });
  return res.status(200).json({
    ok: true,
    template: templateInsert.data,
    document: update.data,
    design,
    editUrl: prepareCanvaEditUrl(urls.edit_url, documentId.slice(0, 50)),
    exportFormats: exportFormats.formats,
    pdfUrl: storedPdf.publicUrl,
    pdfStorageKey: storedPdf.storagePath,
    pageCount: storedPdf.pageCount,
  });
}

export default withWorkspace(handler);

async function waitForCanvaExport(connection, exportJob) {
  const jobId = exportJob?.job?.id || exportJob?.id;
  if (!jobId) {
    const error = new Error("Canva did not return an export job ID.");
    error.code = "CANVA_EXPORT_FAILED";
    error.statusCode = 502;
    throw error;
  }
  let current = exportJob;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    current = await canvaFetch(connection, `/exports/${encodeURIComponent(jobId)}`);
    const status = current?.job?.status || current?.status || "";
    if (status === "success") {
      const urls = current?.job?.urls || current?.urls || [];
      const url = Array.isArray(urls) ? urls[0] : urls?.url;
      if (!url) throw new Error("Canva completed the PDF export but did not return a download URL.");
      return url;
    }
    if (status === "failed") {
      const error = new Error(current?.job?.error?.message || "Canva PDF export failed.");
      error.code = "CANVA_EXPORT_FAILED";
      error.statusCode = 502;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const error = new Error("Canva PDF export timed out before the complete document was ready.");
  error.code = "CANVA_EXPORT_TIMEOUT";
  error.statusCode = 504;
  throw error;
}
