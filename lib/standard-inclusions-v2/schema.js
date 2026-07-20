export const STANDARD_INCLUSIONS_V2_SCHEMA_VERSION = 1;
export const STANDARD_INCLUSIONS_V2_PAGE_SIZE = { width: 794, height: 1123 };

export const STANDARD_INCLUSIONS_V2_ELEMENT_TYPES = new Set([
  "text",
  "image",
  "logo",
  "shape",
  "line",
  "icon",
  "table",
  "group",
  "fixedVisual",
]);

export function createStandardInclusionsV2Id(prefix = "stdv2") {
  const random = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

export function createStandardInclusionsV2Page({ name = "Page", order = 0, background = null, elements = [] } = {}) {
  return {
    id: createStandardInclusionsV2Id("page"),
    name,
    order,
    width: STANDARD_INCLUSIONS_V2_PAGE_SIZE.width,
    height: STANDARD_INCLUSIONS_V2_PAGE_SIZE.height,
    background,
    elements: elements.map((element, index) => normaliseStandardInclusionsV2Element(element, index)),
  };
}

export function createStandardInclusionsV2Document({
  tenantId,
  ownerUserId,
  name = "Untitled Standard Inclusions Schedule",
  sourceType = "blank",
  sourceFileName = "",
  sourceChecksum = "",
  pages = [],
  assets = [],
} = {}) {
  const now = new Date().toISOString();
  const documentPages = Array.isArray(pages) && pages.length
    ? pages.map((page, index) => normaliseStandardInclusionsV2Page(page, index))
    : [];
  return {
    id: createStandardInclusionsV2Id("document"),
    tenantId: String(tenantId || "").trim(),
    ownerUserId: String(ownerUserId || "").trim(),
    name,
    schemaVersion: STANDARD_INCLUSIONS_V2_SCHEMA_VERSION,
    sourceType,
    sourceFileName,
    sourceChecksum,
    createdAt: now,
    updatedAt: now,
    activeRevisionId: "",
    pages: documentPages,
    assets: Array.isArray(assets) ? assets : [],
  };
}

export function createBlankStandardInclusionsV2Document({ tenantId, ownerUserId, name = "Standard Inclusions Schedule" } = {}) {
  return createStandardInclusionsV2Document({ tenantId, ownerUserId, name, pages: [] });
}

export function normaliseStandardInclusionsV2Element(element = {}, index = 0) {
  const type = STANDARD_INCLUSIONS_V2_ELEMENT_TYPES.has(element.type) ? element.type : "text";
  return {
    id: element.id || createStandardInclusionsV2Id("element"),
    type,
    x: numberOr(element.x, 0),
    y: numberOr(element.y, 0),
    width: numberOr(element.width, type === "line" ? 120 : 160),
    height: numberOr(element.height, type === "line" ? 2 : 48),
    rotation: numberOr(element.rotation, 0),
    opacity: numberOr(element.opacity, 1),
    zIndex: Number.isFinite(Number(element.zIndex)) ? Number(element.zIndex) : index,
    locked: Boolean(element.locked),
    visible: element.visible !== false,
    style: element.style && typeof element.style === "object" ? { ...element.style } : {},
    content: element.content && typeof element.content === "object" ? { ...element.content } : {},
    assetId: String(element.assetId || ""),
  };
}

export function normaliseStandardInclusionsV2Page(page = {}, index = 0) {
  return {
    id: page.id || createStandardInclusionsV2Id("page"),
    name: page.name || `Page ${index + 1}`,
    order: Number.isFinite(Number(page.order)) ? Number(page.order) : index,
    width: numberOr(page.width, STANDARD_INCLUSIONS_V2_PAGE_SIZE.width),
    height: numberOr(page.height, STANDARD_INCLUSIONS_V2_PAGE_SIZE.height),
    background: page.background || null,
    elements: (Array.isArray(page.elements) ? page.elements : []).map((element, elementIndex) => normaliseStandardInclusionsV2Element(element, elementIndex)),
  };
}

export function normaliseStandardInclusionsV2Document(document = {}) {
  const now = new Date().toISOString();
  return {
    id: String(document.id || createStandardInclusionsV2Id("document")),
    tenantId: String(document.tenantId || "").trim(),
    ownerUserId: String(document.ownerUserId || "").trim(),
    name: String(document.name || "Untitled Standard Inclusions Schedule"),
    schemaVersion: STANDARD_INCLUSIONS_V2_SCHEMA_VERSION,
    sourceType: String(document.sourceType || "blank"),
    sourceFileName: String(document.sourceFileName || ""),
    sourceChecksum: String(document.sourceChecksum || ""),
    createdAt: document.createdAt || now,
    updatedAt: document.updatedAt || now,
    activeRevisionId: String(document.activeRevisionId || ""),
    pages: (Array.isArray(document.pages) ? document.pages : []).map((page, index) => normaliseStandardInclusionsV2Page(page, index)).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    assets: Array.isArray(document.assets) ? document.assets : [],
  };
}

export function checksumStandardInclusionsV2Document(document = {}) {
  const normalized = normaliseStandardInclusionsV2Document(document);
  const stable = stableJson({
    ...normalized,
    updatedAt: "",
    activeRevisionId: "",
  });
  let hash = 0;
  for (let index = 0; index < stable.length; index += 1) {
    hash = ((hash << 5) - hash + stable.charCodeAt(index)) | 0;
  }
  return `stdv2_${Math.abs(hash).toString(16)}`;
}

function numberOr(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
