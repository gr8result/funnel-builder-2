import crypto from "node:crypto";
import { createDocument } from "../../components/document-engine/core/documentState.js";
import { createA4Page } from "../../components/document-engine/core/pageEngine.js";
import { createObject } from "../../components/document-engine/core/objectEngine.js";
import { STANDARD_INCLUSIONS_BUCKET, uploadStandardInclusionsAsset } from "./onlyoffice.js";
import { supabaseAdmin } from "../supabaseAdmin.js";

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_MANIFEST_BYTES = 12 * 1024 * 1024;
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const IMPORT_SECRET = process.env.CANVA_APP_IMPORT_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-canva-app-import-secret";

const store = globalThis.__gr8CanvaAppImportStore || {
  sessions: new Map(),
};
globalThis.__gr8CanvaAppImportStore = store;

export function createCanvaAppImportSession({ workspaceId, userId, organisationId = "" }) {
  const id = crypto.randomUUID();
  const nonce = crypto.randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const session = {
    id,
    organisationId: organisationId || workspaceId || "default",
    workspaceId,
    userId,
    expiresAt,
    nonce,
    status: "created",
    designId: "",
    manifest: null,
    assets: new Map(),
    document: null,
    validation: null,
    error: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.sessions.set(id, session);
  return { session: publicSession(session), token: signImportToken(session) };
}

export function loadCanvaAppImportSession(token) {
  const verified = verifyImportToken(token);
  const session = verified ? store.sessions.get(verified.id) : null;
  if (!session || session.nonce !== verified?.nonce) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    session.status = "failed";
    session.error = "Import session expired.";
    return null;
  }
  return session;
}

export function publicSession(session) {
  return {
    id: session.id,
    organisationId: session.organisationId,
    userId: session.userId,
    expiresAt: session.expiresAt,
    nonce: session.nonce,
    status: session.status,
    designId: session.designId,
    pageCount: Array.isArray(session.manifest?.pages) ? session.manifest.pages.length : 0,
    validation: session.validation,
    error: session.error,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function assertRequestSize(req, maxBytes = MAX_MANIFEST_BYTES) {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength && contentLength > maxBytes) {
    const error = new Error("Import request is too large.");
    error.statusCode = 413;
    error.code = "CANVA_APP_IMPORT_TOO_LARGE";
    throw error;
  }
}

export async function attachCanvaAppManifest(session, manifest) {
  validateManifest(manifest);
  session.status = "uploading";
  session.designId = String(manifest.designId || "");
  session.manifest = manifest;
  session.updatedAt = new Date().toISOString();
  return publicSession(session);
}

export async function attachCanvaAppAsset(session, asset = {}) {
  const sourceElementId = String(asset.sourceElementId || "");
  const fileName = String(asset.fileName || `${sourceElementId || crypto.randomUUID()}.bin`).replace(/[^\w.\-]+/g, "-");
  const mimeType = String(asset.mimeType || "");
  if (!sourceElementId) throw codedError("CANVA_APP_ASSET_SOURCE_REQUIRED", "Asset sourceElementId is required.", 400);
  if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/i.test(mimeType)) throw codedError("CANVA_APP_ASSET_TYPE_INVALID", "Only image assets can be imported.", 415);
  const bytes = asset.base64 ? decodeBase64Asset(asset.base64 || "") : null;
  let publicUrl = String(asset.publicUrl || "");
  let storagePath = "";
  if (bytes) {
    if (!bytes.length || bytes.length > MAX_ASSET_BYTES) throw codedError("CANVA_APP_ASSET_SIZE_INVALID", "Asset is empty or too large.", 413);
    storagePath = `${session.userId}/standard-inclusions/${session.workspaceId}/canva-app-imports/${session.id}/assets/${fileName}`;
    await uploadStandardInclusionsAsset(storagePath, bytes, mimeType, true);
    const { data } = supabaseAdmin.storage.from(STANDARD_INCLUSIONS_BUCKET).getPublicUrl(storagePath);
    publicUrl = data?.publicUrl || "";
  } else if (!/^https?:\/\//i.test(publicUrl) && !publicUrl.startsWith("data:image/")) {
    throw codedError("CANVA_APP_ASSET_URL_REQUIRED", "Asset must include a base64 image or public image URL.", 400);
  }
  const record = {
    sourceElementId,
    sourcePageId: String(asset.sourcePageId || ""),
    pageIndex: Number(asset.pageIndex || 0),
    role: String(asset.role || ""),
    assetId: storagePath || publicUrl,
    storagePath,
    publicUrl,
    mimeType,
    bytes: bytes?.length || 0,
    importedAt: new Date().toISOString(),
  };
  session.assets.set(sourceElementId, record);
  session.updatedAt = new Date().toISOString();
  return record;
}

