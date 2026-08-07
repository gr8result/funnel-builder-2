import { loadCanvaAppImportSession, publicSession } from "../../../../../lib/standard-inclusions/canvaAppImport.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const token = String(req.query?.token || "").trim() || bearerToken(req);
  const session = loadCanvaAppImportSession(token);
  if (!session) return res.status(401).json({ ok: false, code: "CANVA_APP_IMPORT_SESSION_INVALID", error: "Import session is invalid or expired." });
  return res.status(200).json({ ok: true, session: publicSession(session), validation: session.validation || null });
}

function bearerToken(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}
