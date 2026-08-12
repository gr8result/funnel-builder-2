import { calculateSessionBudget, numberValue, roundMoney } from "./selectionBudget.js";

export const FINAL_INCLUSIONS_DOCUMENT_TYPE = "selection";
export const FINAL_INCLUSIONS_SOURCE_TYPE = "final_inclusions_schedule";
export const FINAL_INCLUSIONS_TITLE = "Final Inclusions Schedule";
export const PREMIER_INCLUSIONS_MASTER_PAGE_COUNT = 10;

export const DEFAULT_INCLUSIONS_DOCUMENT_THEME = Object.freeze({
  name: "Premier Final Inclusions",
  paperSize: "A4",
  accent: "#0f766e",
  ink: "#102033",
  muted: "#516173",
  border: "#d7e0e7",
  surface: "#ffffff",
  soft: "#f4f7f8",
  warning: "#b45309",
  credit: "#047857",
  upgrade: "#b91c1c",
});

const CLIENT_SELECTION_KEYS = [
  "id",
  "session_id",
  "snapshot_id",
  "category",
  "subcategory",
  "room",
  "title",
  "description",
  "allowance_amount",
  "included_allowance",
  "selected_product_name",
  "selected_supplier_name",
  "selected_colour",
  "selected_finish",
  "selected_details",
  "status",
  "selection_status",
  "approved_at",
  "approved_by_name",
  "brand",
  "product_name",
  "model_number",
  "image_url",
  "specification_url",
  "finish",
  "colour",
  "client_selection_price",
  "calculated_client_selection_price",
  "variation_amount",
  "is_included_selection",
  "is_active",
  "metadata",
  "created_at",
  "updated_at",
];

const INTERNAL_FIELD_PATTERN = /(cost|markup|margin|supplier_quote|private|trade|builder|wholesale|buy_price|sell_price_internal)/i;

export function createProjectInclusionsSnapshot({
  project = {},
  workspaceId = "",
  selections = [],
  session = {},
  estimateSnapshot = {},
  generatedBy = "",
  approvedAt = "",
  createdAt = new Date().toISOString(),
  masterTemplate = {},
  masterPdfRef = null,
  closingPdfRef = null,
} = {}) {
  const clientSelections = selections
    .filter(isCurrentSelection)
    .filter(isClientVisibleSelection)
    .map(sanitiseClientSelection)
    .sort(compareSelectionsForSchedule);

  const currency = project.currency || session.currency || "AUD";
  const sourceBudget = calculateSessionBudget({
    originalEstimateTotal: session.original_estimate_total || estimateSnapshot.final_quote_total || project.original_estimate_total || project.contract_total || 0,
    privateUpgradeCeiling: session.private_upgrade_ceiling || 0,
    warningThresholdPercent: session.warning_threshold_percent,
    selections: selections.filter(isCurrentSelection),
  });
  const includedAllowanceTotal = roundMoney(clientSelections.reduce((total, selection) => total + numberValue(selection.includedAllowance), 0));
  const selectedTotal = roundMoney(clientSelections.reduce((total, selection) => total + numberValue(selection.clientSelectionPrice), 0));
  const currentNetSelectionVariation = roundMoney(clientSelections.reduce((total, selection) => total + numberValue(selection.variationAmount), 0));
  const currentUpdatedEstimateTotal = roundMoney(sourceBudget.originalEstimateTotal + currentNetSelectionVariation);
  const fingerprint = createSelectionFingerprint(clientSelections);
  const dynamicPages = createDynamicPageDescriptors(clientSelections);
  const masterPageCount = Number(masterTemplate.pageCount || masterTemplate.pages?.length || PREMIER_INCLUSIONS_MASTER_PAGE_COUNT);

  return deepFreeze(cloneJson({
    schemaVersion: 1,
    documentKind: FINAL_INCLUSIONS_SOURCE_TYPE,
    title: FINAL_INCLUSIONS_TITLE,
    workspaceId: workspaceId || project.workspace_id || session.workspace_id || "",
    project: {
      id: project.id || session.project_id || "",
      name: project.project_name || project.name || "Project",
      clientName: project.client_name || "",
      siteAddress: project.site_address || "",
      currency,
    },
    estimateSnapshot: {
      id: estimateSnapshot.id || session.snapshot_id || "",
      number: estimateSnapshot.snapshot_number || "",
      label: estimateSnapshot.snapshot_label || "",
      quoteNumber: estimateSnapshot.source_quote_number || "",
    },
    selectionSession: {
      id: session.id || "",
      name: session.session_name || "Client Selections",
      status: session.status || "",
      approvedAt: approvedAt || session.approved_at || "",
      selectionBudgetStatus: sourceBudget.selectionBudgetStatus,
    },
    summary: {
      productCount: clientSelections.length,
      dynamicPageCount: dynamicPages.length,
      masterPageCount,
      totalPageCount: masterPageCount + dynamicPages.length + 1,
      originalEstimateTotal: sourceBudget.originalEstimateTotal,
      selectedTotal,
      includedAllowanceTotal,
      currentNetSelectionVariation,
      currentUpdatedEstimateTotal,
    },
    selections: clientSelections,
    dynamicPages,
    masterTemplate: {
      id: masterTemplate.id || masterTemplate.metadata?.masterTemplateId || "premier-inclusions-master",
      version: masterTemplate.version || masterTemplate.metadata?.version || "native-master",
      pageCount: masterPageCount,
      source: masterTemplate.metadata?.documentSource || "native-master",
    },
    masterPdfRef,
    closingPdfRef,
    generatedBy,
    createdAt,
    selectionFingerprint: fingerprint,
  }));
}