export function buildNativeDocumentFromCanvaManifest(session) {
  const manifest = session.manifest;
  validateManifest(manifest);
  session.status = "validating";
  const assets = session.assets;
  const pages = manifest.pages.map((page, pageIndex) => {
    const pageWidth = Number(page.width || manifest.pageSize?.width || 794);
    const pageHeight = Number(page.height || manifest.pageSize?.height || 1123);
    const pageRenderAsset = pageRenderedAsset({ page, assets });
    const sourceElements = flattenImportedElements(page.elements || []);
    const importElements = pageRenderAsset ? sourceElements.filter(isCanvaActivationOverlayElement) : sourceElements;
    const objects = importElements.map((element, index) => convertCanvaElementToObject({
      element,
      page,
      pageIndex,
      layer: index,
      assets,
      session,
      hybridBaseAvailable: Boolean(pageRenderAsset),
    }));
    return createA4Page({
      id: `canva-app-page-${page.sourcePageId || pageIndex + 1}`,
      name: `Page ${pageIndex + 1}`,
      width: pageWidth,
      height: pageHeight,
      background: pageRenderAsset
        ? { color: "#ffffff", imageRef: pageRenderAsset.publicUrl, data: { source: "canva-rendered-page", assetId: pageRenderAsset.assetId, sourceElementId: pageRenderAsset.sourceElementId } }
        : normaliseBackground(page.background),
      data: {
        sourcePageId: page.sourcePageId || "",
        importSessionId: session.id,
        canvaDesignId: manifest.designId,
        pageIndex: page.pageIndex || pageIndex + 1,
        renderedPageAssetId: pageRenderAsset?.assetId || "",
        editingWorkflow: pageRenderAsset ? "high-fidelity-rendered-page-with-editable-activation-overlays" : "native-object-conversion",
      },
      objects,
    });
  });
  const document = createDocument({
    id: `canva-app-standard-inclusions-${session.id}`,
    name: manifest.designName || "System Base - Premier Inclusions Schedule",
    pages,
    activePageId: pages[0]?.id || "",
    metadata: {
      documentType: "standardInclusions",
      documentSource: "canva-app-native-import",
      importSessionId: session.id,
      canvaDesignId: manifest.designId,
      canvaDesignName: manifest.designName || "",
      importedAt: new Date().toISOString(),
      sourcePageCount: manifest.pages.length,
      fontSubstitutions: [],
      nativeImport: true,
      importMode: pages.some((page) => page.background?.imageRef) ? "canva-app-hybrid-rendered-page" : "canva-app-object-conversion",
      editableSource: "canva-app-design-editing-api",
      visualBaseSource: pages.some((page) => page.background?.imageRef) ? "canva-rendered-page-image" : "native-object-conversion",
    },
  });
  const validation = validateNativeCanvaDocument({ manifest, document, assets });
  session.document = document;
  session.validation = validation;
  session.status = validation.canPublish ? "complete" : "failed";
  session.error = validation.canPublish ? "" : validation.errors[0] || "Canva App import failed validation.";
  session.updatedAt = new Date().toISOString();
  return { document, validation };
}

