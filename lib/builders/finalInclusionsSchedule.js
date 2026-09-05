import { calculateSessionBudget, numberValue, roundMoney } from "./selectionBudget.js";

export const FINAL_INCLUSIONS_DOCUMENT_TYPE = "selection";
export const FINAL_INCLUSIONS_SOURCE_TYPE = "final_inclusions_schedule";
export const FINAL_INCLUSIONS_TITLE = "Inclusions and Selections Schedule";
export const PREMIER_INCLUSIONS_MASTER_PAGE_COUNT = 10;
export const FINAL_INCLUSIONS_STATUS = Object.freeze({
  DRAFT: "draft",
  FOR_APPROVAL: "for_approval",
  APPROVED: "approved",
  CONTRACT: "contract",
});

export const DEFAULT_INCLUSIONS_DOCUMENT_THEME = Object.freeze({
  name: "Premier Final Inclusions",
  paperSize: "A4 landscape",
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
  "sku",
  "product_code",
  "product_id",
  "selected_product_id",
  "selected_supplier_id",
  "image_asset_id",
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
const CONTRACT_READY_STATUSES = new Set(["approved", "confirmed", "selected", "builder_confirmed", "client_approved", "contract"]);
const PLACEHOLDER_IMAGE_PATTERN = /placeholder|missing|example/i;
const TECHNICAL_SELECTION_PATTERN = /\b(wall\s*wrap|sarking|timber\s*framing|framing|insulation|fixing|fixings|structural\s*steel|beam|post|flashing|concealed|waterproofing|adhesive|mortar|sealant|substrate|batten|anticon|labou?r|garage.?door\s*motor|motor\s*\/\s*operator|tracks?|springs?|remotes?|installation\s*component)\b/i;
const GENERIC_SELECTION_PATTERN = /\b(builder\s*)?(included|standard)\s*selection\b|builder\s*standard|generic\s*selection/i;
const INCLUDED_SELECTION_SCOPES = new Set(["client_choice", "builder_choice"]);
const EXCLUDED_SELECTION_SCOPES = new Set(["technical_inclusion", "boq_only", "procurement_only"]);

function colourSwatchImage(colour = {}) {
  const name = String(colour.officialName || colour.colourName || colour.name || "Exterior colour").replace(/[<>&"]/g, "");
  const supplier = String(colour.supplier || "Supplier colour").replace(/[<>&"]/g, "");
  const swatch = /^#[0-9a-f]{3,8}$/i.test(String(colour.swatch || colour.hex || "")) ? (colour.swatch || colour.hex) : "#d1d5db";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="280" viewBox="0 0 420 280"><rect width="420" height="280" fill="#ffffff"/><rect x="28" y="28" width="364" height="154" rx="10" fill="${swatch}" stroke="#cbd5e1" stroke-width="2"/><text x="28" y="224" font-family="Arial" font-size="26" font-weight="800" fill="#071827">${name}</text><text x="28" y="252" font-family="Arial" font-size="18" font-weight="700" fill="#475569">${supplier}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const CLIENT_DECISION_REQUIREMENT_KEYS = new Set([
  "roofing",
  "bricks",
  "external-cladding",
  "windows",
  "entry-door",
  "garage-door",
  "external-lighting",
  "exterior-paint",
  "driveway",
  "oven",
  "cooktop",
  "rangehood",
  "dishwasher",
  "tapware",
  "flooring",
  "internal-colours",
  "cabinetry",
]);
const SCHEDULE_SECTION_ORDER = [
  "Project Summary",
  "Exterior",
  "Roofing",
  "Bricks, Render and Cladding",
  "Windows and External Doors",
  "Garage Door",
  "External Lighting",
  "Exterior Paint and Colours",
  "Driveway",
  "Interior",
  "Kitchen",
  "Butler's Pantry",
  "Bathrooms",
  "Ensuite",
  "Powder",
  "Laundry",
  "Bedrooms",
  "Robes",
  "Alfresco",
  "Appliances",
  "Allowances",
  "Variations",
  "Notes And Approvals",
];

export function createProjectInclusionsSnapshot({
  project = {},
  workspaceId = "",
  selections = [],
  session = {},
  estimateSnapshot = {},
  generatedBy = "",
  approvedAt = "",
  createdAt = new Date().toISOString(),
  issuedAt = "",
  documentStatus = FINAL_INCLUSIONS_STATUS.DRAFT,
  version = "",
  previousDocuments = [],
  builderProfile = {},
  preparedBy = "",
  reviewedBy = "",
  approval = {},
  contractReference = "",
  revisionReason = "",
  masterTemplate = {},
  masterPdfRef = null,
  closingPdfRef = null,
} = {}) {
  const currentSelections = selections.filter(isCurrentSelection);
  const clientSelections = selections
    .filter(isCurrentSelection)
    .filter(isClientVisibleSelection)
    .filter(isSelectionsScheduleSelection)
    .map(sanitiseClientSelection)
    .sort(compareSelectionsForSchedule);
  const excludedSelectionCount = currentSelections.length - clientSelections.length;

  const currency = project.currency || session.currency || "AUD";
  const sourceBudget = calculateSessionBudget({
    originalEstimateTotal: session.original_estimate_total || estimateSnapshot.final_quote_total || project.original_estimate_total || project.contract_total || 0,
    privateUpgradeCeiling: session.private_upgrade_ceiling || 0,
    warningThresholdPercent: session.warning_threshold_percent,
    selections: clientSelections,
  });
  const includedAllowanceTotal = roundMoney(clientSelections.reduce((total, selection) => total + numberValue(selection.includedAllowance), 0));
  const selectedTotal = roundMoney(clientSelections.reduce((total, selection) => total + numberValue(selection.clientSelectionPrice), 0));
  const currentNetSelectionVariation = roundMoney(clientSelections.reduce((total, selection) => total + numberValue(selection.variationAmount), 0));
  const currentUpdatedEstimateTotal = roundMoney(sourceBudget.originalEstimateTotal + currentNetSelectionVariation);
  const fingerprint = createSelectionFingerprint(clientSelections);
  const readiness = reviewScheduleReadiness({ selections: clientSelections });
  const normalisedStatus = normaliseDocumentStatus(documentStatus);
  const versionNumber = Number(version || nextDocumentVersion(previousDocuments, { documentStatus: normalisedStatus }) || 1);
  const versionLabel = createDocumentVersionLabel({ documentStatus: normalisedStatus, version: versionNumber, revisionReason });
  const dynamicPages = createDynamicPageDescriptors(clientSelections, { readiness });
  const masterPageCount = Number(masterTemplate.pageCount || masterTemplate.pages?.length || PREMIER_INCLUSIONS_MASTER_PAGE_COUNT);

  return deepFreeze(cloneJson({
    schemaVersion: 2,
    documentKind: FINAL_INCLUSIONS_SOURCE_TYPE,
    title: FINAL_INCLUSIONS_TITLE,
    documentStatus: normalisedStatus,
    documentStatusLabel: documentStatusLabel(normalisedStatus),
    version: versionNumber,
    versionLabel,
    immutable: normalisedStatus === FINAL_INCLUSIONS_STATUS.CONTRACT,
    contractReference: contractReference || estimateSnapshot.source_quote_number || "",
    revisionReason,
    workspaceId: workspaceId || project.workspace_id || session.workspace_id || "",
    builder: {
      name: builderProfile.name || builderProfile.business_name || builderProfile.companyName || project.builder_name || project.metadata?.builderName || "",
      licenceNumber: builderProfile.licenceNumber || builderProfile.licence_number || builderProfile.licence || "",
      abn: builderProfile.abn || builderProfile.ABN || "",
      phone: builderProfile.phone || project.metadata?.phone || "",
      email: builderProfile.email || project.metadata?.email || "",
      address: builderProfile.address || "",
      logoUrl: builderProfile.logoUrl || builderProfile.logo_url || project.builder_logo_url || project.metadata?.builderLogo || "",
    },
    project: {
      id: project.id || session.project_id || "",
      name: project.project_name || project.name || "Project",
      clientName: project.client_name || "",
      siteAddress: project.site_address || "",
      jobNumber: project.job_number || project.metadata?.jobNumber || estimateSnapshot.source_quote_number || "",
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
      sourceSelectionCount: currentSelections.length,
      excludedSelectionCount,
      completedClientSelectionCount: readiness.completedSelections,
      outstandingClientDecisionCount: readiness.outstandingClientDecisionCount,
    },
    selections: clientSelections,
    readiness,
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
    preparedBy: preparedBy || generatedBy || "",
    reviewedBy,
    approval: {
      clientName: approval.clientName || project.client_name || "",
      builderName: approval.builderName || builderProfile.name || builderProfile.business_name || "",
      approvedAt: approval.approvedAt || approvedAt || "",
      approvalMethod: approval.approvalMethod || "",
      signatureUrl: approval.signatureUrl || "",
      documentUrl: approval.documentUrl || "",
      documentHash: approval.documentHash || "",
    },
    createdAt,
    issuedAt: issuedAt || (normalisedStatus === FINAL_INCLUSIONS_STATUS.CONTRACT ? createdAt : ""),
    selectionFingerprint: fingerprint,
  }));
}

export function createFinalInclusionsDocumentVersion({
  snapshot,
  previousDocuments = [],
  generatedAt = new Date().toISOString(),
  fileRef = {},
  version,
  documentStatus,
} = {}) {
  if (!snapshot?.selectionFingerprint) throw new Error("A final inclusions snapshot is required.");
  const normalisedStatus = normaliseDocumentStatus(documentStatus || snapshot.documentStatus || FINAL_INCLUSIONS_STATUS.DRAFT);
  if (normalisedStatus === FINAL_INCLUSIONS_STATUS.CONTRACT && snapshot.readiness && !snapshot.readiness.canIssueFinal) {
    throw new Error("Final contract schedule cannot be issued until all required selections are complete and confirmed.");
  }
  const nextVersion = Number(version || nextDocumentVersion(previousDocuments, { documentStatus: normalisedStatus }));
  const versionLabel = createDocumentVersionLabel({ documentStatus: normalisedStatus, version: nextVersion, revisionReason: snapshot.revisionReason });
  const projectId = snapshot.project?.id || "project";
  const snapshotId = snapshot.estimateSnapshot?.id || snapshot.selectionSession?.id || "snapshot";
  const fileName = fileRef.fileName || `${stablePageId(FINAL_INCLUSIONS_TITLE)}-${stablePageId(versionLabel)}.pdf`;
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
    status: normalisedStatus === FINAL_INCLUSIONS_STATUS.CONTRACT ? "issued" : normalisedStatus,
    active: true,
    version: nextVersion,
    versionLabel,
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
      versionLabel,
      documentStatus: normalisedStatus,
      documentStatusLabel: documentStatusLabel(normalisedStatus),
      immutable: normalisedStatus === FINAL_INCLUSIONS_STATUS.CONTRACT,
      generatedAt,
      masterTemplate: snapshot.masterTemplate,
      readiness: snapshot.readiness,
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
    selections.filter(isCurrentSelection).filter(isClientVisibleSelection).filter(isSelectionsScheduleSelection).map(sanitiseClientSelection).sort(compareSelectionsForSchedule)
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
  const status = normaliseDocumentStatus(snapshot?.documentStatus);
  const isDraft = status !== FINAL_INCLUSIONS_STATUS.CONTRACT;
  const readiness = snapshot?.readiness || reviewScheduleReadiness(snapshot);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(snapshot?.title || FINAL_INCLUSIONS_TITLE)}</title>
  <style>${renderScheduleCss(theme)}</style>
</head>
<body class="${isDraft ? "draft" : "contract"}">
  <main>
    ${isDraft ? `<div class="watermark">DRAFT</div>` : ""}
    <section class="cover">
      ${snapshot?.builder?.logoUrl ? `<img class="cover-logo" src="${escapeAttribute(snapshot.builder.logoUrl)}" alt="${escapeAttribute(snapshot?.builder?.name || "Builder logo")}" />` : ""}
      <p>${escapeHtml(snapshot?.versionLabel || documentStatusLabel(status))}</p>
      <h1>${escapeHtml(snapshot?.title || FINAL_INCLUSIONS_TITLE)}</h1>
      <h2>${escapeHtml(snapshot?.project?.name || "Project")}</h2>
      ${status === FINAL_INCLUSIONS_STATUS.CONTRACT ? `<strong class="contractBanner">FINAL CONTRACT SCHEDULE</strong>` : `<strong class="draftBanner">${escapeHtml(documentStatusLabel(status))}</strong>`}
      <dl>
        ${htmlDetail("Builder", snapshot?.builder?.name)}
        ${htmlDetail("Client", snapshot?.project?.clientName)}
        ${htmlDetail("Site", snapshot?.project?.siteAddress)}
        ${htmlDetail("Job Number", snapshot?.project?.jobNumber)}
        ${htmlDetail("Contract Ref", snapshot?.contractReference)}
        ${htmlDetail("Version", snapshot?.versionLabel)}
        ${htmlDetail("Generated", formatDate(snapshot?.createdAt))}
        ${htmlDetail("Issued", formatDate(snapshot?.issuedAt))}
      </dl>
    </section>
    <section class="document-info">
      <h2>Document Information</h2>
      <dl>
        ${htmlDetail("Document Status", documentStatusLabel(status))}
        ${htmlDetail("Job Number", snapshot?.project?.jobNumber)}
        ${htmlDetail("Prepared Date", formatDate(snapshot?.createdAt))}
        ${snapshot?.preparedBy ? htmlDetail("Prepared By", snapshot.preparedBy) : ""}
      </dl>
      <p>This schedule records client-facing product, finish and colour decisions only. Technical construction inclusions remain in the Standard Inclusions Schedule, BOQ and supplier procurement records.</p>
    </section>
    <section class="summary">
      <h2>Project Summary</h2>
      <dl class="project-summary">
        ${htmlDetail("Client", snapshot?.project?.clientName)}
        ${htmlDetail("Site Address", snapshot?.project?.siteAddress)}
        ${htmlDetail("Job Number", snapshot?.project?.jobNumber)}
        ${htmlDetail("Selection Session", snapshot?.selectionSession?.name)}
        ${htmlDetail("Session Status", titleCase(snapshot?.selectionSession?.status))}
      </dl>
      <div class="totals">
        ${summaryTile("Selected Items", snapshot?.summary?.productCount)}
        ${summaryTile("Outstanding Decisions", snapshot?.summary?.outstandingClientDecisionCount)}
        ${summaryTile("Variation", signedMoney(snapshot?.summary?.currentNetSelectionVariation, currency))}
        ${summaryTile("Status", documentStatusLabel(status))}
      </div>
    </section>
    ${groups.map((group) => renderScheduleSectionTable(group, { currency })).join("")}
    <section class="approval">
      <h2>Approval and Signing</h2>
      <p>By signing, the client and builder confirm that this schedule records the products, finishes, fixtures, fittings, allowances, exclusions and variations forming part of the contract documentation at the time of issue.</p>
      <dl>
        ${htmlDetail("Session", snapshot?.selectionSession?.name)}
        ${htmlDetail("Status", titleCase(snapshot?.selectionSession?.status))}
        ${htmlDetail("Client Approval", snapshot?.approval?.approvedAt ? `Approved ${formatDate(snapshot.approval.approvedAt)}` : "Pending")}
      </dl>
      <div class="signatures">
        <div><span>Client signature</span><strong>${escapeHtml(snapshot?.approval?.clientName || snapshot?.project?.clientName || "")}</strong></div>
        <div><span>Builder signature</span><strong>${escapeHtml(snapshot?.approval?.builderName || snapshot?.builder?.name || "")}</strong></div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

export function renderProductCardHtml(selection, { currency = "AUD" } = {}) {
  if (selection.windowWorkflow?.effectiveWindows?.length) return renderWindowScheduleSelectionHtml(selection, { currency });
  if (selection.externalLightingSelection?.scheduleLines?.length) return renderExternalLightingScheduleSelectionHtml(selection, { currency });
  if (selection.exteriorColourSelection?.areas?.length) return renderExteriorColourScheduleSelectionHtml(selection, { currency });
  const image = selection.imageUrl || "";
  const detailRows = [
    ["Location", selection.location || selection.room],
    ["Supplier", meaningfulValue(selection.supplierName)],
    ["Brand", meaningfulValue(selection.brand)],
    ["Range", selection.range],
    ["Model", selection.modelNumber],
    ["Product Code", selection.productCode],
    ["Size", selection.size],
    ["Configuration", selection.configuration],
    ["Material", selection.material],
    ["Door Type", selection.garageDoorSelection?.doorType],
    ["Supplier Colour Code", selection.garageDoorSelection?.supplierColourCode],
    ["Finish Family", selection.garageDoorSelection?.finishFamily],
    ["Beacon SKU", selection.externalLightingSelection?.sku],
    ["Lighting Category", selection.externalLightingSelection?.category],
    ["Lighting Locations", Array.isArray(selection.externalLightingSelection?.locations) ? selection.externalLightingSelection.locations.map((item) => `${item.lightingPointId} ${item.exactLocation} x${item.quantity}`).join("; ") : ""],
    ["Windows Covered", selection.windowCount],
    ["Window Schedule Version", selection.windowScheduleVersion],
    ["Frame Colour", selection.frameColourCode ? `${selection.frameColourName} (${selection.frameColourCode})` : selection.frameColourName],
    ["Colour", selection.colour],
    ["Finish", selection.finish],
    ["Glazing", selection.glazing],
    ["Screens", selection.screens],
    ["Handing", selection.handing],
    ["Hardware", selection.hardware],
    ["Exceptions", selection.exceptions],
    ["Quantity", selection.quantity],
    ["Price", clientPriceLabel(selection, currency)],
    ["Status", titleCase(selection.status)],
    ["Notes", selection.clientNote || selection.builderNote],
  ].filter(([, value]) => hasRenderableValue(value));

  return `<article class="product-card">
    ${image ? `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(selection.productName || selection.title || "Selected product")}" />` : `<div class="image-pending">Correct product image pending</div>`}
    <div>
      <p>${escapeHtml([selection.category, selection.subcategory].filter(Boolean).join(" / ") || "Selection")}</p>
      <h4>${escapeHtml(selection.productName || selection.title || "Selected item")}</h4>
      ${selection.description ? `<em>${escapeHtml(selection.description)}</em>` : ""}
      <dl>${detailRows.map(([label, value]) => htmlDetail(label, value)).join("")}</dl>
    </div>
  </article>`;
}

function renderScheduleSectionTable(group, { currency = "AUD" } = {}) {
  const rows = group.rooms.flatMap((room) => room.selections.flatMap((selection) => selectionToScheduleRows(selection, { room: room.room, currency })));
  if (!rows.length) return "";
  return `<section class="area schedule-table-section">
    <h2>${escapeHtml(group.area)}</h2>
    <table class="schedule-row-table">
      <thead>
        <tr>
          <th class="image-col">Image</th>
          <th>Area / Category</th>
          <th class="product-col">Selected Product</th>
          <th>Brand / Supplier</th>
          <th>Model / Code</th>
          <th>Colour / Finish</th>
          <th>Qty / Location</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows.map(scheduleRowHtml).join("")}</tbody>
    </table>
  </section>`;
}

function selectionToScheduleRows(selection, { room = "", currency = "AUD" } = {}) {
  if (selection.entryDoors?.length) return selection.entryDoors.flatMap(door => selectionToScheduleRows({ ...selection, ...door, entryDoors: null, id: `${selection.id}:${door.door.id}`, room: door.door.location, location: door.door.location }, { room: [door.door.doorReference, door.door.level, door.door.location].filter(Boolean).join(' / '), currency }));
  if (selection.windowWorkflow?.effectiveWindows?.length) {
    return selection.windowWorkflow.effectiveWindows.map((windowRow, index) => scheduleRowFromSelection(selection, {
      rowId: `${selection.id || "window"}-${windowRow.id || index}`,
      category: "Windows and External Doors",
      area: windowRow.location || room || selection.room,
      product: `${windowRow.id || `Window ${index + 1}`} - ${windowRow.type || selection.productName || "Window"}`,
      brand: selection.brand,
      supplier: windowRow.supplier || selection.supplierName,
      model: windowRow.system?.name || selection.modelNumber,
      code: windowRow.id,
      colourFinish: [windowRow.frameColourName, windowRow.frameColourCode, windowRow.glass, windowRow.screen, windowRow.hardware].filter(Boolean).join(" / "),
      swatch: windowRow.frameColourHex,
      quantityLocation: [windowRow.quantity || 1, "each", windowRow.room || windowRow.location].filter(Boolean).join(" "),
      status: windowRow.hasOverride ? "Individual exception" : "Project default",
      imageUrl: selection.imageUrl,
    }, currency));
  }
  const lightingLines = selection.externalLightingSelection?.scheduleLines || selection.externalLightingSelection?.lines || [];
  if (lightingLines.length) {
    return lightingLines.map((line, index) => scheduleRowFromSelection(selection, {
      rowId: `${selection.id || "lighting"}-${line.lineId || index}`,
      category: "External Lighting",
      area: "Exterior",
      product: line.productName || line.product?.productName || selection.productName,
      brand: line.brand || line.product?.brand || selection.brand,
      supplier: line.supplier || line.product?.supplier || selection.supplierName,
      model: line.model || line.product?.model || "",
      code: line.sku || line.productCode || line.product?.productCode || "",
      colourFinish: [line.finish, line.colour].filter(Boolean).join(" / "),
      quantityLocation: [line.quantity || 1, (line.locations || []).map((location) => location.exactLocation || location.location || location.lightingPointId).filter(Boolean).join("; ")].filter(Boolean).join(" - "),
      status: line.includedStatus || line.priceStatus || selection.status,
      imageUrl: line.imageUrl || line.product?.imageUrl || selection.imageUrl,
    }, currency));
  }
  const colourRows = selection.exteriorColourSelection?.clientColourSchedule || selection.clientColourSchedule || selection.exteriorColourSelection?.areas || [];
  if (colourRows.length) {
    return colourRows.map((row, index) => {
      const colour = row.colourSelection || row.colour || {};
      return scheduleRowFromSelection(selection, {
        rowId: `${selection.id || "colour"}-${row.areaId || index}`,
        category: "Exterior Paint and Colours",
        area: row.areaName || row.location || "Exterior",
        product: colour.officialName || colour.colourName || colour.name || row.colourName || "Exterior colour",
        brand: colour.manufacturer || colour.brand || row.supplier || selection.brand,
        supplier: row.supplier || colour.supplier || selection.supplierName,
        code: colour.code || colour.supplierCode || row.colourCode || row.supplierCode || "",
        colourFinish: [row.colourName || colour.officialName || colour.name, row.finishType, row.material].filter(Boolean).join(" / "),
        swatch: row.swatch || row.hex || colour.hex || colour.swatch || colour.swatchValue,
        quantityLocation: row.areaName || row.location || "",
        status: row.status || selection.status,
        imageUrl: colour.imageUrl || colour.swatchImageUrl || row.imageUrl || colourSwatchImage(colour),
      }, currency);
    });
  }
  if (selection.roofPackage) {
    return [
      scheduleRowFromSelection(selection, {}, currency),
      ...Object.entries(selection.roofPackage).map(([key, part]) => scheduleRowFromSelection(selection, {
        rowId: `${selection.id || "roof"}-${key}`,
        category: "Roofing",
        area: titleCase(key),
        product: part.productName || titleCase(key),
        brand: selection.brand,
        supplier: selection.supplierName,
        code: part.productCode,
        colourFinish: [part.profile, part.colour].filter(Boolean).join(" / "),
        quantityLocation: "Project roof",
        status: part.selectionMethod || selection.status,
        imageUrl: selection.imageUrl,
      }, currency)),
    ];
  }
  if (selection.entryDoorFurniture) {
    const furniture = selection.entryDoorFurniture || {};
    return [
      scheduleRowFromSelection(selection, {
        rowId: `${selection.id || "entry-door"}-door`,
        category: "Entry Door",
        area: room || selection.room || "Exterior",
        product: selection.productName,
        brand: selection.brand,
        supplier: selection.supplierName,
        code: selection.productCode || selection.modelNumber,
        colourFinish: [selection.size, selection.configuration, selection.finish, selection.glazing].filter(Boolean).join(" / "),
        quantityLocation: "Entry door",
        status: selection.status,
        imageUrl: selection.imageUrl,
      }, currency),
      scheduleRowFromSelection(selection, {
        rowId: `${selection.id || "entry-door"}-furniture`,
        category: "Entry Door Furniture & Locking",
        priceLabel: furniture.selectedCost == null ? 'Rate required' : undefined,
        area: room || selection.room || "Exterior",
        product: furniture.productName,
        brand: furniture.brand,
        supplier: furniture.supplier,
        model: furniture.model,
        code: furniture.productCode,
        colourFinish: [selection.furnitureFinish, furniture.lockingType, furniture.cylinderConfiguration].filter(Boolean).join(" / "),
        quantityLocation: [selection.hardwareOptions?.quantity || selection.door?.quantity || selection.quantity, selection.door?.doorReference, selection.door?.level, selection.door?.location].filter(Boolean).join(' / '),
        status: selection.furnitureCompatibility?.statusLabel || selection.status,
        imageUrl: furniture.imageUrl,
      }, currency),
    ];
  }
  return [scheduleRowFromSelection(selection, {}, currency)];
}

function scheduleRowFromSelection(selection, overrides = {}, currency = "AUD") {
  const imageUrl = overrides.imageUrl || selection.imageUrl || "";
  return {
    id: overrides.rowId || selection.id || selection.selectionId || selection.productId,
    imageUrl: imageUrl && !PLACEHOLDER_IMAGE_PATTERN.test(imageUrl) ? imageUrl : "",
    category: overrides.category || selection.subcategory || selection.category || selection.area || "Selection",
    area: overrides.area || selection.location || selection.room || selection.area || "",
    product: overrides.product || selection.productName || selection.title || "Selection outstanding",
    brandSupplier: [overrides.brand || selection.brand, overrides.supplier || selection.supplierName].filter(Boolean).join(" / "),
    modelCode: [overrides.model || selection.modelNumber || selection.range, overrides.code || selection.productCode].filter(Boolean).join(" / "),
    colourFinish: overrides.colourFinish || [selection.colour, selection.finish].filter(Boolean).join(" / "),
    swatch: overrides.swatch || selection.frameColourHex || "",
    quantityLocation: overrides.quantityLocation || [selection.quantity, selection.location || selection.room].filter(Boolean).join(" - "),
    status: [titleCase(overrides.status || selection.status), overrides.priceLabel ?? clientPriceLabel(selection, currency)].filter(Boolean).join(" / "),
  };
}

function scheduleRowHtml(row) {
  return `<tr>
    <td>${row.imageUrl ? `<img class="schedule-row-image" src="${escapeAttribute(row.imageUrl)}" alt="${escapeAttribute(row.product)}" />` : `<span class="image-empty"></span>`}</td>
    <td><strong>${escapeHtml(row.category)}</strong><span>${escapeHtml(row.area)}</span></td>
    <td><strong>${escapeHtml(row.product)}</strong></td>
    <td>${escapeHtml(row.brandSupplier)}</td>
    <td>${escapeHtml(row.modelCode)}</td>
    <td>${row.swatch ? `<span class="schedule-swatch" style="background:${escapeAttribute(row.swatch)}"></span>` : ""}${escapeHtml(row.colourFinish)}</td>
    <td>${escapeHtml(row.quantityLocation)}</td>
    <td>${escapeHtml(row.status)}</td>
  </tr>`;
}

function renderExteriorColourScheduleSelectionHtml(selection, { currency = "AUD" } = {}) {
  const exterior = selection.exteriorColourSelection || {};
  const summary = exterior.summary || {};
  const areas = exterior.areas || [];
  const clientRows = exterior.clientColourSchedule || selection.clientColourSchedule || [];
  return `<article class="window-schedule-card exterior-colour-schedule-card">
    <div class="window-schedule-head">
      <div>
        <p>${escapeHtml([selection.category, selection.subcategory].filter(Boolean).join(" / ") || "Exterior Colours")}</p>
        <h4>${escapeHtml(selection.productName || "Exterior Colour Schedule")}</h4>
        <em>${escapeHtml(exterior.dashboardSummary || "Area-based exterior colour schedule")}</em>
      </div>
      <div class="window-summary-tiles">
        ${summaryTile("Applicable", summary.applicableAreas ?? areas.length)}
        ${summaryTile("Selected", summary.selectedAreas ?? clientRows.filter((row) => row.colourName).length)}
        ${summaryTile("Incomplete", summary.incompleteAreas ?? 0)}
        ${summaryTile("Unique Colours", summary.uniqueColours ?? 0)}
      </div>
    </div>
    <table class="window-pdf-table procurement">
      <thead><tr><th>Area</th><th>Material</th><th>Supplier</th><th>Colour</th><th>Code</th><th>Finish type</th><th>Status</th><th>Notes</th></tr></thead>
      <tbody>${clientRows.map((row) => `<tr>
        <td>${escapeHtml(row.areaName)}</td>
        <td>${escapeHtml(row.material)}</td>
        <td>${escapeHtml(row.supplier)}</td>
        <td>${row.swatch ? `<span class="pdf-colour-swatch" style="background:${escapeAttribute(row.swatch)}"></span>` : ""}${escapeHtml(row.colourName)}</td>
        <td>${escapeHtml(row.colourCode)}</td>
        <td>${escapeHtml(String(row.finishType || "").replace(/_/g, " "))}</td>
        <td>${escapeHtml(String(row.status || "").replace(/_/g, " "))}</td>
        <td>${escapeHtml(row.notes)}</td>
      </tr>`).join("")}</tbody>
    </table>
    <p class="schedule-note">Client selects colour only. Technical coating products, sheen and preparation remain builder/painter specifications.</p>
  </article>`;
}

function renderExternalLightingScheduleSelectionHtml(selection, { currency = "AUD" } = {}) {
  const lighting = selection.externalLightingSelection || {};
  const summary = lighting.summary || {};
  const lines = lighting.scheduleLines || [];
  return `<article class="window-schedule-card external-lighting-schedule-card">
    <div class="window-schedule-head">
      <div>
        <p>${escapeHtml([selection.category, selection.subcategory].filter(Boolean).join(" / ") || "External Lighting")}</p>
        <h4>${escapeHtml(selection.productName || "External Lighting Schedule")}</h4>
        <em>${escapeHtml(lighting.dashboardSummary || "Beacon exterior lighting schedule")}</em>
      </div>
      <div class="window-summary-tiles">
        ${summaryTile("Products", summary.totalProducts ?? lines.length)}
        ${summaryTile("Fittings", summary.totalFittings ?? lighting.quantity)}
        ${summaryTile("Locations", summary.locationsAssigned ?? lines.reduce((total, line) => total + (Array.isArray(line.locations) ? line.locations.length : 0), 0))}
        ${summaryTile("Missing", summary.missingLocations ?? lighting.missingLocations)}
        ${summaryTile("Quote Required", summary.quoteRequiredProducts ?? lighting.quoteRequiredProducts)}
      </div>
    </div>
    <dl class="window-defaults">
      ${htmlDetail("Supplier", selection.supplierName || lighting.supplier)}
      ${htmlDetail("Allowance", moneyOrStatus(selection.includedAllowance, currency))}
      ${htmlDetail("Selected", moneyOrStatus(selection.clientSelectionPrice, currency, selection.priceStatus))}
      ${htmlDetail("Variation", moneyOrStatus(selection.variationAmount, currency, selection.variationStatus, { signed: true }))}
      ${htmlDetail("Client Confirmation", titleCase(lighting.clientConfirmationStatus || selection.status))}
    </dl>
    <table class="window-pdf-table procurement">
      <thead><tr><th>Image</th><th>Product</th><th>SKU</th><th>Finish</th><th>Qty</th><th>Locations</th><th>IP / Voltage</th><th>Status</th><th>Variation</th></tr></thead>
      <tbody>${lines.map((line) => `<tr>
        <td>${line.imageUrl ? `<img class="pdf-product-thumb" src="${escapeAttribute(line.imageUrl)}" alt="" />` : ""}</td>
        <td>${escapeHtml(line.productName)}</td>
        <td>${escapeHtml(line.sku)}</td>
        <td>${escapeHtml(line.finish)}</td>
        <td>${escapeHtml(line.quantity)}</td>
        <td>${escapeHtml((line.locations || []).map((location) => `${location.lightingPointId} ${location.exactLocation || location.location}${location.notes ? `, ${location.notes}` : ""}`).join("; "))}</td>
        <td>${escapeHtml([line.ipRating, line.voltage].filter(Boolean).join(" / "))}</td>
        <td>${escapeHtml(line.includedStatus || line.priceStatus)}</td>
        <td>${escapeHtml(moneyOrStatus(line.variation, currency, line.priceStatus, { signed: true }))}</td>
      </tr>`).join("")}</tbody>
    </table>
  </article>`;
}

function renderWindowScheduleSelectionHtml(selection, { currency = "AUD" } = {}) {
  const workflow = selection.windowWorkflow || {};
  const summary = workflow.summary || {};
  const defaults = workflow.projectDefaults || {};
  const rows = workflow.effectiveWindows || [];
  const systemRows = Object.entries(defaults.systemsByType || {});
  return `<article class="window-schedule-card">
    <div class="window-schedule-head">
      <div>
        <p>${escapeHtml([selection.category, selection.subcategory].filter(Boolean).join(" / ") || "Windows")}</p>
        <h4>${escapeHtml(selection.productName || "Project window schedule")}</h4>
        <em>${escapeHtml(workflow.source === "demo_window_schedule" ? "Demo window schedule - not an approved client plan" : "Approved project window schedule")}</em>
      </div>
      <div class="window-summary-tiles">
        ${summaryTile("Total Windows", summary.totalWindows ?? selection.windowCount)}
        ${summaryTile("Project Defaults", summary.projectDefaultWindows ?? "")}
        ${summaryTile("Overrides", summary.individualOverrides ?? "")}
        ${summaryTile("Privacy Glass", summary.privacyGlassOverrides ?? "")}
        ${summaryTile("Quote Required", summary.quoteRequired ?? "")}
      </div>
    </div>
    <dl class="window-defaults">
      ${htmlDetail("Supplier", selection.supplierName)}
      ${htmlDetail("Schedule Version", selection.windowScheduleVersion)}
      ${htmlDetail("Default Colour", selection.frameColourCode ? `${selection.frameColourName} (${selection.frameColourCode})` : selection.frameColourName)}
      ${htmlDetail("Default Glass", selection.glazing)}
      ${htmlDetail("Default Screen", selection.screens)}
      ${htmlDetail("Default Hardware", selection.hardware)}
      ${htmlDetail("Allowance", moneyOrStatus(selection.includedAllowance, currency))}
      ${htmlDetail("Variation", moneyOrStatus(selection.variationAmount, currency, selection.variationStatus, { signed: true }))}
    </dl>
    ${systemRows.length ? `<table class="window-system-table"><thead><tr><th>Scheduled Type</th><th>Supplier System</th><th>Status</th></tr></thead><tbody>${systemRows.map(([type, system]) => `<tr><td>${escapeHtml(type)}</td><td>${escapeHtml(system.name || "")}</td><td>${escapeHtml(system.status || "")}</td></tr>`).join("")}</tbody></table>` : ""}
    <table class="window-pdf-table">
      <thead><tr><th>ID</th><th>Room</th><th>Type</th><th>Size</th><th>Supplier System</th><th>Frame Colour</th><th>Glass</th><th>Screen</th><th>Hardware</th><th>Status</th><th>Allowance/Variation</th></tr></thead>
      <tbody>${rows.map((row) => `<tr class="${row.hasOverride ? "override" : row.isWetArea ? "wet" : ""}">
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(row.location)}</td>
        <td>${escapeHtml(row.type)}</td>
        <td>${escapeHtml(row.size)}</td>
        <td>${escapeHtml(row.system?.name || "")}</td>
        <td><span class="pdf-swatch" style="background:${escapeAttribute(row.frameColourHex || "#cbd5e1")}"></span>${escapeHtml(row.frameColourCode ? `${row.frameColourName} (${row.frameColourCode})` : row.frameColourName)}</td>
        <td>${escapeHtml(row.glass)}</td>
        <td>${escapeHtml(row.screen)}</td>
        <td>${escapeHtml(row.hardware)}</td>
        <td><span class="pdf-status ${row.hasOverride ? "purple" : "green"}">${escapeHtml(row.hasOverride ? "Override" : "Default")}</span></td>
        <td>${escapeHtml(moneyOrStatus(selection.variationAmount, currency, selection.variationStatus, { signed: true }))}</td>
      </tr>`).join("")}</tbody>
    </table>
  </article>`;
}

export function groupSnapshotSelections(snapshot = {}) {
  const grouped = new Map();
  for (const selection of snapshot.selections || []) {
    const area = canonicalScheduleSection(selection.area || areaFromSelection(selection));
    const room = normaliseRoom(selection.room || selection.subcategory || selection.category || "General");
    if (!grouped.has(area)) grouped.set(area, new Map());
    const rooms = grouped.get(area);
    if (!rooms.has(room)) rooms.set(room, []);
    rooms.get(room).push(selection);
  }
  return Array.from(grouped.entries()).sort(compareSectionEntries).map(([area, rooms]) => ({
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
    productCode: selection.productCode || selection.product_code || selection.sku || "",
    colour: selection.colour || selection.selected_colour || "",
    finish: selection.finish || selection.selected_finish || "",
    size: selection.size || "",
    configuration: selection.configuration || "",
    glazing: selection.glazing || "",
    hardware: selection.hardware || "",
    entryDoorFurniture: selection.entryDoorFurniture || null,
    entryDoors: selection.entryDoors || [],
    hardwareOptions: selection.hardwareOptions,
    furnitureFinish: selection.furnitureFinish || "",
    furnitureCompatibility: selection.furnitureCompatibility || null,
    location: selection.location || "",
    windowWorkflow: selection.windowWorkflow || null,
    procurementSchedule: selection.procurementSchedule || [],
    garageDoorSelection: selection.garageDoorSelection || null,
    externalLightingSelection: selection.externalLightingSelection || null,
    exteriorColourSelection: selection.exteriorColourSelection || null,
    clientColourSchedule: selection.clientColourSchedule || null,
    painterTradeSchedule: selection.painterTradeSchedule || null,
    technicalCoatingRecords: selection.technicalCoatingRecords || null,
    lightingSchedule: selection.lightingSchedule || null,
    electricalContractorSchedule: selection.electricalContractorSchedule || null,
    allowance: nullableMoney(selection.includedAllowance ?? selection.included_allowance ?? selection.allowance_amount),
    selected: nullableMoney(selection.clientSelectionPrice ?? selection.client_selection_price ?? selection.calculated_client_selection_price),
    variation: nullableMoney(selection.variationAmount ?? selection.variation_amount),
    updatedAt: selection.updatedAt || selection.updated_at || selection.created_at || "",
  }));
  return hashString(JSON.stringify(stable));
}

export function sanitiseClientSelection(selection = {}) {
  const publicSelection = pickClientSelectionKeys(selection);
  const selectedDetails = sanitiseSelectedDetails(publicSelection.selected_details || {});
  const inferredArea = selectedDetails.areaLabel || selectedDetails.area || areaFromSelection(publicSelection);
  const includedAllowance = nullableMoney(publicSelection.included_allowance ?? publicSelection.allowance_amount ?? selectedDetails.allowance);
  const clientSelectionPrice = nullableMoney(publicSelection.client_selection_price ?? publicSelection.calculated_client_selection_price ?? selectedDetails.clientPrice ?? selectedDetails.price);
  const variationAmount = nullableMoney(publicSelection.variation_amount ?? (clientSelectionPrice != null && includedAllowance != null ? clientSelectionPrice - includedAllowance : null));
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
    productId: publicSelection.selected_product_id || publicSelection.product_id || selectedDetails.productId || selectedDetails.selectedProductId || "",
    imageAssetId: publicSelection.image_asset_id || selectedDetails.imageAssetId || "",
    productName: publicSelection.selected_product_name || publicSelection.product_name || selectedDetails.productName || "",
    supplierName: publicSelection.selected_supplier_name || selectedDetails.supplier || "",
    brand: publicSelection.brand || selectedDetails.brand || "",
    modelNumber: publicSelection.model_number || selectedDetails.model || selectedDetails.modelNumber || "",
    productCode: publicSelection.product_code || publicSelection.sku || selectedDetails.productCode || selectedDetails.sku || "",
    range: selectedDetails.range || selectedDetails.productRange || "",
    size: selectedDetails.size || selectedDetails.dimensions || "",
    configuration: selectedDetails.configuration || selectedDetails.doorConfiguration || "",
    material: selectedDetails.material || selectedDetails.materialConstruction || "",
    glazing: selectedDetails.glazing || selectedDetails.glazingOption || "",
    glassClass: selectedDetails.glassClass || "",
    screens: selectedDetails.screens || "",
    handing: selectedDetails.handing || selectedDetails.doorHanding || "",
    hardware: selectedDetails.hardware || selectedDetails.hardwareCompatibility || "",
    entryDoorFurniture: selectedDetails.entryDoorFurniture || null,
    entryDoors: selectedDetails.entryDoors || [],
    hardwareOptions: selectedDetails.hardwareOptions,
    furnitureFinish: selectedDetails.furnitureFinish || "",
    furnitureCompatibility: selectedDetails.furnitureCompatibility || null,
    exceptions: selectedDetails.exceptions || "",
    selectionScope: normaliseSelectionScope(publicSelection.metadata?.selectionScope || selectedDetails.selectionScope),
    clientDecisionRequired: Boolean(publicSelection.metadata?.clientDecisionRequired || selectedDetails.clientDecisionRequired),
    displayInSelectionsSchedule: publicSelection.metadata?.displayInSelectionsSchedule ?? selectedDetails.displayInSelectionsSchedule,
    displayInStandardInclusions: publicSelection.metadata?.displayInStandardInclusions ?? selectedDetails.displayInStandardInclusions,
    displayInBOQ: publicSelection.metadata?.displayInBOQ ?? selectedDetails.displayInBOQ,
    displayInPurchaseOrder: publicSelection.metadata?.displayInPurchaseOrder ?? selectedDetails.displayInPurchaseOrder,
    scope: selectedDetails.scope || "",
    scopeLabel: selectedDetails.scopeLabel || "",
    windowCount: selectedDetails.windowCount || "",
    windowScheduleVersion: selectedDetails.windowScheduleVersion || "",
    applicableWindowIds: selectedDetails.applicableWindowIds || [],
    frameColourName: selectedDetails.frameColourName || "",
    frameColourCode: selectedDetails.frameColourCode || "",
    frameColourClass: selectedDetails.frameColourClass || "",
    frameColourHex: selectedDetails.frameColourHex || "",
    quantity: selectedDetails.quantity || "",
    location: selectedDetails.location || publicSelection.room || "",
    colour: publicSelection.selected_colour || publicSelection.colour || selectedDetails.colour || "",
    finish: publicSelection.selected_finish || publicSelection.finish || selectedDetails.finish || "",
    imageUrl: selectionImageUrl(publicSelection, selectedDetails),
    specificationUrl: publicSelection.specification_url || selectedDetails.specificationURL || "",
    priceStatus: selectedDetails.priceStatus || selectedDetails.pricingStatus || "",
    variationStatus: selectedDetails.variationStatus || "",
    includedAllowance,
    clientSelectionPrice,
    variationAmount,
    isIncludedSelection: publicSelection.is_included_selection !== false,
    status: publicSelection.selection_status || publicSelection.status || "",
    approvedAt: publicSelection.approved_at || "",
    approvedByName: publicSelection.approved_by_name || "",
    clientNote: selectedDetails.clientNote || selectedDetails.clientNotes || "",
    builderNote: selectedDetails.builderNote || selectedDetails.builderNotes || "",
    createdAt: publicSelection.created_at || "",
    updatedAt: publicSelection.updated_at || publicSelection.created_at || "",
    windowWorkflow: selectedDetails.windowWorkflow || null,
    garageDoorSelection: selectedDetails.garageDoorSelection || null,
    externalLightingSelection: selectedDetails.externalLightingSelection || null,
    exteriorColourSelection: selectedDetails.exteriorColourSelection || null,
    clientColourSchedule: selectedDetails.clientColourSchedule || [],
    painterTradeSchedule: selectedDetails.painterTradeSchedule || [],
    technicalCoatingRecords: selectedDetails.technicalCoatingRecords || [],
    lightingSchedule: selectedDetails.lightingSchedule || null,
    electricalContractorSchedule: selectedDetails.electricalContractorSchedule || [],
    procurementSchedule: selectedDetails.procurementSchedule || selectedDetails.windowWorkflow?.procurementSchedule || [],
  };
}

function selectionImageUrl(publicSelection = {}, selectedDetails = {}) {
  const candidates = [
    selectedDetails.exactImageURL,
    selectedDetails.exactImageUrl,
    selectedDetails.exact_image_url,
    selectedDetails.selectedProductImageUrl,
    selectedDetails.projectUploadedImageUrl,
    selectedDetails.imageReference,
    selectedDetails.imageUrl,
    publicSelection.image_url,
  ].map((value) => String(value || "").trim()).filter(Boolean);
  return candidates.find((value) => !PLACEHOLDER_IMAGE_PATTERN.test(value)) || candidates[0] || "";
}

export function reviewScheduleReadiness(snapshotOrOptions = {}) {
  const selections = Array.isArray(snapshotOrOptions) ? snapshotOrOptions : (snapshotOrOptions.selections || []);
  const missing = [];
  const outstanding = [];
  const unconfirmed = [];
  const priceReview = [];
  const imageReview = [];
  for (const selection of selections) {
    const label = selection.productName || selection.title || selection.id || "Selection";
    if (!selection.productName) {
      const item = { id: selection.id, label, reason: "Client selection outstanding" };
      missing.push({ id: selection.id, label, reason: "Product selection missing" });
      outstanding.push(item);
    }
    if (selection.clientDecisionRequired) outstanding.push({ id: selection.id, label, reason: "Client selection outstanding" });
    if (!selection.supplierName) missing.push({ id: selection.id, label, reason: "Supplier not recorded" });
    if (!selection.imageUrl || /placeholder|missing|example/i.test(selection.imageUrl)) imageReview.push({ id: selection.id, label, reason: "Product image requires review" });
    if (selection.clientSelectionPrice == null && !/included|standard/i.test(selection.priceStatus || "")) priceReview.push({ id: selection.id, label, reason: "Selected price requires builder confirmation" });
    if (selection.variationAmount == null) priceReview.push({ id: selection.id, label, reason: "Variation amount requires builder confirmation" });
    if (!CONTRACT_READY_STATUSES.has(String(selection.status || "").toLowerCase())) unconfirmed.push({ id: selection.id, label, reason: "Selection is not confirmed or approved" });
  }
  return {
    totalSelections: selections.length,
    completedSelections: selections.length - missing.filter((item) => item.reason === "Product selection missing").length,
    outstandingClientDecisionCount: uniqueReviewItems(outstanding).length,
    outstanding: uniqueReviewItems(outstanding),
    missing,
    unconfirmed,
    priceReview,
    imageReview,
    canIssueFinal: selections.length > 0 && !missing.length && !unconfirmed.length && !priceReview.length && !imageReview.length,
  };
}

function uniqueReviewItems(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.id || ""}:${item.label || ""}:${item.reason || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createDynamicPageDescriptors(selections = [], { readiness = null } = {}) {
  const groups = groupSnapshotSelections({ selections });
  const pages = [
    { id: "document-info", type: "document-info", title: "Document Information" },
    { id: "project-summary", type: "summary", title: "Project and Financial Summary" },
  ];
  if (readiness && !readiness.canIssueFinal) pages.push({ id: "builder-review", type: "review", title: "Builder Review Items" });
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
  pages.push({ id: "approval-signing", type: "approval", title: "Approval and Signing" });
  return pages;
}

function pickClientSelectionKeys(selection) {
  return CLIENT_SELECTION_KEYS.reduce((result, key) => {
    if (Object.prototype.hasOwnProperty.call(selection, key) && !INTERNAL_FIELD_PATTERN.test(key)) result[key] = selection[key];
    return result;
  }, {});
}

function nextDocumentVersion(previousDocuments = [], { documentStatus = FINAL_INCLUSIONS_STATUS.DRAFT } = {}) {
  const normalisedStatus = normaliseDocumentStatus(documentStatus);
  const previousVersions = previousDocuments
    .filter((document) => document?.metadata?.finalInclusionsSchedule === true || document?.sourceType === FINAL_INCLUSIONS_SOURCE_TYPE)
    .filter((document) => {
      if (normalisedStatus !== FINAL_INCLUSIONS_STATUS.CONTRACT) return true;
      return normaliseDocumentStatus(document.metadata?.documentStatus || document.status) === FINAL_INCLUSIONS_STATUS.CONTRACT;
    })
    .map((document) => Number(document.version || document.metadata?.version || 0))
    .filter(Number.isFinite);
  return Math.max(0, ...previousVersions) + 1;
}

function createDocumentVersionLabel({ documentStatus = FINAL_INCLUSIONS_STATUS.DRAFT, version = 1, revisionReason = "" } = {}) {
  const prefix = documentStatusLabel(documentStatus);
  const suffix = revisionReason ? ` - ${titleCase(revisionReason)}` : "";
  if (normaliseDocumentStatus(documentStatus) === FINAL_INCLUSIONS_STATUS.CONTRACT) return `Contract Version ${Number(version) || 1}${suffix}`;
  return `${prefix} ${Number(version) || 1}${suffix}`;
}

function normaliseDocumentStatus(value = FINAL_INCLUSIONS_STATUS.DRAFT) {
  const status = String(value || FINAL_INCLUSIONS_STATUS.DRAFT).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["final", "issued", "contract", "final_contract_schedule"].includes(status)) return FINAL_INCLUSIONS_STATUS.CONTRACT;
  if (["approval", "for_approval", "sent_for_approval"].includes(status)) return FINAL_INCLUSIONS_STATUS.FOR_APPROVAL;
  if (["approved", "client_approved"].includes(status)) return FINAL_INCLUSIONS_STATUS.APPROVED;
  return FINAL_INCLUSIONS_STATUS.DRAFT;
}

function documentStatusLabel(value) {
  const status = normaliseDocumentStatus(value);
  if (status === FINAL_INCLUSIONS_STATUS.CONTRACT) return "Final Contract Schedule";
  if (status === FINAL_INCLUSIONS_STATUS.FOR_APPROVAL) return "For Approval";
  if (status === FINAL_INCLUSIONS_STATUS.APPROVED) return "Approved Schedule";
  return "Draft Schedule";
}

function sanitiseSelectedDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce((result, [key, detailValue]) => {
    const allowedScheduleKey = ["painterTradeSchedule", "technicalCoatingRecords", "clientColourSchedule", "exteriorColourSelection"].includes(key);
    if ((allowedScheduleKey || !INTERNAL_FIELD_PATTERN.test(key)) && isJsonPrimitiveOrPlain(detailValue)) result[key] = detailValue;
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

function normaliseSelectionScope(value = "") {
  const scope = String(value || "").trim().toLowerCase();
  if (INCLUDED_SELECTION_SCOPES.has(scope) || EXCLUDED_SELECTION_SCOPES.has(scope) || scope === "informational") return scope;
  return "";
}

function isSelectionsScheduleSelection(selection = {}) {
  const metadata = selection.metadata || {};
  const details = selection.selected_details || {};
  const scope = normaliseSelectionScope(metadata.selectionScope || details.selectionScope);
  if (metadata.displayInSelectionsSchedule === false || details.displayInSelectionsSchedule === false) return false;
  if (EXCLUDED_SELECTION_SCOPES.has(scope)) return false;
  if (scope === "informational" && !details.clientDecisionRequired && !metadata.clientDecisionRequired) return false;
  if (scope && !INCLUDED_SELECTION_SCOPES.has(scope)) return false;

  const requirementKey = String(details.requirementKey || metadata.requirementKey || "").trim().toLowerCase();
  const source = String(metadata.source || details.source || "");
  const clientDecisionRequired = Boolean(metadata.clientDecisionRequired || details.clientDecisionRequired);
  const searchable = [
    selection.category,
    selection.subcategory,
    selection.room,
    selection.title,
    selection.description,
    selection.selected_product_name,
    selection.product_name,
    details.item,
    details.productName,
    details.requirementLabel,
  ].filter(Boolean).join(" ");

  if (TECHNICAL_SELECTION_PATTERN.test(searchable)) return false;
  if (GENERIC_SELECTION_PATTERN.test(searchable) && !clientDecisionRequired) return false;
  if (scope === "client_choice" || scope === "builder_choice") return true;
  if (metadata.displayInSelectionsSchedule === true || details.displayInSelectionsSchedule === true) return true;
  if (CLIENT_DECISION_REQUIREMENT_KEYS.has(requirementKey)) return true;
  if (source === "luxury_selections_book" && requirementKey) return true;
  return clientDecisionRequired;
}

function compareSelectionsForSchedule(left, right) {
  return [
    compareSection(left.area, right.area),
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
  const details = selection.selected_details || selection;
  const requirementKey = String(details.requirementKey || selection.metadata?.requirementKey || "").toLowerCase();
  const source = `${selection.category || ""} ${selection.subcategory || ""} ${selection.room || ""} ${details.requirementLabel || ""} ${details.item || ""} ${details.productName || ""}`.toLowerCase();
  if (requirementKey === "roofing" || /roof|fascia|gutter|downpipe|eaves|soffit/.test(source)) return "Roofing";
  if (requirementKey === "bricks" || requirementKey === "external-cladding" || /brick|render|cladding|mortar|facade/.test(source)) return "Bricks, Render and Cladding";
  if (requirementKey === "windows" || requirementKey === "entry-door" || /window|entry\s*door|front\s*door|external\s*door/.test(source)) return "Windows and External Doors";
  if (requirementKey === "garage-door" || /garage\s*door/.test(source)) return "Garage Door";
  if (requirementKey === "external-lighting" || /external\s*lighting|outdoor\s*light|sensor\s*spotlight|wall\s*light/.test(source)) return "External Lighting";
  if (requirementKey === "exterior-paint" || ((/paint|colour|color|eaves|soffit|surround/.test(source)) && /exterior|external|facade|render|cladding|eaves|soffit|fascia|gutter|downpipe|surround/.test(source))) return "Exterior Paint and Colours";
  if (requirementKey === "driveway" || /driveway|concrete|exposed\s*aggregate/.test(source)) return "Driveway";
  if (/external|exterior/.test(source)) return "Exterior";
  if (/alfresco|patio|outdoor/.test(source)) return "Alfresco";
  if (/laundry/.test(source)) return "Laundry";
  if (/ensuite/.test(source)) return "Ensuite";
  if (/powder/.test(source)) return "Powder";
  if (/bath/.test(source)) return "Bathrooms";
  if (/robe|wardrobe/.test(source)) return "Robes";
  if (/bedroom/.test(source)) return "Bedrooms";
  if (/\b(appliances?|oven|cooktop|rangehood|dishwasher|microwave)\b/.test(source)) return "Appliances";
  if (/kitchen|sink|tap/.test(source)) return "Kitchen";
  return "Interior";
}

function canonicalScheduleSection(value) {
  const label = titleCase(value);
  const match = SCHEDULE_SECTION_ORDER.find((section) => section.toLowerCase() === label.toLowerCase());
  return match || label || "General";
}

function compareSection(left, right) {
  const leftLabel = canonicalScheduleSection(left);
  const rightLabel = canonicalScheduleSection(right);
  const leftIndex = SCHEDULE_SECTION_ORDER.indexOf(leftLabel);
  const rightIndex = SCHEDULE_SECTION_ORDER.indexOf(rightLabel);
  if (leftIndex !== rightIndex) {
    if (leftIndex < 0) return 1;
    if (rightIndex < 0) return -1;
    return leftIndex - rightIndex;
  }
  return leftLabel.localeCompare(rightLabel);
}

function compareSectionEntries([left], [right]) {
  return compareSection(left, right);
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
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: ${theme.ink}; font-family: Arial, sans-serif; background: ${theme.surface}; font-size: 10.5pt; }
    main { display: grid; gap: 16px; }
    section { break-after: page; }
    h1, h2, h3, h4, p { margin: 0; }
    h2 { font-size: 17pt; margin-bottom: 10px; }
    h3 { font-size: 11pt; color: ${theme.muted}; }
    .watermark { position: fixed; inset: 32% auto auto 12%; transform: rotate(-20deg); z-index: 0; font-size: 82px; font-weight: 900; color: rgba(180, 83, 9, .1); letter-spacing: 0; pointer-events: none; }
    .cover { min-height: 92vh; display: grid; align-content: end; gap: 18px; border-left: 8px solid ${theme.accent}; padding-left: 28px; }
    .cover-logo { width: 42mm; height: 22mm; object-fit: contain; background: white; padding: 3mm; border-radius: 2mm; margin-bottom: 8mm; }
    .cover p, .product-card p { color: ${theme.accent}; font-size: 12px; font-weight: 800; text-transform: uppercase; }
    .cover h1 { font-size: 36pt; line-height: 1; }
    .cover h2 { font-size: 18pt; color: ${theme.muted}; }
    .contractBanner, .draftBanner { display: inline-block; justify-self: start; border: 2px solid ${theme.accent}; padding: 8px 12px; font-size: 14px; letter-spacing: 0; }
    .draftBanner { color: ${theme.warning}; border-color: ${theme.warning}; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 8px 14px; margin: 0; }
    dt { color: ${theme.muted}; font-weight: 700; }
    dd { margin: 0; font-weight: 800; }
    .document-info, .summary, .review, .approval { display: grid; gap: 14px; }
    .project-summary { margin-bottom: 18px; }
    .totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 8px; }
    .tile, .product-card { border: 1px solid ${theme.border}; border-radius: 8px; background: ${theme.surface}; padding: 14px; }
    .tile span { display: block; color: ${theme.muted}; font-weight: 700; }
    .tile strong { display: block; margin-top: 6px; font-size: 22px; }
    .area, .room { display: grid; gap: 14px; }
    .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .product-card { break-inside: avoid; display: grid; grid-template-columns: 128px 1fr; gap: 14px; min-height: 184px; }
    .product-card img { width: 128px; height: 160px; object-fit: contain; border-radius: 8px; background: ${theme.soft}; }
    .image-pending { width: 128px; height: 160px; display: grid; place-items: center; text-align: center; border: 1px dashed ${theme.warning}; border-radius: 8px; background: #fffbeb; color: ${theme.warning}; font-size: 9pt; font-weight: 800; padding: 10px; }
    .product-card h4 { margin-top: 4px; font-size: 16px; }
    .product-card em { display: block; margin-top: 6px; color: ${theme.muted}; font-style: normal; }
    .product-card dl { margin-top: 10px; font-size: 9.5pt; grid-template-columns: 82px 1fr; gap: 5px 8px; }
    table { width: 100%; border-collapse: collapse; break-inside: auto; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td { border-bottom: 1px solid ${theme.border}; padding: 5px 6px; text-align: left; vertical-align: top; font-size: 9.5pt; line-height: 1.22; }
    th { background: #eaf3ff; color: ${theme.ink}; font-size: 9pt; font-weight: 800; }
    .window-schedule-card { break-inside: auto; display: grid; gap: 10px; grid-column: 1 / -1; border: 1px solid ${theme.border}; border-radius: 8px; padding: 12px; background: ${theme.surface}; }
    .window-schedule-head { display: grid; grid-template-columns: minmax(220px, .8fr) minmax(0, 1.5fr); gap: 12px; align-items: start; }
    .window-summary-tiles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; }
    .window-summary-tiles .tile { padding: 8px; }
    .window-summary-tiles .tile strong { font-size: 13pt; }
    .window-defaults { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px 10px; }
    .window-defaults dt { font-size: 8.5pt; text-transform: uppercase; }
    .window-system-table { margin-top: 2px; }
    .window-pdf-table tbody tr:nth-child(even) { background: #f8fafc; }
    .window-pdf-table tr.override { background: #faf5ff; }
    .window-pdf-table tr.wet { background: #fff7ed; }
    .pdf-product-thumb { width: 42px; height: 54px; object-fit: contain; background: #f8fafc; border-radius: 4px; }
    .pdf-colour-swatch { display: inline-block; width: 22px; height: 14px; border: 1px solid rgba(15,23,42,.25); border-radius: 3px; margin-right: 5px; vertical-align: -2px; }
    .pdf-swatch { display: inline-block; width: 22px; height: 14px; border: 1px solid rgba(15,23,42,.25); border-radius: 3px; margin-right: 5px; vertical-align: -2px; }
    .pdf-status { display: inline-block; border-radius: 999px; padding: 2px 6px; border: 1px solid #86efac; background: #dcfce7; color: #166534; font-size: 8pt; font-weight: 800; }
    .pdf-status.purple { border-color: #d8b4fe; background: #f3e8ff; color: #6b21a8; }
    .schedule-table-section { break-before: page; }
    .schedule-row-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8.4pt; }
    .schedule-row-table thead { display: table-header-group; }
    .schedule-row-table tr { break-inside: avoid; page-break-inside: avoid; min-height: 32mm; }
    .schedule-row-table th { background: ${theme.ink}; color: white; border-right: 1px solid rgba(255,255,255,.18); padding: 2.2mm; text-align: left; font-size: 7pt; text-transform: uppercase; }
    .schedule-row-table td { border: 1px solid ${theme.border}; padding: 2.2mm; vertical-align: middle; line-height: 1.25; overflow-wrap: anywhere; }
    .schedule-row-table td strong { display: block; color: ${theme.ink}; font-weight: 900; }
    .schedule-row-table td span { display: block; color: ${theme.muted}; margin-top: 1mm; }
    .image-col { width: 52mm; }
    .product-col { width: 64mm; }
    .schedule-row-image, .image-empty { width: 48mm; height: 34mm; object-fit: contain; display: block; background: #ffffff; border: 1px solid ${theme.border}; }
    .image-empty { background: ${theme.soft}; }
    .schedule-swatch { display: inline-block !important; width: 18mm; height: 8mm; border: 1px solid rgba(15,23,42,.24); border-radius: 1mm; margin: 0 0 1mm !important; }
    h5 { margin: 2px 0 0; font-size: 10pt; color: ${theme.ink}; }
    .review-list { display: grid; gap: 8px; }
    .review-list div { border: 1px solid ${theme.border}; border-radius: 8px; padding: 10px; background: ${theme.soft}; }
    .review-list strong { display: block; }
    .review-ok { border: 1px solid ${theme.accent}; background: #ecfdf5; border-radius: 8px; padding: 12px; font-weight: 800; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 28px; }
    .signatures div { min-height: 96px; border-top: 1px solid ${theme.ink}; padding-top: 10px; display: grid; align-content: end; gap: 8px; }
    .signatures span { color: ${theme.muted}; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .approval { break-after: auto; display: grid; gap: 12px; }
  `;
}

function renderReadinessSection(readiness = {}) {
  if (readiness.canIssueFinal) return `<section class="review"><h2>Builder Review</h2><div class="review-ok">All selections are complete, confirmed and ready for final issue.</div></section>`;
  const items = [
    ...(readiness.missing || []),
    ...(readiness.unconfirmed || []),
    ...(readiness.priceReview || []),
    ...(readiness.imageReview || []),
  ];
  return `<section class="review">
    <h2>Builder Review Items</h2>
    <p>Resolve these items before issuing the Final Contract Schedule.</p>
    <div class="review-list">
      ${items.map((item) => `<div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.reason)}</span></div>`).join("") || "<div><strong>No review items recorded</strong></div>"}
    </div>
  </section>`;
}

function htmlDetail(label, value) {
  if (!hasRenderableValue(value)) return "";
  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
}

function summaryTile(label, value) {
  return `<div class="tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function hasRenderableValue(value) {
  const next = String(value ?? "").trim();
  if (!next || next === "$0.00") return false;
  if (/^(undefined|null|not entered|missing|estimator missing|builder missing|address missing)$/i.test(next)) return false;
  if (/current\s*\.gr8job/i.test(next)) return false;
  return true;
}

function money(value, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: currency || "AUD", maximumFractionDigits: 2 }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function nullableMoney(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? roundMoney(numeric) : null;
}

function moneyOrStatus(value, currency = "AUD", status = "", { signed = false } = {}) {
  if (value === null || value === undefined || value === "") {
    if (/quote|required|poa|application/i.test(status)) return "Price on application";
    return "Builder to confirm";
  }
  return signed ? signedMoney(value, currency) : money(value, currency);
}

function clientPriceLabel(selection = {}, currency = "AUD") {
  if (/quote|required|poa|application/i.test(`${selection.priceStatus || ""} ${selection.variationStatus || ""}`)) return "Supplier quote required";
  const variation = Number(selection.variationAmount);
  if (Number.isFinite(variation) && variation !== 0) return `Variation ${signedMoney(variation, currency)}`;
  const selected = Number(selection.clientSelectionPrice);
  const allowance = Number(selection.includedAllowance);
  if (Number.isFinite(selected) && selected > 0 && Number.isFinite(allowance) && allowance > 0 && selected !== allowance) {
    return `Allowance ${money(allowance, currency)} / Selected ${money(selected, currency)}`;
  }
  if (Number.isFinite(allowance) && allowance > 0) return `Allowance ${money(allowance, currency)}`;
  return "Included";
}

function meaningfulValue(value = "") {
  const text = String(value || "").trim();
  if (!text || /^(builder\s*)?(standard|supplier|included|configurable)$/i.test(text)) return "";
  return text;
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
