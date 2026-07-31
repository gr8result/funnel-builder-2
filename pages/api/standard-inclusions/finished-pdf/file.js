import { supabaseAdmin } from "../../../../utils/supabase-admin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import { STANDARD_INCLUSIONS_BUCKET, downloadStandardInclusionsAsset } from "../../../../lib/standard-inclusions/onlyoffice";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const documentId = String(req.query?.documentId || "");
  const { data: document, error } = await supabaseAdmin
    .from("standard_inclusions_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!document || String(document.organisation_id || document.tenant_id) !== String(req.workspaceId)) {
    return res.status(404).json({ ok: false, code: "MISSING_ORIGINAL_PDF", error: "The original finished PDF could not be found. Upload the source PDF again." });
  }
  const storageKey = document.original_pdf_storage_key || document.current_export_pdf_storage_key || document.current_exported_pdf_asset_id;
  if (!storageKey) return res.status(404).json({ ok: false, code: "MISSING_ORIGINAL_PDF", error: "The original finished PDF could not be found. Upload the source PDF again." });
  const buffer = await downloadStandardInclusionsAsset(storageKey);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(document.source_file_name || "Standard Inclusions.pdf")}"`);
  res.setHeader("X-Storage-Bucket", STANDARD_INCLUSIONS_BUCKET);
  res.status(200).send(buffer);
}

export default withWorkspace(handler);
