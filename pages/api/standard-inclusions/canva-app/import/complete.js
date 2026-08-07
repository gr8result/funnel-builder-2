import { buildNativeDocumentFromCanvaManifest, loadCanvaAppImportSession, publicSession } from "../../../../../lib/standard-inclusions/canvaAppImport.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    const session = loadCanvaAppImportSession(bearerToken(req));
    if (!session) return res.status(401).json({ ok: false, code: "CANVA_APP_IMPORT_SESSION_INVALID", error: "Import session is invalid or expired." });
    const { document, validation } = buildNativeDocumentFromCanvaManifest(session);
    return res.status(validation.canPublish ? 200 : 422).json({
      ok: validation.canPublish,
      code: validation.canPublish ? "CANVA_APP_IMPORT_READY_FOR_REVIEW" : "CANVA_APP_IMPORT_VALIDATION_FAILED",
      session: publicSession(session),
      document,
      validation,
      error: validation.canPublish ? "" : validation.message,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, code: error.code || "CANVA_APP_COMPLETE_FAILED", error: error.message || "Could not complete Canva App import." });
  }
}

function bearerToken(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}
