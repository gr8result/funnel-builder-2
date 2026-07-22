import withAdmin from "../../../lib/withAdmin";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const REQUIRED_PAGE_KEYS = [
  "cover",
  "estimateSummary",
  "about",
  "standardInclusions",
  "pricedPlans",
  "pricing",
  "termsNotes",
  "acceptance",
];

const PROJECT_IMPORT_PAGE_TYPES = new Set(["standardInclusions", "pricedPlans", "inclusions"]);
const MAX_BASE_TEMPLATE_BYTES = 1024 * 1024;
const LARGE_STRING_BYTES = 80 * 1024;
const BINARY_FIELD_PATTERN = /(dataUrl|imageDataUrl|base64|blob|blobUrl|fileBytes|arrayBuffer|pdfBytes|renderedPages|previewImage|thumbnailDataUrl|screenshot|htmlSnapshot|canvasState|editorHistory|undoStack|redoStack|selectedElement|activeSelection|popupPosition|dragState|resizeState|temporaryDrafts|importedFileContents|fileContents)$/i;
const ALLOWED_BLOCK_KEYS = new Set([
  "id",
  "type",
  "content",
  "design",
  "binding",
  "assetId",
  "storagePath",
  "publicUrl",
  "url",
  "src",
  "alt",
  "parentGroupId",
  "groupId",
  "children",
  "locked",
  "hidden",
]);
const ALLOWED_PAGE_BACKGROUND_KEYS = new Set([
  "backgroundColor",
  "backgroundImage",
  "backgroundStyle",
  "backgroundPosition",
  "backgroundSize",
  "color",
  "hiddenFromPdf",
  "source",
  "importedDocumentSlot",
]);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};

function normalizedPageKey(page = {}) {
  return String(page.pageKey || page.page_type || page.pageType || page.id || "").trim();
}

function normalizedPageType(page = {}) {
  return String(page.pageType || page.page_type || page.pageKey || page.id || "").trim();
}

function textValuesFromBlock(block = {}) {
  const content = block.content || {};
  return ["text", "heading", "label", "title", "intro", "body"]
    .map((key) => content[key])
    .filter((value) => typeof value === "string" && value.trim());
}

function valueLooksLikeHtmlTagLeak(value = "") {
  return /&lt;\/?[a-z][\s\S]*?&gt;/i.test(String(value || ""));
}

function byteSize(value = "") {
  return Buffer.byteLength(String(value || ""), "utf8");
}

function payloadAudit(value = {}) {
  const json = JSON.stringify(value || {});
  const pages = Array.isArray(value?.pages) ? value.pages : [];
  const blocks = pages.flatMap((page) => Array.isArray(page?.blocks) ? page.blocks : []);
  const topLevelFields = Object.entries(value || {})
    .map(([field, entry]) => ({ field, bytes: byteSize(JSON.stringify(entry ?? null)) }))
    .sort((a, b) => b.bytes - a.bytes);
  return {
    totalBytes: byteSize(json),
    totalMb: Number((byteSize(json) / 1024 / 1024).toFixed(3)),
    topLevelFields: topLevelFields.slice(0, 10),
    pageCount: pages.length,
    elementCount: blocks.length,
  };
}

