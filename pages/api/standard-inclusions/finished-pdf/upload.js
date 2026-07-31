import { supabaseAdmin } from "../../../../utils/supabase-admin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import { STANDARD_INCLUSIONS_BUCKET, createOnlyOfficeId, uploadStandardInclusionsAsset } from "../../../../lib/standard-inclusions/onlyoffice";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const { fileName, dataUrl, projectId = "" } = req.body || {};
    const bytes = decodePdfDataUrl(dataUrl);
    if (!bytes.length) return res.status(400).json({ ok: false, code: "MISSING_ORIGINAL_PDF", error: "Upload a PDF file before attaching Standard Inclusions." });
    if (bytes.length > MAX_PDF_BYTES) return res.status(413).json({ ok: false, code: "PDF_TOO_LARGE", error: "The finished PDF is too large. Upload a PDF up to 25 MB." });
    if (bytes.slice(0, 4).toString("utf8") !== "%PDF") return res.status(400).json({ ok: false, code: "CORRUPT_PDF", error: "The uploaded file is not a valid PDF." });

    const now = new Date().toISOString();
    const documentId = createOnlyOfficeId("std-inclusions-pdf");
    const safeName = String(fileName || "Standard Inclusions.pdf").replace(/[^\w.\- ]+/g, "").slice(0, 120) || "Standard Inclusions.pdf";
    const storagePath = `${req.user.id}/standard-inclusions/${req.workspaceId}/${documentId}/original/${safeName}`;
    await uploadStandardInclusionsAsset(storagePath, bytes, "application/pdf", false);

    const record = {
      id: documentId,
      tenant_id: req.workspaceId,
      organisation_id: req.workspaceId,
      project_id: projectId || null,
      owner_user_id: req.user.id,
      allowed_editor_user_ids: [req.user.id],
      version: 1,
      source_type: "finished_pdf",
      source_file_name: safeName,
      current_pptx_asset_id: storagePath,
      current_exported_pdf_asset_id: storagePath,
      original_pdf_storage_key: storagePath,
      current_export_pdf_storage_key: storagePath,
      status: "active",
      created_at: now,
      updated_at: now,
      revision_history: [{
        version: 1,
        action: "attach-finished-pdf",
        originalPdfStorageKey: storagePath,
        exportPdfStorageKey: storagePath,
        createdAt: now,
        userId: req.user.id,
      }],
      metadata: { editorMode: "finished-pdf", fileType: "pdf", locked: true },
    };
    const { data: document, error } = await supabaseAdmin
      .from("standard_inclusions_documents")
      .insert(record)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    const versionInsert = await supabaseAdmin.from("standard_inclusions_versions").insert({
      document_id: documentId,
      version_number: 1,
      original_pdf_storage_key: storagePath,
      export_pdf_storage_key: storagePath,
      preview_storage_keys: [],
      created_reason: "attach-finished-pdf",
      created_by: req.user.id,
    });
    if (versionInsert.error) throw versionInsert.error;
    const { data: publicData } = supabaseAdmin.storage.from(STANDARD_INCLUSIONS_BUCKET).getPublicUrl(storagePath);
    return res.status(200).json({ ok: true, document, storageKey: storagePath, pdfUrl: publicData?.publicUrl || "" });
  } catch (error) {
    const message = error?.message || "Finished PDF upload failed.";
    const migrationMissing = /standard_inclusions_documents|standard_inclusions_versions|schema cache|does not exist|could not find/i.test(message);
    return res.status(migrationMissing ? 501 : 500).json({
      ok: false,
      code: migrationMissing ? "STANDARD_INCLUSIONS_MIGRATION_REQUIRED" : "FINISHED_PDF_UPLOAD_FAILED",
      error: migrationMissing
        ? "Standard Inclusions PDF storage is not deployed. Run the Standard Inclusions Canva/finished-PDF migration first."
        : message,
    });
  }
}

function decodePdfDataUrl(dataUrl = "") {
  const match = String(dataUrl || "").match(/^data:application\/pdf(?:;[^,]*)?,(.+)$/i);
  if (!match) return Buffer.alloc(0);
  return Buffer.from(match[1], "base64");
}

export default withWorkspace(handler);
