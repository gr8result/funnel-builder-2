import { assertRequestSize, attachCanvaAppAsset, loadCanvaAppImportSession } from "../../../../../lib/standard-inclusions/canvaAppImport.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    assertRequestSize(req, 30 * 1024 * 1024);
    const session = loadCanvaAppImportSession(bearerToken(req));
    if (!session) return res.status(401).json({ ok: false, code: "CANVA_APP_IMPORT_SESSION_INVALID", error: "Import session is invalid or expired." });
    const asset = await attachCanvaAppAsset(session, req.body || {});
    return res.status(200).json({ ok: true, asset });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, code: error.code || "CANVA_APP_ASSET_FAILED", error: error.message || "Could not import Canva asset." });
  }
}

function bearerToken(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}