export function validateNativeCanvaDocument({ manifest, document, assets }) {
  const errors = [];
  const pageResults = [];
  const manifestPages = Array.isArray(manifest?.pages) ? manifest.pages : [];
  const docPages = Array.isArray(document?.pages) ? document.pages : [];
  if (!manifestPages.length) errors.push("Manifest contains no pages.");
  if (manifestPages.length !== docPages.length) errors.push(`Page count mismatch: ${docPages.length}/${manifestPages.length}.`);
  docPages.forEach((page, index) => {
    const sourcePage = manifestPages[index] || {};
    const sourceElements = flattenImportedElements(sourcePage.elements || []);
    const pageErrors = [];
    const hasVisualReference = Boolean(page.background?.imageRef);
    if (Number(page.width) !== Number(sourcePage.width || page.width)) pageErrors.push("Page width mismatch.");
    if (Number(page.height) !== Number(sourcePage.height || page.height)) pageErrors.push("Page height mismatch.");
    if (!hasVisualReference) pageErrors.push("Rendered Canva page reference is missing.");
    if (!hasVisualReference && !page.objects.length && sourceElements.length) pageErrors.push("Visible elements were not converted.");
    page.objects.forEach((object) => {
      if (object.type === "text" && !String(object.data?.text || "").trim()) pageErrors.push(`Text object ${object.id} is empty.`);
      if ((object.type === "image" || object.type === "logo") && object.data?.sourceElementId && object.data?.overlayMode !== "canva-image-activation" && !object.data?.imageRef && !assets.has(object.data.sourceElementId)) {
        pageErrors.push(`Image object ${object.id} has no persisted asset.`);
      }
    });
    pageResults.push({
      pageNumber: index + 1,
      status: pageErrors.length ? "Failed" : "Needs review",
      width: page.width,
      height: page.height,
      hasVisualReference,
      thumbnailBlank: !hasVisualReference,
      textElements: page.objects.filter((object) => object.type === "text").length,
      imageElements: page.objects.filter((object) => object.type === "image" || object.type === "logo").length,
      shapeElements: page.objects.filter((object) => object.type === "shape" || object.type === "divider").length,
      groupElements: sourceElements.filter((element) => element.type === "group").length,
      fallbackElements: page.objects.filter((object) => object.data?.importedVisualElement).length,
      editingWorkflow: page.data?.editingWorkflow || "",
      errors: pageErrors,
    });
    errors.push(...pageErrors.map((error) => `Page ${index + 1}: ${error}`));
  });
  return {
    canPublish: errors.length === 0,
    status: errors.length ? "Failed" : "Needs review",
    errors,
    pages: pageResults,
    differenceScores: [],
    message: errors.length ? "Import failed validation. Existing Standard Inclusions template was not changed." : "Draft import created with rendered Canva pages and editable activation overlays. Administrator review is required before publishing.",
  };
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") throw codedError("CANVA_APP_MANIFEST_REQUIRED", "Import manifest is required.", 400);
  if (!manifest.designId) throw codedError("CANVA_APP_DESIGN_REQUIRED", "Canva design ID is required.", 400);
  if (!Array.isArray(manifest.pages) || !manifest.pages.length) throw codedError("CANVA_APP_PAGES_REQUIRED", "At least one Canva page is required.", 400);
  if (manifest.pages.length > 100) throw codedError("CANVA_APP_PAGE_LIMIT", "Import contains too many pages.", 413);
}

function flattenImportedElements(elements = [], parent = null, output = []) {
  elements.forEach((element) => {
    const current = { ...element, parentSourceElementId: parent?.sourceElementId || element.parentSourceElementId || "" };
    output.push(current);
    if (Array.isArray(element.children) && element.children.length) flattenImportedElements(element.children, current, output);
  });
  return output;
}

