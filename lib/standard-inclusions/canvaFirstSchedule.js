import { createDocument } from "../../components/document-engine/core/documentState.js";
import { createA4Page } from "../../components/document-engine/core/pageEngine.js";
import { createObject } from "../../components/document-engine/core/objectEngine.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { STANDARD_INCLUSIONS_BUCKET, uploadStandardInclusionsAsset } from "./onlyoffice.js";

const MAX_RENDERED_PAGE_BYTES = 18 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 3 * 1024 * 1024;

export function canvaFirstDocumentFromPages({ document, pages = [], overlays = [] }) {
  const now = new Date().toISOString();
  const sortedPages = [...pages].sort((a, b) => Number(a.order || a.pageIndex || 0) - Number(b.order || b.pageIndex || 0));
  const pageObjects = sortedPages.map((page, index) => {
    const pageOverlays = overlays.filter((overlay) => String(overlay.pageId || "") === String(page.id || page.pageId || ""));
    return createA4Page({
      id: page.id || `canva-page-${index + 1}`,
      name: page.title || `Page ${index + 1}`,
      width: Number(page.width || 794),
      height: Number(page.height || 1123),
      background: {
        color: "#ffffff",
        imageRef: page.publicUrl || page.basePageUrl || "",
        data: {
          source: "canva-first-rendered-page",
          storagePath: page.storagePath || page.basePageStorageKey || "",
          thumbnailUrl: page.thumbnailUrl || "",
          thumbnailStoragePath: page.thumbnailStoragePath || "",
        },
      },
      data: {
        sourcePageId: page.sourcePageId || page.id || "",
        pageIndex: Number(page.pageIndex || index + 1),
        thumbnailUrl: page.thumbnailUrl || "",
        canvaDesignId: document?.canva_design_id || document?.metadata?.canvaFirst?.designId || "",
        editingWorkflow: "locked-canva-page-with-explicit-editable-overlays",
      },
      objects: pageOverlays.map((overlay, overlayIndex) => overlayToObject(overlay, overlayIndex)),
    });
  });
  return createDocument({
    id: `canva-first-standard-inclusions-${document?.id || Date.now()}`,
    name: document?.source_file_name || document?.metadata?.canvaFirst?.designName || "Standard Inclusions Schedule",
    pages: pageObjects,
    activePageId: pageObjects[0]?.id || "",
    metadata: {
      documentType: "standardInclusions",
      documentSource: "canva-first-schedule",
      standardInclusionsDocumentId: document?.id || "",
      canvaDesignId: document?.canva_design_id || document?.metadata?.canvaFirst?.designId || "",
      canvaExportedAt: document?.metadata?.canvaFirst?.exportedAt || "",
      canvaLastRefreshAt: document?.metadata?.canvaFirst?.lastRefreshAt || "",
      importedAt: now,
      lastSavedAt: now,
      nativeImport: true,
      importMode: "canva-first-rendered-page-overlays",
      visualBaseSource: "canva-pdf-rendered-page-image",
      editableSource: "explicit-builder-overlays",
    },
  });
}