export function createFinalInclusionsDocumentVersion({
  snapshot,
  previousDocuments = [],
  generatedAt = new Date().toISOString(),
  fileRef = {},
  version,
} = {}) {
  if (!snapshot?.selectionFingerprint) throw new Error("A final inclusions snapshot is required.");
  const previousVersions = previousDocuments
    .filter((document) => document?.metadata?.finalInclusionsSchedule === true || document?.sourceType === FINAL_INCLUSIONS_SOURCE_TYPE)
    .map((document) => Number(document.version || document.metadata?.version || 0))
    .filter(Number.isFinite);
  const nextVersion = Number(version || Math.max(0, ...previousVersions) + 1);
  const projectId = snapshot.project?.id || "project";
  const snapshotId = snapshot.estimateSnapshot?.id || snapshot.selectionSession?.id || "snapshot";
  const fileName = fileRef.fileName || `final-inclusions-schedule-v${nextVersion}.pdf`;
  const storagePath = fileRef.storagePath || `builder-projects/${projectId}/final-inclusions/${snapshotId}/${fileName}`;
  const publicUrl = fileRef.publicUrl || "";

  return {
    id: fileRef.id || `final-inclusions-${projectId}-${nextVersion}`,
    title: FINAL_INCLUSIONS_TITLE,
    fileName,
    file_name: fileName,
    publicUrl,
    public_url: publicUrl,
    storagePath,
    storage_path: storagePath,
    sourceType: FINAL_INCLUSIONS_SOURCE_TYPE,
    source_type: FINAL_INCLUSIONS_SOURCE_TYPE,
    document_type: FINAL_INCLUSIONS_DOCUMENT_TYPE,
    status: "active",
    active: true,
    version: nextVersion,
    projectId,
    project_id: projectId,
    estimateId: snapshot.estimateSnapshot?.id || "",
    estimate_id: snapshot.estimateSnapshot?.id || "",
    pageCount: snapshot.summary?.totalPageCount || 1,
    page_count: snapshot.summary?.totalPageCount || 1,
    uploadedAt: generatedAt,
    uploaded_at: generatedAt,
    fileHash: snapshot.selectionFingerprint,
    file_hash: snapshot.selectionFingerprint,
    metadata: {
      finalInclusionsSchedule: true,
      sourceType: FINAL_INCLUSIONS_SOURCE_TYPE,
      version: nextVersion,
      generatedAt,
      masterTemplate: snapshot.masterTemplate,
      selectionFingerprint: snapshot.selectionFingerprint,
      selectionSnapshot: snapshot,
      pdfMergePlan: finalInclusionsPdfMergePlan({
        masterPdf: snapshot.masterPdfRef,
        dynamicPdf: { storagePath, publicUrl, pageCount: snapshot.summary?.dynamicPageCount || 0 },
        closingPdf: null,
      }),
    },
  };
}

