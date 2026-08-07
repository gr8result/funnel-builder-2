import { assertRequestSize, attachCanvaAppManifest, loadCanvaAppImportSession } from "../../../../../lib/standard-inclusions/canvaAppImport.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    assertRequestSize(req);
    const session = loadCanvaAppImportSession(bearerToken(req));
    if (!session) return res.status(401).json({ ok: false, code: "CANVA_APP_IMPORT_SESSION_INVALID", error: "Import session is invalid or expired." });
    const manifest = req.body?.manifest || req.body;
    const next = await attachCanvaAppManifest(session, manifest);
    return res.status(200).json({ ok: true, session: next });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, code: error.code || "CANVA_APP_MANIFEST_FAILED", error: error.message || "Could not import Canva manifest." });
  }
}

function bearerToken(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}
