import crypto from "node:crypto";
import { supabaseAdmin } from "../supabaseAdmin";
import { STANDARD_INCLUSIONS_BUCKET, uploadStandardInclusionsAsset } from "./onlyoffice";

export const CANVA_API_BASE = "https://api.canva.com/rest/v1";
export const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_REQUIRED_SCOPES = [
  "design:meta:read",
  "design:content:read",
  "design:content:write",
];
export const CANVA_BRAND_TEMPLATE_SCOPES = [
  "brandtemplate:meta:read",
  "brandtemplate:content:read",
];
export const CANVA_LOCAL_REDIRECT_URI = "http://127.0.0.1:3000/api/standard-inclusions/canva/callback";
export const CANVA_LOCAL_RETURN_URL = "http://127.0.0.1:3000/api/standard-inclusions/canva/return";

export function canvaConfig(req = null) {
  const clientId = String(process.env.CANVA_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.CANVA_CLIENT_SECRET || "").trim();
  const redirectUri = String(process.env.CANVA_REDIRECT_URI || canvaDefaultRedirectUri(req) || "").trim();
  const envStatus = canvaEnvironmentStatus();
  return {
    clientId,
    clientSecret,
    redirectUri,
    envStatus,
    configured: envStatus.missing.length === 0,
    redirectUses127: redirectUri === CANVA_LOCAL_REDIRECT_URI || !/^http:\/\/(localhost|127\.0\.0\.1):/i.test(redirectUri),
  };
}

export function canvaMissingConfigMessage() {
  return "Canva is not connected. Configure Canva Client ID, Client Secret and redirect URL.";
}

export function canvaReturnUrl(req = null) {
  const configured = String(process.env.CANVA_RETURN_URI || process.env.CANVA_RETURN_URL || "").trim();
  if (configured) return configured;
  if (isLocalRequest(req)) return CANVA_LOCAL_RETURN_URL;
  const base = canvaDefaultAppBase(req);
  return base ? `${base}/standard-inclusions/canva-return` : CANVA_LOCAL_RETURN_URL;
}

export function canvaEnvironmentStatus() {
  const checks = {
    CANVA_CLIENT_ID: Boolean(String(process.env.CANVA_CLIENT_ID || "").trim()),
    CANVA_CLIENT_SECRET: Boolean(String(process.env.CANVA_CLIENT_SECRET || "").trim()),
    CANVA_REDIRECT_URI: Boolean(String(process.env.CANVA_REDIRECT_URI || "").trim()),
    CANVA_RETURN_URI: Boolean(String(process.env.CANVA_RETURN_URI || process.env.CANVA_RETURN_URL || "").trim()),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim()),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim()),
  };
  return {
    checks,
    missing: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key),
  };
}

export async function canvaDatabaseStatus() {
  const required = {
    canva_connections: ["id"],
    canva_oauth_states: ["state"],
    canva_templates: ["id"],
    standard_inclusions_documents: ["id", "canva_design_id", "original_pdf_storage_key", "current_export_pdf_storage_key"],
    standard_inclusions_versions: ["id"],
  };
  const tables = {};
  const missing = [];
  for (const [table, columns] of Object.entries(required)) {
    try {
      const { error } = await supabaseAdmin.from(table).select(columns.join(","), { count: "exact", head: true }).limit(1);
      tables[table] = !error;
      if (error) missing.push(table);
    } catch {
      tables[table] = false;
      missing.push(table);
    }
  }
  return {
    ready: missing.length === 0,
    tables,
    missing,
    migration: "supabase/migrations/20260801_standard_inclusions_canva_finished_pdf.sql",
  };
}

export function canvaSetupError({ config = canvaConfig(), database = null } = {}) {
  const missing = [...(config.envStatus?.missing || [])];
  if (database && !database.ready) missing.push("database migration");
  if (!config.redirectUses127) missing.push(`CANVA_REDIRECT_URI must be ${CANVA_LOCAL_REDIRECT_URI}`);
  if (!missing.length) return null;
  const error = new Error(`Canva setup is incomplete. Missing: ${missing.join(", ")}.`);
  error.code = "CANVA_SETUP_INCOMPLETE";
  error.missing = missing;
  error.statusCode = 501;
  return error;
}

export function connectionTokenStatus(connection) {
  if (!connection) return "Missing";
  const expiresAt = Date.parse(connection.expires_at || "");
  if (!expiresAt) return "Missing";
  return expiresAt <= Date.now() ? "Expired" : "Valid";
}

export function scopeStatus(granted = [], required = CANVA_REQUIRED_SCOPES) {
  const grantedSet = new Set((Array.isArray(granted) ? granted : []).map(String));
  const missing = required.filter((scope) => !grantedSet.has(scope));
  return { granted: missing.length === 0, missing, required, grantedScopes: Array.from(grantedSet) };
}

function canvaDefaultRedirectUri(req) {
  if (isLocalRequest(req)) return CANVA_LOCAL_REDIRECT_URI;
  const configured = canvaDefaultAppBase(req);
  if (configured) return `${configured}/api/standard-inclusions/canva/callback`;
  return "";
}

