import { withAuth } from "../../../../lib/withWorkspace";
import {
  STANDARD_INCLUSIONS_MASTER_PATH,
  appendStandardInclusionsRevision,
  loadStandardInclusionsDocumentForUser,
  masterTemplateExists,
} from "../../../../lib/standard-inclusions/onlyoffice";

const VALID_MODES = new Set(["master", "version", "duplicate"]);

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const documentId = String(req.body?.documentId || "").trim();
    const mode = String(req.body?.mode || "").trim();
    if (!documentId) return res.status(400).json({ ok: false, error: "documentId is required" });
    if (!VALID_MODES.has(mode)) {
      return res.status(400).json({ ok: false, error: "mode must be one of: master, version, duplicate" });
    }

    const document = await loadStandardInclusionsDocumentForUser(documentId, req.user.id);
    if (!document) return res.status(404).json({ ok: false, error: "Standard Inclusions document not found." });

    let sourceStoragePath;
    let action;
    let extraMetadata = {};

    if (mode === "master") {
      if (!(await masterTemplateExists())) {
        return res.status(501).json({
          ok: false,
          error: "The Standard Inclusions master template has not been uploaded yet.",
          code: "STANDARD_INCLUSIONS_MASTER_MISSING",
        });
      }
      sourceStoragePath = STANDARD_INCLUSIONS_MASTER_PATH;
      action = "restore-master";
    } else if (mode === "version") {
      const targetVersion = Number(req.body?.targetVersion);
      if (!Number.isFinite(targetVersion)) return res.status(400).json({ ok: false, error: "targetVersion is required for mode 'version'" });
      const history = Array.isArray(document.revision_history) ? document.revision_history : [];
      const entry = [...history].reverse().find((item) => Number(item.version) === targetVersion);
      if (!entry?.pptxAssetId) return res.status(404).json({ ok: false, error: `Version ${targetVersion} was not found in this document's history.` });
      sourceStoragePath = entry.pptxAssetId;
      action = "restore-version";
      extraMetadata = { restoredFromVersion: targetVersion };
    } else {
      sourceStoragePath = document.current_pptx_asset_id;
      action = "duplicate-version";
      extraMetadata = { duplicatedFromVersion: Number(document.version || 1) };
    }

    const updated = await appendStandardInclusionsRevision({
      document,
      sourceStoragePath,
      action,
      actorUserId: req.user.id,
      extraMetadata,
    });

    return res.status(200).json({ ok: true, document: updated });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ ok: false, error: error?.message || "Could not restore this Standard Inclusions version." });
  }
}

export default withAuth(handler);
