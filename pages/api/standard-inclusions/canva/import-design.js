import { supabaseAdmin } from "../../../../utils/supabase-admin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import { canvaConfig, canvaDatabaseStatus, canvaFetch, canvaSetupError, loadCanvaConnection, prepareCanvaEditUrl } from "../../../../lib/standard-inclusions/canvaConnect";
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
  await supabaseAdmin.from("standard_inclusions_versions").insert({
    document_id: documentId,
    version_number: 1,
    canva_design_id: designId,
    preview_storage_keys: [],
    created_reason: "import-canva-design",
    created_by: req.user.id,
  });
  return res.status(200).json({
    ok: true,
    template: templateInsert.data,
    document: documentInsert.data,
    design,
    editUrl: prepareCanvaEditUrl(urls.edit_url, documentId.slice(0, 50)),
    exportFormats: exportFormats.formats,
  });
}

export default withWorkspace(handler);