function canvaDefaultAppBase(req = null) {
  const configured = String(process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host || "";
  const proto = req?.headers?.["x-forwarded-proto"] || "http";
  return host ? `${proto}://${host}` : "";
}

function isLocalRequest(req = null) {
  const host = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "").toLowerCase();
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

export function createCanvaOauthState({ workspaceId, userId, returnTo = "" }) {
  const verifier = crypto.randomBytes(64).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + 10 * 60 * 1000;
  return {
    state,
    verifier,
    challenge,
    record: {
      state,
      workspaceId,
      userId,
      returnTo,
      verifier,
      expiresAt,
    },
  };
}

export function canvaAuthorizationUrl({ req, state, challenge }) {
  const cfg = canvaConfig(req);
  if (!cfg.configured) {
    const error = new Error(canvaMissingConfigMessage());
    error.code = "CANVA_CONFIG_MISSING";
    throw error;
  }
  if (!cfg.redirectUses127) {
    const error = new Error(`CANVA_REDIRECT_URI must be ${CANVA_LOCAL_REDIRECT_URI} for local development.`);
    error.code = "CANVA_REDIRECT_URI_INVALID";
    throw error;
  }
  const params = new URLSearchParams({
    code_challenge: challenge,
    code_challenge_method: "s256",
    scope: CANVA_REQUIRED_SCOPES.join(" "),
    response_type: "code",
    client_id: cfg.clientId,
    state,
    redirect_uri: cfg.redirectUri,
  });
  return `${CANVA_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCanvaToken({ req, code, verifier }) {
  const cfg = canvaConfig(req);
  if (!cfg.configured) {
    const error = new Error(canvaMissingConfigMessage());
    error.code = "CANVA_CONFIG_MISSING";
    throw error;
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: cfg.redirectUri,
  });
  const response = await fetch(`${CANVA_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error_description || payload?.error || "Canva OAuth token exchange failed.");
    error.code = "CANVA_TOKEN_EXCHANGE_FAILED";
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

export async function refreshCanvaConnection(connection) {
  if (!connection?.refresh_token) {
    const error = new Error("Canva access token expired and no refresh token is stored.");
    error.code = "CANVA_REFRESH_TOKEN_MISSING";
    throw error;
  }
  const cfg = canvaConfig();
  if (!cfg.configured) {
    const error = new Error(canvaMissingConfigMessage());
    error.code = "CANVA_CONFIG_MISSING";
    throw error;
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refresh_token,
  });
  const response = await fetch(`${CANVA_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error_description || payload?.error || "Canva token refresh failed.");
    error.code = "CANVA_TOKEN_REFRESH_FAILED";
    error.statusCode = response.status;
    throw error;
  }
  const expiresAt = new Date(Date.now() + Number(payload.expires_in || 0) * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("canva_connections")
    .update({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || connection.refresh_token,
      scopes: String(payload.scope || connection.scopes || "").split(/\s+/).filter(Boolean),
      expires_at: expiresAt,
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadCanvaConnection({ workspaceId, userId, requireFresh = false } = {}) {
  const { data, error } = await supabaseAdmin
    .from("canva_connections")
    .select("*")
    .eq("organisation_id", String(workspaceId || ""))
    .eq("user_id", String(userId || ""))
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    const nextError = new Error(error.code === "42P01" || /does not exist/i.test(error.message || "") ? "Canva database migration has not been applied." : error.message);
    nextError.code = error.code === "42P01" || /does not exist/i.test(error.message || "") ? "CANVA_MIGRATION_REQUIRED" : "CANVA_CONNECTION_LOAD_FAILED";
    nextError.statusCode = nextError.code === "CANVA_MIGRATION_REQUIRED" ? 501 : 500;
    throw nextError;
  }
  if (!data) return null;
  const expiresAt = Date.parse(data.expires_at || "");
  if (requireFresh && (!expiresAt || expiresAt < Date.now() + 60_000)) return refreshCanvaConnection(data);
  return data;
}

export async function canvaFetch(connection, path, options = {}) {
  const fresh = await loadCanvaConnection({
    workspaceId: connection.organisation_id,
    userId: connection.user_id,
    requireFresh: true,
  });
  if (!fresh?.access_token) {
    const error = new Error("Canva account is not connected.");
    error.code = "CANVA_NOT_CONNECTED";
    throw error;
  }
  const response = await fetch(`${CANVA_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${fresh.access_token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) {
    const message = typeof payload === "string" ? payload : payload?.message || payload?.error || "Canva API request failed.";
    const error = new Error(message);
    error.code = response.status === 403 ? "CANVA_INSUFFICIENT_PERMISSIONS" : "CANVA_API_ERROR";
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

export function prepareCanvaEditUrl(editUrl, correlationState) {
  if (!editUrl) return "";
  const url = new URL(editUrl);
  if (correlationState) url.searchParams.set("correlation_state", correlationState);
  return url.toString();
}

export async function storeCanvaExportedPdf({ workspaceId, userId, documentId, designId, exportUrl, versionNumber }) {
  const response = await fetch(exportUrl);
  if (!response.ok) {
    const error = new Error("Canva export URL expired or could not be downloaded.");
    error.code = "CANVA_EXPORT_URL_EXPIRED";
    error.statusCode = response.status;
    throw error;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const storagePath = `${userId}/standard-inclusions/${workspaceId}/${documentId}/canva-exports/v${versionNumber}.pdf`;
  await uploadStandardInclusionsAsset(storagePath, buffer, "application/pdf", true);
  const { data } = supabaseAdmin.storage.from(STANDARD_INCLUSIONS_BUCKET).getPublicUrl(storagePath);
  return {
    storagePath,
    publicUrl: data?.publicUrl || "",
    bytes: buffer.length,
    designId,
  };
}
