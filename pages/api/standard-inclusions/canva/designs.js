import { withWorkspace } from "../../../../lib/withWorkspace";
import { canvaConfig, canvaDatabaseStatus, canvaFetch, canvaSetupError, loadCanvaConnection } from "../../../../lib/standard-inclusions/canvaConnect";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const setupError = canvaSetupError({ config: canvaConfig(req), database: await canvaDatabaseStatus() });
  if (setupError) return res.status(501).json({ ok: false, code: setupError.code, error: setupError.message, missing: setupError.missing || [] });
  const connection = await loadCanvaConnection({ workspaceId: req.workspaceId, userId: req.user.id, requireFresh: true });
  if (!connection) return res.status(401).json({ ok: false, code: "CANVA_NOT_CONNECTED", error: "Connect Canva Account before importing a design." });
  const params = new URLSearchParams();
  if (req.query?.query) params.set("query", String(req.query.query));
  if (req.query?.continuation) params.set("continuation", String(req.query.continuation));
  const payload = await canvaFetch(connection, `/designs${params.toString() ? `?${params}` : ""}`);
  return res.status(200).json({ ok: true, ...payload });
}

export default withWorkspace(handler);