export async function storeCanvaRenderedPages({ workspaceId, userId, documentId, pages = [], refreshMode = "keep-compatible" }) {
  const { data: document, error } = await supabaseAdmin
    .from("standard_inclusions_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!document || String(document.organisation_id || document.tenant_id) !== String(workspaceId || "")) {
    const notFound = new Error("The Canva Standard Inclusions document could not be found in this workspace.");
    notFound.statusCode = 404;
    throw notFound;
  }
  if (!Array.isArray(pages) || !pages.length) {
    const empty = new Error("No rendered Canva pages were supplied.");
    empty.statusCode = 400;
    throw empty;
  }

  const now = new Date().toISOString();
  const nextVersion = Number(document.version || 1) + 1;
  const previousCanva = document.metadata?.canvaFirst || {};
  const previousOverlays = Array.isArray(previousCanva.overlays) ? previousCanva.overlays : [];
  const renderedPages = [];

  for (const page of pages) {
    const pageIndex = Number(page.pageIndex || renderedPages.length + 1);
    const imageBytes = decodeDataUrl(page.imageUrl || page.dataUrl, /^image\/(png|jpeg|jpg|webp)$/i, MAX_RENDERED_PAGE_BYTES);
    const thumbBytes = page.thumbnailUrl ? decodeDataUrl(page.thumbnailUrl, /^image\/(png|jpeg|jpg|webp)$/i, MAX_THUMBNAIL_BYTES) : null;
    const pageId = page.id || `canva-page-${String(pageIndex).padStart(2, "0")}`;
    const imageExt = contentTypeExtension(imageBytes.mimeType);
    const imagePath = `${userId}/standard-inclusions/${workspaceId}/${documentId}/canva-pages/v${nextVersion}/page-${String(pageIndex).padStart(2, "0")}.${imageExt}`;
    await uploadStandardInclusionsAsset(imagePath, imageBytes.bytes, imageBytes.mimeType, true);
    const { data: publicImage } = supabaseAdmin.storage.from(STANDARD_INCLUSIONS_BUCKET).getPublicUrl(imagePath);
    let thumbnailPath = "";
    let thumbnailUrl = "";
    if (thumbBytes) {
      const thumbExt = contentTypeExtension(thumbBytes.mimeType);
      thumbnailPath = `${userId}/standard-inclusions/${workspaceId}/${documentId}/canva-pages/v${nextVersion}/thumb-${String(pageIndex).padStart(2, "0")}.${thumbExt}`;
      await uploadStandardInclusionsAsset(thumbnailPath, thumbBytes.bytes, thumbBytes.mimeType, true);
      const { data: publicThumb } = supabaseAdmin.storage.from(STANDARD_INCLUSIONS_BUCKET).getPublicUrl(thumbnailPath);
      thumbnailUrl = publicThumb?.publicUrl || "";
    }
    renderedPages.push({
      id: pageId,
      sourcePageId: page.sourcePageId || pageId,
      pageIndex,
      order: Number(page.order || pageIndex),
      title: page.title || `Page ${pageIndex}`,
      width: Number(page.width || 794),
      height: Number(page.height || 1123),
      storagePath: imagePath,
      publicUrl: publicImage?.publicUrl || "",
      thumbnailStoragePath: thumbnailPath,
      thumbnailUrl,
      renderedAt: now,
    });
  }

  const compatibleOverlays = refreshMode === "replace-all"
    ? []
    : previousOverlays.filter((overlay) => renderedPages.some((page) => page.id === overlay.pageId && overlayFitsPage(overlay, page)));
  const canvaFirst = {
    ...previousCanva,
    designId: document.canva_design_id || previousCanva.designId || "",
    sourceDocumentId: document.id,
    exportedAt: now,
    lastRefreshAt: now,
    refreshMode,
    pageCount: renderedPages.length,
    pages: renderedPages,
    pageOrder: renderedPages.map((page) => page.id),
    overlays: compatibleOverlays,
  };
  const revision = {
    version: nextVersion,
    action: "canva-first-render-pages",
    canvaDesignId: document.canva_design_id || "",
    pageCount: renderedPages.length,
    refreshMode,
    createdAt: now,
    userId,
  };
  const revisionHistory = [...(Array.isArray(document.revision_history) ? document.revision_history : []), revision].slice(-100);
  const update = await supabaseAdmin.from("standard_inclusions_documents").update({
    version: nextVersion,
    page_count: renderedPages.length,
    current_exported_pdf_asset_id: document.current_exported_pdf_asset_id || document.current_export_pdf_storage_key || "",
    updated_at: now,
    revision_history: revisionHistory,
    metadata: {
      ...(document.metadata || {}),
      editorMode: "canva",
      canvaFirst,
    },
  }).eq("id", document.id).select("*").maybeSingle();
  if (update.error) throw update.error;
  const versionInsert = await supabaseAdmin.from("standard_inclusions_versions").insert({
    document_id: document.id,
    version_number: nextVersion,
    canva_design_id: document.canva_design_id || "",
    original_pdf_storage_key: document.original_pdf_storage_key || "",
    export_pdf_storage_key: document.current_export_pdf_storage_key || "",
    preview_storage_keys: renderedPages.map((page) => page.storagePath).filter(Boolean),
    created_reason: "canva-first-render-pages",
    created_by: userId || null,
    metadata: {
      importMode: "canva-first-rendered-page-overlays",
      refreshMode,
      pageCount: renderedPages.length,
      thumbnailStorageKeys: renderedPages.map((page) => page.thumbnailStoragePath).filter(Boolean),
    },
  });
  if (versionInsert.error) throw versionInsert.error;
  const documentBuilder = canvaFirstDocumentFromPages({
    document: update.data,
    pages: renderedPages,
    overlays: compatibleOverlays,
  });
  return { document: update.data, pages: renderedPages, overlays: compatibleOverlays, documentBuilder };
}

function overlayToObject(overlay, layer) {
  const base = {
    id: overlay.id,
    name: overlay.name || overlay.type || "Schedule overlay",
    x: Number(overlay.x || 0),
    y: Number(overlay.y || 0),
    width: Number(overlay.width || 1),
    height: Number(overlay.height || 1),
    layer,
    locked: false,
    data: {
      overlayId: overlay.id,
      pageId: overlay.pageId,
      edited: Boolean(overlay.edited),
      canvaFirstOverlay: true,
    },
  };
  if (overlay.type === "logo" || overlay.type === "image") {
    return createObject(overlay.type === "logo" ? "logo" : "image", {
      ...base,
      data: { ...base.data, imageRef: overlay.imageUrl || "", alt: overlay.alt || overlay.name || "" },
      style: { objectFit: overlay.objectFit || (overlay.type === "logo" ? "contain" : "cover"), borderRadius: Number(overlay.borderRadius || 0) },
    });
  }
  return createObject("text", {
    ...base,
    data: { ...base.data, text: overlay.value || "" },
    style: {
      fontFamily: overlay.fontFamily || "Arial",
      fontSize: Number(overlay.fontSize || 16),
      fontWeight: overlay.fontWeight || 600,
      color: overlay.colour || overlay.color || "#0f172a",
      textAlign: overlay.textAlign || "left",
      lineHeight: Number(overlay.lineHeight || 1.2),
      backgroundColor: "transparent",
    },
  });
}

function decodeDataUrl(dataUrl = "", allowedMimePattern, maxBytes) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)(?:;[^,]*)?,(.+)$/i);
  if (!match || !allowedMimePattern.test(match[1])) {
    const error = new Error("Rendered page asset must be an image data URL.");
    error.statusCode = 400;
    throw error;
  }
  const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > maxBytes) {
    const error = new Error("Rendered page asset is empty or too large.");
    error.statusCode = 413;
    throw error;
  }
  return { mimeType, bytes };
}

function contentTypeExtension(mimeType = "") {
  if (/jpe?g/i.test(mimeType)) return "jpg";
  if (/webp/i.test(mimeType)) return "webp";
  return "png";
}

function overlayFitsPage(overlay, page) {
  const x = Number(overlay.x || 0);
  const y = Number(overlay.y || 0);
  const width = Number(overlay.width || 0);
  const height = Number(overlay.height || 0);
  return x >= -4 && y >= -4 && x + width <= Number(page.width || 0) + 4 && y + height <= Number(page.height || 0) + 4;
}
