import crypto from "node:crypto";
import { supabaseAdmin } from "../supabaseAdmin";

export const STANDARD_INCLUSIONS_TABLE = "standard_inclusions_documents";
export const STANDARD_INCLUSIONS_BUCKET = "assets";
export const STANDARD_INCLUSIONS_MASTER_PATH = "standard-inclusions/_master/premier-inclusions-schedule.pptx";
export const STANDARD_INCLUSIONS_MASTER_FILE_NAME = "Premier Inclusions Schedule.pptx";

export function onlyOfficeDocumentServerUrl() {
  return String(process.env.ONLYOFFICE_DOCUMENT_SERVER_URL || process.env.NEXT_PUBLIC_ONLYOFFICE_DOCUMENT_SERVER_URL || "").trim().replace(/\/$/, "");
}

export function onlyOfficeJwtSecret() {
  return String(process.env.ONLYOFFICE_JWT_SECRET || "").trim();
}

export function appBaseUrl(req = null) {
  const configured = String(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host || "";
  const proto = req?.headers?.["x-forwarded-proto"] || "http";
  return host ? `${proto}://${host}` : "";
}

export function createOnlyOfficeId(prefix = "standard-inclusions") {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

export function createOnlyOfficeAccessKey(documentId, storagePath, version = 1) {
  const secret = onlyOfficeJwtSecret() || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-standard-inclusions";
  return crypto.createHmac("sha256", secret).update(`${documentId}:${storagePath}:${version}`).digest("hex");
}

export function signOnlyOfficeJwt(payload) {
  const secret = onlyOfficeJwtSecret();
  if (!secret) return "";
  const header = { alg: "HS256", typ: "JWT" };
  const body = payload && typeof payload === "object" ? payload : {};
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedBody = base64Url(JSON.stringify(body));
  const signature = crypto.createHmac("sha256", secret).update(`${encodedHeader}.${encodedBody}`).digest("base64url");
  return `${encodedHeader}.${encodedBody}.${signature}`;
}

export function verifyOnlyOfficeJwt(token) {
  const secret = onlyOfficeJwtSecret();
  if (!secret) return process.env.NODE_ENV !== "production";
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(parts[2]);
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function loadStandardInclusionsDocumentForUser(documentId, userId) {
  const data = await loadStandardInclusionsDocumentById(documentId);
  if (!data) return null;
  assertStandardInclusionsAccess(data, userId);
  return data;
}

export async function loadStandardInclusionsDocumentById(documentId) {
  const { data, error } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_TABLE)
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export function assertStandardInclusionsAccess(document, userId) {
  const owner = String(document?.owner_user_id || "");
  const allowed = Array.isArray(document?.allowed_editor_user_ids) ? document.allowed_editor_user_ids.map(String) : [];
  if (owner === String(userId || "") || allowed.includes(String(userId || ""))) return true;
  const error = new Error("You do not have access to this Standard Inclusions document.");
  error.statusCode = 403;
  throw error;
}

export async function uploadStandardInclusionsAsset(storagePath, body, contentType, upsert = false) {
  const { error } = await supabaseAdmin.storage.from(STANDARD_INCLUSIONS_BUCKET).upload(storagePath, body, {
    contentType,
    upsert,
  });
  if (error) throw error;
  return storagePath;
}

export async function downloadStandardInclusionsAsset(storagePath) {
  const { data, error } = await supabaseAdmin.storage.from(STANDARD_INCLUSIONS_BUCKET).download(storagePath);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

export async function createStandardInclusionsOnlyOfficeDocument({
  id,
  tenantId,
  ownerUserId,
  sourceFileName,
  pptxStoragePath,
  sourceType = "pptx-upload",
  allowedEditorUserIds = [],
}) {
  const now = new Date().toISOString();
  const documentId = id || createOnlyOfficeId("std-inclusions");
  const record = {
    id: documentId,
    tenant_id: String(tenantId || ownerUserId || ""),
    owner_user_id: String(ownerUserId || ""),
    allowed_editor_user_ids: Array.from(new Set([String(ownerUserId || ""), ...allowedEditorUserIds.map(String)].filter(Boolean))),
    version: 1,
    source_file_name: sourceFileName || "Standard Inclusions.pptx",
    source_type: sourceType,
    current_pptx_asset_id: pptxStoragePath,
    current_exported_pdf_asset_id: null,
    created_at: now,
    updated_at: now,
    revision_history: [{
      version: 1,
      action: sourceType,
      pptxAssetId: pptxStoragePath,
      createdAt: now,
      userId: ownerUserId,
    }],
    metadata: {},
  };
  const { data, error } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_TABLE)
    .insert(record)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadStandardInclusionsDocumentForTenant(tenantId) {
  const { data, error } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_TABLE)
    .select("*")
    .eq("tenant_id", String(tenantId || ""))
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function masterTemplateExists() {
  try {
    await downloadStandardInclusionsAsset(STANDARD_INCLUSIONS_MASTER_PATH);
    return true;
  } catch {
    return false;
  }
}

export async function cloneMasterTemplateForTenant({ tenantId, ownerUserId, allowedEditorUserIds = [] }) {
  const masterBytes = await downloadStandardInclusionsAsset(STANDARD_INCLUSIONS_MASTER_PATH);
  const documentId = createOnlyOfficeId("std-inclusions");
  const storagePath = `${ownerUserId}/standard-inclusions/${tenantId}/${documentId}/active/v1.pptx`;
  await uploadStandardInclusionsAsset(
    storagePath,
    masterBytes,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    false,
  );
  return createStandardInclusionsOnlyOfficeDocument({
    id: documentId,
    tenantId,
    ownerUserId,
    sourceFileName: STANDARD_INCLUSIONS_MASTER_FILE_NAME,
    pptxStoragePath: storagePath,
    sourceType: "master-clone",
    allowedEditorUserIds,
  });
}

/**
 * Copies `sourceStoragePath` forward as the document's next revision — the shared
 * primitive behind "Restore Master", "Restore Version", and "Duplicate Version",
 * which all differ only in which existing asset they copy from.
 */
export async function appendStandardInclusionsRevision({ document, sourceStoragePath, action, actorUserId, extraMetadata = {} }) {
  const nextVersion = Number(document.version || 1) + 1;
  const storagePath = `${document.owner_user_id}/standard-inclusions/${document.tenant_id}/${document.id}/revisions/v${nextVersion}.pptx`;
  const sourceBytes = await downloadStandardInclusionsAsset(sourceStoragePath);
  await uploadStandardInclusionsAsset(
    storagePath,
    sourceBytes,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    false,
  );
  const now = new Date().toISOString();
  const revision = {
    id: createOnlyOfficeId("std-inclusions-revision"),
    version: nextVersion,
    action,
    pptxAssetId: storagePath,
    previousPptxAssetId: document.current_pptx_asset_id,
    sourcePptxAssetId: sourceStoragePath,
    userId: actorUserId,
    createdAt: now,
    ...extraMetadata,
  };
  const revisionHistory = [...(Array.isArray(document.revision_history) ? document.revision_history : []), revision].slice(-100);
  const { data, error } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_TABLE)
    .update({
      version: nextVersion,
      current_pptx_asset_id: storagePath,
      current_exported_pdf_asset_id: null,
      updated_at: now,
      revision_history: revisionHistory,
    })
    .eq("id", document.id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function buildOnlyOfficeEditorConfig({ document, user, req }) {
  const documentServerUrl = onlyOfficeDocumentServerUrl();
  if (!documentServerUrl) {
    const error = new Error("ONLYOFFICE_DOCUMENT_SERVER_URL is not configured.");
    error.code = "ONLYOFFICE_DOCUMENT_SERVER_MISSING";
    throw error;
  }
  const baseUrl = appBaseUrl(req);
  if (!baseUrl) throw new Error("APP_URL is required so ONLYOFFICE can fetch and save documents.");
  const storagePath = document.current_pptx_asset_id;
  const version = Number(document.version || 1);
  const accessKey = createOnlyOfficeAccessKey(document.id, storagePath, version);
  const callbackUrl = `${baseUrl}/api/standard-inclusions/onlyoffice/callback?documentId=${encodeURIComponent(document.id)}`;
  const fileUrl = `${baseUrl}/api/standard-inclusions/onlyoffice/file?documentId=${encodeURIComponent(document.id)}&accessKey=${accessKey}`;
  const config = {
    documentType: "slide",
    type: "desktop",
    document: {
      fileType: "pptx",
      key: onlyOfficeDocumentKey(document),
      title: document.source_file_name || "Standard Inclusions.pptx",
      url: fileUrl,
      permissions: {
        edit: true,
        download: true,
        print: true,
        review: true,
      },
    },
    editorConfig: {
      mode: "edit",
      callbackUrl,
      lang: "en",
      user: {
        id: String(user?.id || document.owner_user_id || "user"),
        name: String(user?.email || user?.user_metadata?.full_name || "Editor"),
      },
      customization: {
        autosave: true,
        forcesave: true,
      },
    },
  };
  const token = signOnlyOfficeJwt(config);
  return {
    documentServerUrl,
    scriptUrl: `${documentServerUrl}/web-apps/apps/api/documents/api.js`,
    config: token ? { ...config, token } : config,
  };
}

export function onlyOfficeDocumentKey(document) {
  return `${String(document.id || "").replace(/[^a-zA-Z0-9._-]/g, "_")}-${Number(document.version || 1)}`;
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}
