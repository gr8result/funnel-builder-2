import { withWorkspace } from "../../../../lib/withWorkspace";
import {
  CANVA_BRAND_TEMPLATE_SCOPES,
  CANVA_REQUIRED_SCOPES,
  canvaConfig,
  canvaDatabaseStatus,
  canvaMissingConfigMessage,
  canvaReturnUrl,
  connectionTokenStatus,
  loadCanvaConnection,
  scopeStatus,
} from "../../../../lib/standard-inclusions/canvaConnect";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const cfg = canvaConfig(req);
  const database = await canvaDatabaseStatus();
  let connection = null;
  let connectionError = "";
  if (cfg.configured && database.ready && cfg.redirectUses127) {
    try {
      connection = await loadCanvaConnection({ workspaceId: req.workspaceId, userId: req.user.id });
    } catch (error) {
      connectionError = error?.message || "Could not load Canva connection.";
    }
  }
  const scopes = scopeStatus(connection?.scopes || [], CANVA_REQUIRED_SCOPES);
  const brandTemplateScopes = scopeStatus(connection?.scopes || [], CANVA_BRAND_TEMPLATE_SCOPES);
  const missingSetup = [
    ...(cfg.envStatus?.missing || []),
    ...(cfg.redirectUses127 ? [] : [`CANVA_REDIRECT_URI must be http://127.0.0.1:3000/api/standard-inclusions/canva/callback`]),
    ...(database.ready ? [] : ["database migration"]),
  ];
  return res.status(200).json({
    ok: true,
    configured: cfg.configured && cfg.redirectUses127,
    connected: Boolean(connection),
    ready: missingSetup.length === 0 && Boolean(connection) && scopes.granted,
    setupRequired: missingSetup.length > 0,
    missing: missingSetup,
    diagnostics: {
      clientId: cfg.envStatus.checks.CANVA_CLIENT_ID ? "Configured" : "Missing",
      clientSecret: cfg.envStatus.checks.CANVA_CLIENT_SECRET ? "Configured" : "Missing",
      redirectUri: cfg.redirectUri || "",
      returnUrl: canvaReturnUrl(req),
      redirectUriStatus: cfg.redirectUses127 ? "OK" : "Must use 127.0.0.1 for local development",
      databaseTables: database.ready ? "Ready" : "Migration required",
      database,
      connection: connection ? "Connected" : "Not connected",
      tokenStatus: connectionTokenStatus(connection),
      requiredScopes: scopes.granted ? "Granted" : "Missing",
      missingScopes: scopes.missing,
      brandTemplateScopes: brandTemplateScopes.granted ? "Granted" : "Missing or unavailable",
      missingBrandTemplateScopes: brandTemplateScopes.missing,
      connectionError,
    },
    scopes: connection?.scopes || [],
    expiresAt: connection?.expires_at || "",
    error: missingSetup.length ? "Canva setup is incomplete." : connectionError || (!connection ? canvaMissingConfigMessage() : ""),
  });
}

export default withWorkspace(handler);