export function isFinalInclusionsDocumentOutOfDate(document, selections = []) {
  if (!document) return true;
  const currentFingerprint = createSelectionFingerprint(
    selections.filter(isCurrentSelection).filter(isClientVisibleSelection).map(sanitiseClientSelection).sort(compareSelectionsForSchedule)
  );
  const documentFingerprint = document.fileHash || document.file_hash || document.metadata?.selectionFingerprint || document.metadata?.selectionSnapshot?.selectionFingerprint || "";
  return currentFingerprint !== documentFingerprint;
}

export function buildProjectEstimateDocumentSequence({
  introPages = [],
  finalInclusionsDocument = null,
  plans = null,
  pricingPages = [],
  acceptancePages = [],
} = {}) {
  return [
    ...introPages.map((page) => ({ type: "project-estimate-page", slot: "intro", page })),
    finalInclusionsDocument ? { type: "documentSlot", slot: "inclusions", document: normaliseProjectEstimateInclusionsDocument(finalInclusionsDocument) } : { type: "placeholder", slot: "inclusions" },
    plans ? { type: "documentSlot", slot: "plans", document: plans } : { type: "placeholder", slot: "plans" },
    ...pricingPages.map((page) => ({ type: "project-estimate-page", slot: "pricing", page })),
    ...acceptancePages.map((page) => ({ type: "project-estimate-page", slot: "acceptance", page })),
  ];
}

export function normaliseProjectEstimateInclusionsDocument(document = {}) {
  return {
    id: document.id || "",
    title: document.title || FINAL_INCLUSIONS_TITLE,
    fileName: document.fileName || document.file_name || "final-inclusions-schedule.pdf",
    publicUrl: document.publicUrl || document.public_url || "",
    storagePath: document.storagePath || document.storage_path || "",
    sourceType: document.sourceType || document.source_type || FINAL_INCLUSIONS_SOURCE_TYPE,
    status: document.status || "active",
    active: document.active !== false,
    fileHash: document.fileHash || document.file_hash || document.metadata?.selectionFingerprint || "",
    version: document.version || document.metadata?.version || "",
    projectId: document.projectId || document.project_id || "",
    estimateId: document.estimateId || document.estimate_id || "",
    pageCount: Number(document.pageCount || document.page_count || 1),
    uploadedAt: document.uploadedAt || document.uploaded_at || document.metadata?.generatedAt || "",
    pages: Array.isArray(document.pages) ? document.pages : [],
  };
}

export function finalInclusionsPdfMergePlan({ masterPdf = null, dynamicPdf = null, closingPdf = null } = {}) {
  return [
    { order: 1, type: "master-pdf", label: "Builder Standard Inclusions", document: masterPdf },
    { order: 2, type: "dynamic-pdf", label: "Client Final Selections", document: dynamicPdf },
    { order: 3, type: "closing-pdf", label: "Client Approval and Notes", document: closingPdf },
  ].filter((entry) => entry.document !== false);
}

export function renderFinalInclusionsScheduleHtml(snapshot, { theme = DEFAULT_INCLUSIONS_DOCUMENT_THEME } = {}) {
  const groups = groupSnapshotSelections(snapshot);
  const currency = snapshot?.project?.currency || "AUD";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(snapshot?.title || FINAL_INCLUSIONS_TITLE)}</title>
  <style>${renderScheduleCss(theme)}</style>