function findPayloadHazards(value, path = "$") {
  const hazards = [];
  const visit = (entry, entryPath) => {
    const key = String(entryPath.split(".").pop() || "");
    if (typeof entry === "string") {
      const size = byteSize(entry);
      if (/^data:/i.test(entry) || /;base64,/i.test(entry)) {
        hazards.push({ path: entryPath, reason: "embedded data/base64 URL", bytes: size });
      } else if (BINARY_FIELD_PATTERN.test(key)) {
        hazards.push({ path: entryPath, reason: "forbidden binary/transient field", bytes: size });
      } else if (size > LARGE_STRING_BYTES && !/(text|heading|label|title|body|intro|notice|description|content)$/i.test(key)) {
        hazards.push({ path: entryPath, reason: "unexpected large string", bytes: size });
      }
      return;
    }
    if (Array.isArray(entry)) {
      if (BINARY_FIELD_PATTERN.test(key)) hazards.push({ path: entryPath, reason: "forbidden binary/transient array" });
      entry.forEach((child, index) => visit(child, `${entryPath}[${index}]`));
      return;
    }
    if (entry && typeof entry === "object") {
      if (BINARY_FIELD_PATTERN.test(key)) hazards.push({ path: entryPath, reason: "forbidden binary/transient object" });
      Object.entries(entry).forEach(([childKey, child]) => visit(child, `${entryPath}.${childKey}`));
    }
  };
  visit(value, path);
  return hazards;
}

function blockViolatesBounds(block = {}, pageKey = "") {
  const design = block.design || {};
  const frame = design.frame || {};
  const x = Number(frame.x ?? design.translateX ?? 0) || 0;
  const y = Number(frame.y ?? design.translateY ?? 0) || 0;
  const width = Number(frame.width ?? design.widthOverride ?? 0) || 0;
  const height = Number(frame.height ?? design.heightOverride ?? 0) || 0;
  if (x < 0 || y < 0) return `${pageKey}/${block.id}: negative position`;
  if (width > 0 && x + width > 794) return `${pageKey}/${block.id}: extends beyond page width`;
  if (height > 0 && y + height > 1123) return `${pageKey}/${block.id}: extends beyond page height`;
  return "";
}

function sanitizeBlock(block = {}) {
  const next = Object.entries(block || {}).reduce((allowed, [key, value]) => {
    if (ALLOWED_BLOCK_KEYS.has(key)) allowed[key] = value;
    return allowed;
  }, {});
  next.content = { ...(block.content || {}) };
  next.design = { ...(block.design || {}) };
  if (block.binding && typeof block.binding === "object") next.binding = { ...block.binding };
  if (Array.isArray(block.children)) next.children = block.children.map(sanitizeBlock);
  if (!next.id) throw new Error("Every editable element must have a stable element ID.");
  if (next.type === "quote_field") {
    delete next.content.text;
    delete next.content.value;
  }
  return next;
}

function sanitizeObjectByKeys(value = {}, allowedKeys = new Set()) {
  return Object.entries(value && typeof value === "object" && !Array.isArray(value) ? value : {}).reduce((next, [key, entry]) => {
    if (allowedKeys.has(key) && entry !== undefined) next[key] = entry;
    return next;
  }, {});
}

function sanitizePage(page = {}) {
  const pageKey = normalizedPageKey(page);
  const pageType = normalizedPageType(page);
  if (!pageKey) throw new Error("Every page must have a stable page key.");
  const blocks = Array.isArray(page.blocks) ? page.blocks.map(sanitizeBlock) : [];
  return {
    pageKey,
    pageName: String(page.pageName || page.title || pageKey),
    pageType,
    pageOrder: Number(page.pageOrder) || 0,
    width: Number(page.width) || 794,
    height: Number(page.height) || 1123,
    orientation: page.orientation === "landscape" ? "landscape" : "portrait",
    background: {
      ...sanitizeObjectByKeys(page.background || {}, ALLOWED_PAGE_BACKGROUND_KEYS),
      importedDocumentSlot: PROJECT_IMPORT_PAGE_TYPES.has(pageType) ? pageType : undefined,
    },
    importedDocument: null,
    blocks,
  };
}

function sanitizeSettings(settings = {}) {
  const source = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  return {
    ...(source.theme && typeof source.theme === "object" && !Array.isArray(source.theme) ? { theme: source.theme } : {}),
    ...(source.sourceTemplateVersion ? { sourceTemplateVersion: source.sourceTemplateVersion } : {}),
    ...(source.importSlots && typeof source.importSlots === "object" && !Array.isArray(source.importSlots) ? { importSlots: source.importSlots } : {}),
  };
}

