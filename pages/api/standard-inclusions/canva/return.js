import crypto from "node:crypto";
import { supabaseAdmin } from "../../../../utils/supabase-admin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import { canvaConfig, canvaFetch, loadCanvaConnection } from "../../../../lib/standard-inclusions/canvaConnect";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const correlationJwt = String(req.body?.correlationJwt || "");
  if (!correlationJwt) return res.status(400).json({ ok: false, code: "CANVA_RETURN_JWT_MISSING", error: "Missing Canva return-navigation JWT." });
  const payload = await verifyCanvaCorrelationJwt(correlationJwt, canvaConfig(req).clientId);
  if (payload.type !== "rti") return res.status(400).json({ ok: false, code: "CANVA_RETURN_JWT_INVALID", error: "Invalid Canva return-navigation JWT." });
  const designId = String(payload.design_id || "");
  const connection = await loadCanvaConnection({ workspaceId: req.workspaceId, userId: req.user.id, requireFresh: true });
  if (!connection) return res.status(401).json({ ok: false, code: "CANVA_NOT_CONNECTED", error: "Connect Canva Account before refreshing the design." });
  const design = await canvaFetch(connection, `/designs/${encodeURIComponent(designId)}`);
  const existing = await supabaseAdmin
    .from("standard_inclusions_documents")
    .select("id, metadata")
    .eq("organisation_id", req.workspaceId)
    .eq("canva_design_id", designId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  await supabaseAdmin
    .from("standard_inclusions_documents")
    .update({ metadata: { ...(existing.data?.metadata || {}), canvaDesign: design, refreshedFromCanvaAt: new Date().toISOString(), canvaReturn: payload }, updated_at: new Date().toISOString() })
    .eq("organisation_id", req.workspaceId)
    .eq("canva_design_id", designId);
  return res.status(200).json({ ok: true, design, correlation: payload });
}

async function verifyCanvaCorrelationJwt(token, audience) {
  const [encodedHeader, encodedPayload, encodedSignature] = String(token || "").split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw invalidJwt();
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  if (audience && payload.aud !== audience) throw invalidJwt();
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw invalidJwt();
  const response = await fetch("https://api.canva.com/rest/v1/connect/keys");
  const jwks = await response.json().catch(() => ({}));
  const jwk = (jwks.keys || []).find((key) => key.kid === header.kid);
  if (!jwk) throw invalidJwt();
  const signature = Buffer.from(encodedSignature, "base64url");
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  if (!crypto.verify(null, Buffer.from(`${encodedHeader}.${encodedPayload}`), publicKey, signature)) throw invalidJwt();
  return payload;
}

function invalidJwt() {
  const error = new Error("Invalid return-navigation JWT from Canva.");
  error.code = "CANVA_RETURN_JWT_INVALID";
  return error;
}

export default withWorkspace(handler);