function convertCanvaElementToObject({ element, page, layer, assets, session, hybridBaseAvailable = false }) {
  const base = {
    id: `canva-${element.sourceElementId || crypto.randomUUID()}`,
    name: element.name || element.type || "Canva element",
    x: scaleCoordinate(element.x ?? element.left, page.width, page.width),
    y: scaleCoordinate(element.y ?? element.top, page.height, page.height),
    width: Number(element.width || 1),
    height: Number(element.height || 1),
    rotation: Number(element.rotation || 0),
    opacity: Number.isFinite(Number(element.opacity)) ? Number(element.opacity) : 1,
    layer: Number.isFinite(Number(element.zIndex)) ? Number(element.zIndex) : layer,
    locked: Boolean(element.locked),
    data: {
      sourceElementId: element.sourceElementId || "",
      sourcePageId: page.sourcePageId || "",
      importSessionId: session.id,
      canvaType: element.type || "",
      groupPath: element.groupPath || [],
      parentSourceElementId: element.parentSourceElementId || "",
    },
  };
  if (element.type === "text") {
    return createObject("text", {
      ...base,
      data: {
        ...base.data,
        text: element.text || "",
        richTextRuns: element.richTextRuns || [],
        originalFontRefs: collectFontRefs(element.richTextRuns || []),
        overlayMode: hybridBaseAvailable ? "canva-text-activation" : "",
        editableSource: "canva",
        duplicateSuppression: hybridBaseAvailable ? "hidden-until-edited" : "",
      },
      style: {
        fontFamily: firstRunValue(element.richTextRuns, "fontFamily") || element.fontFamily || "Arial",
        fontSize: firstRunValue(element.richTextRuns, "fontSize") || element.fontSize || 16,
        fontWeight: firstRunValue(element.richTextRuns, "fontWeight") || element.fontWeight || 400,
        fontStyle: firstRunValue(element.richTextRuns, "fontStyle") || element.fontStyle || "normal",
        textDecoration: firstRunValue(element.richTextRuns, "textDecoration") || element.textDecoration || "none",
        color: firstRunValue(element.richTextRuns, "colour") || element.colour || "#111827",
        textAlign: element.textAlign || "left",
        lineHeight: element.lineHeight || 1.2,
        letterSpacing: firstRunValue(element.richTextRuns, "letterSpacing") || element.letterSpacing || 0,
        overflow: "hidden",
      },
    });
  }
  if (element.type === "image" || element.image || element.assetRef) {
    const asset = assets.get(element.sourceElementId || "") || null;
    return createObject("image", {
      ...base,
      data: {
        ...base.data,
        imageRef: asset?.publicUrl || element.previewUrl || "",
        assetId: asset?.assetId || element.assetId || "",
        crop: element.crop || null,
        mask: element.mask || null,
        overlayMode: hybridBaseAvailable ? "canva-image-activation" : "",
        editableSource: "canva",
        duplicateSuppression: hybridBaseAvailable ? "hidden-until-edited" : "",
        sourceImageRef: asset?.publicUrl || element.previewUrl || "",
      },
      style: {
        objectFit: element.fit || "cover",
        borderRadius: Number(element.borderRadius || 0),
      },
    });
  }
  if (element.unsupported || element.type === "unsupported") {
    const asset = assets.get(element.sourceElementId || "") || null;
    return createObject("image", {
      ...base,
      locked: false,
      data: {
        ...base.data,
        imageRef: asset?.publicUrl || element.previewUrl || "",
        assetId: asset?.assetId || "",
        importedVisualElement: true,
      },
      style: { objectFit: "contain" },
    });
  }
  if (element.type === "line") {
    return createObject("divider", {
      ...base,
      height: Math.max(1, Number(element.strokeWidth || base.height || 1)),
      data: { ...base.data, orientation: Number(base.height) > Number(base.width) ? "vertical" : "horizontal" },
      style: { color: element.stroke || element.fill || "#111827", thickness: Number(element.strokeWidth || 1) },
    });
  }
  return createObject("shape", {
    ...base,
    data: {
      ...base.data,
      shape: element.shape || element.type || "rectangle",
      gradient: element.gradient || null,
    },
    style: {
      fill: element.fill || "transparent",
      stroke: element.stroke || "transparent",
      strokeWidth: Number(element.strokeWidth || 0),
      borderRadius: Number(element.borderRadius || 0),
    },
  });
}

function normaliseBackground(background) {
  if (!background) return { color: "#ffffff", imageRef: null };
  return {
    color: background.color || background.fill || "#ffffff",
    imageRef: background.imageRef || background.imageUrl || null,
    data: background,
  };
}

function pageRenderedAsset({ page, assets }) {
  const declaredId = page?.renderedPageAsset?.sourceElementId || "";
  if (declaredId && assets.has(declaredId)) return assets.get(declaredId);
  const sourcePageId = String(page?.sourcePageId || "");
  const pageIndex = Number(page?.pageIndex || 0);
  return Array.from(assets.values()).find((asset) => (
    asset.role === "page-render"
    && ((sourcePageId && asset.sourcePageId === sourcePageId) || (pageIndex && asset.pageIndex === pageIndex))
  )) || null;
}

function isCanvaActivationOverlayElement(element = {}) {
  if (element.type === "text") return Boolean(String(element.text || "").trim());
  if (element.type === "image" || element.image || element.assetRef) {
    const name = `${element.name || ""} ${element.groupPath || ""}`.toLowerCase();
    if (/logo|brand|icon|arrow|check|tick|footer|divider|line|background|texture|pattern/.test(name)) return false;
    return Number(element.width || 0) * Number(element.height || 0) >= 9000;
  }
  return false;
}

function firstRunValue(runs = [], key) {
  const run = runs.find((item) => item && item[key] !== undefined && item[key] !== null && item[key] !== "");
  return run ? run[key] : undefined;
}

function collectFontRefs(runs = []) {
  return Array.from(new Set(runs.map((run) => run.fontRef).filter(Boolean)));
}

function scaleCoordinate(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function signImportToken(session) {
  const payload = `${session.id}.${session.nonce}.${session.expiresAt}`;
  const signature = crypto.createHmac("sha256", IMPORT_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyImportToken(token = "") {
  const parts = String(token || "").split(".");
  if (parts.length !== 4) return null;
  const [id, nonce, expiresAt, signature] = parts;
  const payload = `${id}.${nonce}.${expiresAt}`;
  const expected = crypto.createHmac("sha256", IMPORT_SECRET).update(payload).digest("base64url");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  if (new Date(expiresAt).getTime() < Date.now()) return null;
  return { id, nonce, expiresAt };
}

function decodeBase64Asset(value = "") {
  const base64 = String(value || "").replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(base64, "base64");
}

function codedError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}