</head>
<body>
  <main>
    <section class="cover">
      <p>${escapeHtml(snapshot?.estimateSnapshot?.quoteNumber || "Final selections")}</p>
      <h1>${escapeHtml(snapshot?.title || FINAL_INCLUSIONS_TITLE)}</h1>
      <h2>${escapeHtml(snapshot?.project?.name || "Project")}</h2>
      <dl>
        ${htmlDetail("Client", snapshot?.project?.clientName)}
        ${htmlDetail("Site", snapshot?.project?.siteAddress)}
        ${htmlDetail("Generated", formatDate(snapshot?.createdAt))}
      </dl>
    </section>
    <section class="summary">
      <h2>Selection Summary</h2>
      <div class="totals">
        ${summaryTile("Products", snapshot?.summary?.productCount)}
        ${summaryTile("Allowance", money(snapshot?.summary?.includedAllowanceTotal, currency))}
        ${summaryTile("Selected", money(snapshot?.summary?.selectedTotal, currency))}
        ${summaryTile("Variation", signedMoney(snapshot?.summary?.currentNetSelectionVariation, currency))}
      </div>
    </section>
    ${groups.map((group) => `
      <section class="area">
        <h2>${escapeHtml(group.area)}</h2>
        ${group.rooms.map((room) => `
          <article class="room">
            <h3>${escapeHtml(room.room)}</h3>
            <div class="cards">${room.selections.map((selection) => renderProductCardHtml(selection, { theme, currency })).join("")}</div>
          </article>
        `).join("")}
      </section>
    `).join("")}
    <section class="approval">
      <h2>Approval Snapshot</h2>
      <p>This schedule was generated from the active client selections stored against this project and estimate snapshot.</p>
      <dl>
        ${htmlDetail("Session", snapshot?.selectionSession?.name)}
        ${htmlDetail("Status", titleCase(snapshot?.selectionSession?.status))}
        ${htmlDetail("Fingerprint", snapshot?.selectionFingerprint)}
      </dl>
    </section>
  </main>