function validateBaseTemplatePayload({ pages, forbiddenProjectValues = [] }) {
  if (!Array.isArray(pages) || !pages.length) throw new Error("No Project Estimate pages were supplied.");

  const pageKeys = new Set(pages.map(normalizedPageKey).filter(Boolean));
  const missing = REQUIRED_PAGE_KEYS.filter((key) => !pageKeys.has(key));
  if (missing.length) throw new Error(`Required Project Estimate pages are missing: ${missing.join(", ")}`);

  const forbiddenValues = forbiddenProjectValues
    .map((value) => String(value || "").trim())
    .filter((value) => value.length >= 4);

  pages.forEach((page) => {
    const pageKey = normalizedPageKey(page);
    if (page.importedDocument) throw new Error(`${pageKey}: imported job documents cannot be embedded in the system base template.`);
    if (PROJECT_IMPORT_PAGE_TYPES.has(normalizedPageType(page)) && page.importedDocument) {
      throw new Error(`${pageKey}: job-specific plans or inclusions are embedded.`);
    }
    (page.blocks || []).forEach((block) => {
      if (!block?.id) throw new Error(`${pageKey}: an editable element is missing a stable ID.`);
      const boundsError = blockViolatesBounds(block, pageKey);
      if (boundsError) throw new Error(boundsError);
      textValuesFromBlock(block).forEach((text) => {
        if (valueLooksLikeHtmlTagLeak(text)) throw new Error(`${pageKey}/${block.id}: raw HTML tags appear encoded in visible text.`);
        const matchedValue = forbiddenValues.find((value) => text.includes(value));
        if (matchedValue) throw new Error(`${pageKey}/${block.id}: project-specific value "${matchedValue}" is stored as static template wording.`);
      });
    });
  });
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const audit = payloadAudit(req.body || {});
    const hazards = findPayloadHazards(req.body || {});
    if (audit.totalBytes > MAX_BASE_TEMPLATE_BYTES || hazards.length) {
      const largest = hazards.slice().sort((a, b) => (b.bytes || 0) - (a.bytes || 0))[0]
        || audit.topLevelFields[0]
        || null;
      return res.status(413).json({
        ok: false,
        error: "Base template could not be saved because the request contained embedded files or was too large.",
        diagnostic: {
          payloadSizeBytes: audit.totalBytes,
          payloadSizeMb: audit.totalMb,
          largestField: largest?.path || largest?.field || "",
          largestFieldBytes: largest?.bytes || 0,
          pageCount: audit.pageCount,
          elementCount: audit.elementCount,
          hazardCount: hazards.length,
        },
      });
    }
    const pages = Array.isArray(req.body?.pages) ? req.body.pages.map(sanitizePage) : [];
    const pageOrder = Array.isArray(req.body?.pageOrder) && req.body.pageOrder.length
      ? req.body.pageOrder
      : pages.map((page) => page.pageKey);
    validateBaseTemplatePayload({ pages, forbiddenProjectValues: req.body?.forbiddenProjectValues || [] });

    const settings = {
      ...sanitizeSettings(req.body?.settings),
      templateType: "project_estimate",
      updatedByEmail: req.user?.email || "",
      updatedFrom: "project-estimate-editor",
      importedDocumentsPolicy: "slots-only",
    };

    const { data, error } = await supabaseAdmin.rpc("replace_project_estimate_system_base_template", {
      p_pages: pages,
      p_page_order: pageOrder,
      p_settings: settings,
      p_updated_by: req.user.id,
      p_version_label: `Before base update by ${req.user.email || req.user.id}`,
    });
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      message: "Project Estimate base template updated successfully.",
      templateId: data?.templateId || data?.templateid || "",
      version: data?.version || null,
      pageCount: data?.pageCount || data?.pagecount || pages.length,
      audit,
    });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error?.message || "Update failed" });
  }
}

export default withAdmin(handler);
