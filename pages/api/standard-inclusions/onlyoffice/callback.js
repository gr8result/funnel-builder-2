import {
  STANDARD_INCLUSIONS_TABLE,
  createOnlyOfficeId,
  loadStandardInclusionsDocumentById,
  uploadStandardInclusionsAsset,
  verifyOnlyOfficeJwt,
} from "../../../../lib/standard-inclusions/onlyoffice";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

async function downloadCallbackFile(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ONLYOFFICE callback file download failed (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: 1 });
  }

  try {
    const token = String(req.body?.token || req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!verifyOnlyOfficeJwt(token)) return res.status(403).json({ error: 1 });

    const documentId = String(req.query?.documentId || "").trim();
    const document = await loadStandardInclusionsDocumentById(documentId);
    if (!document) return res.status(404).json({ error: 1 });

    const status = Number(req.body?.status || 0);
    if (![2, 6].includes(status)) return res.status(200).json({ error: 0 });
    const fileUrl = String(req.body?.url || "").trim();
    if (!fileUrl) return res.status(400).json({ error: 1 });

    const nextVersion = Number(document.version || 1) + 1;
    const storagePath = `${document.owner_user_id}/standard-inclusions/${document.tenant_id}/${document.id}/revisions/v${nextVersion}.pptx`;
    const fileBuffer = await downloadCallbackFile(fileUrl);
    await uploadStandardInclusionsAsset(storagePath, fileBuffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation", false);

    const now = new Date().toISOString();
    const revision = {
      id: createOnlyOfficeId("std-inclusions-revision"),
      version: nextVersion,
      action: status === 6 ? "force-save" : "save",
      pptxAssetId: storagePath,
      previousPptxAssetId: document.current_pptx_asset_id,
      callbackStatus: status,
      users: Array.isArray(req.body?.users) ? req.body.users : [],
      createdAt: now,
    };
    const revisionHistory = [...(Array.isArray(document.revision_history) ? document.revision_history : []), revision].slice(-100);

    const { error } = await supabaseAdmin
      .from(STANDARD_INCLUSIONS_TABLE)
      .update({
        version: nextVersion,
        current_pptx_asset_id: storagePath,
        current_exported_pdf_asset_id: null,
        updated_at: now,
        revision_history: revisionHistory,
      })
      .eq("id", document.id);
    if (error) throw error;

    return res.status(200).json({ error: 0 });
  } catch (error) {
    console.error("ONLYOFFICE Standard Inclusions callback failed", error);
    return res.status(500).json({ error: 1 });
  }
}