</body>
</html>`;
}

export function renderProductCardHtml(selection, { currency = "AUD" } = {}) {
  const image = selection.imageUrl || "";
  const variation = Number(selection.variationAmount || 0);
  const detailRows = [
    ["Brand", selection.brand],
    ["Model", selection.modelNumber],
    ["Supplier", selection.supplierName],
    ["Colour", selection.colour],
    ["Finish", selection.finish],
    ["Allowance", money(selection.includedAllowance, currency)],
    ["Selected", selection.clientSelectionPrice ? money(selection.clientSelectionPrice, currency) : ""],
    [variation < 0 ? "Credit" : "Upgrade", variation ? signedMoney(variation, currency) : ""],
  ].filter(([, value]) => hasRenderableValue(value));

  return `<article class="product-card">
    ${image ? `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(selection.productName || selection.title || "Selected product")}" />` : ""}
    <div>
      <p>${escapeHtml(selection.category || "Selection")}</p>
      <h4>${escapeHtml(selection.productName || selection.title || "Selected item")}</h4>
      ${selection.description ? `<em>${escapeHtml(selection.description)}</em>` : ""}
      <dl>${detailRows.map(([label, value]) => htmlDetail(label, value)).join("")}</dl>
    </div>
  </article>`;
}

export function groupSnapshotSelections(snapshot = {}) {
  const grouped = new Map();
  for (const selection of snapshot.selections || []) {
    const area = titleCase(selection.area || areaFromSelection(selection));
    const room = normaliseRoom(selection.room || selection.subcategory || selection.category || "General");
    if (!grouped.has(area)) grouped.set(area, new Map());
    const rooms = grouped.get(area);
    if (!rooms.has(room)) rooms.set(room, []);
    rooms.get(room).push(selection);
  }
  return Array.from(grouped.entries()).map(([area, rooms]) => ({
    area,
    rooms: Array.from(rooms.entries()).map(([room, selections]) => ({ room, selections })),
  }));
}

export function createSelectionFingerprint(selections = []) {
  const stable = selections.map((selection) => ({
    id: selection.id || "",
    category: selection.category || "",
    subcategory: selection.subcategory || "",
    room: selection.room || "",
    productName: selection.productName || selection.selected_product_name || selection.product_name || "",
    brand: selection.brand || "",
    modelNumber: selection.modelNumber || selection.model_number || "",
    colour: selection.colour || selection.selected_colour || "",
    finish: selection.finish || selection.selected_finish || "",
    allowance: roundMoney(selection.includedAllowance ?? selection.included_allowance ?? selection.allowance_amount),
    selected: roundMoney(selection.clientSelectionPrice ?? selection.client_selection_price ?? selection.calculated_client_selection_price),
    variation: roundMoney(selection.variationAmount ?? selection.variation_amount),
    updatedAt: selection.updatedAt || selection.updated_at || selection.created_at || "",
  }));
  return hashString(JSON.stringify(stable));
}

export function sanitiseClientSelection(selection = {}) {
  const publicSelection = pickClientSelectionKeys(selection);
  const selectedDetails = sanitiseSelectedDetails(publicSelection.selected_details || {});
  const inferredArea = selectedDetails.areaLabel || selectedDetails.area || areaFromSelection(publicSelection);
  const includedAllowance = numberValue(publicSelection.included_allowance ?? publicSelection.allowance_amount ?? selectedDetails.allowance);
  const clientSelectionPrice = numberValue(publicSelection.client_selection_price ?? publicSelection.calculated_client_selection_price ?? selectedDetails.clientPrice);
  const variationAmount = numberValue(publicSelection.variation_amount ?? (clientSelectionPrice - includedAllowance));
  return {
    id: publicSelection.id || "",
    sessionId: publicSelection.session_id || "",
    snapshotId: publicSelection.snapshot_id || "",
    area: inferredArea,
    category: publicSelection.category || selectedDetails.category || "",
    subcategory: publicSelection.subcategory || selectedDetails.subcategory || "",
    room: publicSelection.room || selectedDetails.room || "",
    title: publicSelection.title || "",
    description: publicSelection.description || selectedDetails.description || "",
    productName: publicSelection.selected_product_name || publicSelection.product_name || selectedDetails.productName || "",
    supplierName: publicSelection.selected_supplier_name || selectedDetails.supplier || "",
    brand: publicSelection.brand || selectedDetails.brand || "",
    modelNumber: publicSelection.model_number || selectedDetails.model || "",
    colour: publicSelection.selected_colour || publicSelection.colour || selectedDetails.colour || "",
    finish: publicSelection.selected_finish || publicSelection.finish || selectedDetails.finish || "",
    imageUrl: publicSelection.image_url || selectedDetails.primaryImage || selectedDetails.imageUrl || "",
    specificationUrl: publicSelection.specification_url || selectedDetails.specificationURL || "",
    includedAllowance: roundMoney(includedAllowance),
    clientSelectionPrice: roundMoney(clientSelectionPrice),
    variationAmount: roundMoney(variationAmount),
    isIncludedSelection: publicSelection.is_included_selection !== false,
    status: publicSelection.selection_status || publicSelection.status || "",
    approvedAt: publicSelection.approved_at || "",
    approvedByName: publicSelection.approved_by_name || "",
    createdAt: publicSelection.created_at || "",
    updatedAt: publicSelection.updated_at || publicSelection.created_at || "",
  };
}

function createDynamicPageDescriptors(selections = []) {
  const groups = groupSnapshotSelections({ selections });
  const pages = [{ id: "selection-summary", type: "summary", title: "Selection Summary" }];
  for (const group of groups) {
    pages.push({ id: stablePageId(`area-${group.area}`), type: "area-intro", title: group.area });
    for (const room of group.rooms) {
      const pageCount = Math.max(1, Math.ceil(room.selections.length / 4));
      for (let index = 0; index < pageCount; index += 1) {
        pages.push({
          id: stablePageId(`${group.area}-${room.room}-${index + 1}`),
          type: "product-grid",
          title: `${room.room} Selections`,
          area: group.area,
          room: room.room,
          selectionIds: room.selections.slice(index * 4, index * 4 + 4).map((selection) => selection.id),
        });
      }
    }
  }
  pages.push({ id: "allowances-variations", type: "allowances", title: "Allowances and Variations" });
  return pages;
}

function pickClientSelectionKeys(selection) {
  return CLIENT_SELECTION_KEYS.reduce((result, key) => {
    if (Object.prototype.hasOwnProperty.call(selection, key) && !INTERNAL_FIELD_PATTERN.test(key)) result[key] = selection[key];
    return result;
  }, {});
}

function sanitiseSelectedDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce((result, [key, detailValue]) => {
    if (!INTERNAL_FIELD_PATTERN.test(key) && isJsonPrimitiveOrPlain(detailValue)) result[key] = detailValue;
    return result;
  }, {});
}

function isJsonPrimitiveOrPlain(value) {
  if (value == null) return true;
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonPrimitiveOrPlain);
  return typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

function isCurrentSelection(selection = {}) {
  return selection.is_active !== false && !["replaced", "removed", "archived"].includes(selection.selection_status || selection.status);
}

function isClientVisibleSelection(selection = {}) {
  const metadata = selection.metadata || {};
  const details = selection.selected_details || {};
  return metadata.selection_visibility !== "internal"
    && metadata.client_visible !== false
    && metadata.client_selectable !== false
    && details.selection_visibility !== "internal"
    && details.client_visible !== false
    && details.client_selectable !== false;
}

function compareSelectionsForSchedule(left, right) {
  return [
    String(left.area || "").localeCompare(String(right.area || "")),
    String(left.room || "").localeCompare(String(right.room || "")),
    String(left.category || "").localeCompare(String(right.category || "")),
    String(left.productName || "").localeCompare(String(right.productName || "")),
  ].find((value) => value !== 0) || 0;
}

function normaliseRoom(value) {
  const label = titleCase(value);
  if (/bedroom/i.test(label)) return "Bedrooms";
  if (/bath|ensuite|powder/i.test(label)) return "Bathrooms";
  return label || "General";
}

function areaFromSelection(selection = {}) {
  const source = `${selection.category || ""} ${selection.subcategory || ""} ${selection.room || ""}`.toLowerCase();
  if (/brick|roof|facade|garage|driveway|landscape|external|exterior/.test(source)) return "Exterior";
  if (/kitchen|oven|cooktop|rangehood|dishwasher|sink|tap/.test(source)) return "Kitchen";
  return "Interior";
}

function stablePageId(value) {
  return String(value || "page").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fis-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function renderScheduleCss(theme) {
  return `
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: ${theme.ink}; font-family: Arial, sans-serif; background: ${theme.surface}; }
    main { display: grid; gap: 24px; }
    section { break-after: page; }
    h1, h2, h3, h4, p { margin: 0; }
    .cover { min-height: 92vh; display: grid; align-content: end; gap: 18px; border-left: 8px solid ${theme.accent}; padding-left: 28px; }
    .cover p, .product-card p { color: ${theme.accent}; font-size: 12px; font-weight: 800; text-transform: uppercase; }
    .cover h1 { font-size: 48px; line-height: 1; }
    .cover h2 { font-size: 24px; color: ${theme.muted}; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 8px 14px; margin: 0; }
    dt { color: ${theme.muted}; font-weight: 700; }
    dd { margin: 0; font-weight: 800; }
    .totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
    .tile, .product-card { border: 1px solid ${theme.border}; border-radius: 8px; background: ${theme.surface}; padding: 14px; }
    .tile span { display: block; color: ${theme.muted}; font-weight: 700; }
    .tile strong { display: block; margin-top: 6px; font-size: 22px; }
    .area, .room { display: grid; gap: 14px; }
    .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .product-card { break-inside: avoid; display: grid; grid-template-columns: 136px 1fr; gap: 14px; min-height: 184px; }
    .product-card img { width: 136px; height: 136px; object-fit: cover; border-radius: 8px; background: ${theme.soft}; }
    .product-card h4 { margin-top: 4px; font-size: 18px; }
    .product-card em { display: block; margin-top: 6px; color: ${theme.muted}; font-style: normal; }
    .product-card dl { margin-top: 10px; font-size: 12px; grid-template-columns: 76px 1fr; }
    .approval { break-after: auto; display: grid; gap: 12px; }
  `;
}

function htmlDetail(label, value) {
  if (!hasRenderableValue(value)) return "";
  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
}

function summaryTile(label, value) {
  return `<div class="tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function hasRenderableValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "" && String(value).trim() !== "$0.00";
}

function money(value, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: currency || "AUD", maximumFractionDigits: 2 }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function signedMoney(value, currency = "AUD") {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${numeric > 0 ? "+" : numeric < 0 ? "-" : ""}${money(Math.abs(numeric), currency)}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-AU");
}

function titleCase(value) {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
