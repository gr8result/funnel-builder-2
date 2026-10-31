const amount = (value) => {
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

function resolutionRecord(type, issueId, details = {}) {
  return {
    id: `commercial-resolution:${issueId}:${Date.now()}`,
    issueId,
    type,
    status: "APPLIED",
    recordedAt: new Date().toISOString(),
    ...details,
  };
}

function withResolution(workbook, record) {
  return {
    ...workbook,
    commercialIssueResolutions: [...(workbook.commercialIssueResolutions || []), record],
  };
}

export function commercialIssueExcluded(workbook = {}, issueId = "") {
  return (workbook.commercialIssueResolutions || []).some((entry) =>
    entry.issueId === issueId && entry.type === "NOT_REQUIRED" && entry.status === "APPLIED");
}

export function excludeCommercialIssue(workbook = {}, { issueId, reason }) {
  const justification = String(reason || "").trim();
  if (!issueId) throw new Error("The commercial issue identity is required.");
  if (justification.length < 10) throw new Error("Enter an auditable reason of at least 10 characters.");
  return withResolution(workbook, resolutionRecord("NOT_REQUIRED", issueId, { reason: justification }));
}

export function updateCommercialQuoteRow(workbook = {}, {
  issueId,
  section,
  rowId,
  quantity,
  unit,
  supplierRate,
  gstTreatment,
  source,
}) {
  const group = workbook.quotation?.[section];
  if (!group) throw new Error("The quotation section no longer exists.");
  const index = (group.rows || []).findIndex((row) => row.id === rowId);
  if (index < 0) throw new Error("The quotation row no longer exists.");
  const rows = [...group.rows];
  const row = rows[index];
  const patch = {};
  const rate = amount(supplierRate);
  if (supplierRate !== undefined) {
    if (!(rate > 0)) throw new Error("Enter a supplier rate greater than zero.");
    if (!["included", "excluded"].includes(gstTreatment)) throw new Error("Confirm whether the supplier rate includes GST.");
    const evidence = String(source || "").trim();
    if (!evidence) throw new Error("Enter the supplier, quotation reference or source URL.");
    patch.manualRate = Math.round((gstTreatment === "included" ? rate / 1.1 : rate) * 10000) / 10000;
    patch.priceStatus = "Current Price";
    patch.quoteRequired = false;
    patch.costPending = false;
    patch.commercialPriceEvidence = {
      enteredRate: rate,
      gstTreatment,
      rateExGst: patch.manualRate,
      source: evidence,
      verifiedAt: new Date().toISOString(),
      verifiedBy: "builder",
    };
  }
  if (quantity !== undefined) {
    const measured = amount(quantity);
    if (!(measured > 0)) throw new Error("Enter a measured quantity greater than zero.");
    patch.qty = measured;
    patch.quantity = String(measured);
    patch.unit = String(unit || row.unit || "").trim();
    patch.quantityManualOverride = true;
    patch.autoQuantity = false;
    patch.quantitySource = "BUILDER_COMMERCIAL_ISSUE_RESOLUTION";
    patch.quantityEvidence = { source: "Commercial Issue Review", recordedAt: new Date().toISOString() };
    patch.selectionQuantityPending = false;
  }
  rows[index] = { ...row, ...patch };
  return withResolution({
    ...workbook,
    quotation: { ...workbook.quotation, [section]: { ...group, rows } },
  }, resolutionRecord("QUOTE_ROW_UPDATE", issueId, { section, rowId, fields: Object.keys(patch) }));
}

export function createCommercialIssueRfq(workbook = {}, { issueId, entry = {}, rateGroup = null }) {
  if (!issueId) throw new Error("The commercial issue identity is required.");
  const id = `procurement:commercial-issue:${encodeURIComponent(issueId)}`;
  const current = workbook.procurement?.items || [];
  if (current.some((item) => item.id === id)) return workbook;
  const row = rateGroup?.rows?.[0] || {};
  const quantity = entry.quantity || rateGroup?.quantity || row.qty || row.quantity || null;
  const unit = entry.unit || rateGroup?.unit || row.unit || "";
  const item = {
    id,
    jobId: workbook.jobId || "",
    workspaceId: workbook.workspaceId || "",
    selectionIdentityKey: entry.identityKey || entry.key || "",
    requirementKey: entry.requirementKey || rateGroup?.requirementKey || "",
    productId: entry.productId || "",
    productCode: entry.productCode || "",
    itemDescription: entry.productName || rateGroup?.label || row.item || "Supplier quotation required",
    sectionName: entry.section || rateGroup?.section || "",
    sourceQuoteRowId: entry.quoteRowIds?.[0] || row.id || "",
    qty: quantity,
    unit,
    supplier: entry.supplier || "",
    locationSchedule: entry.locationAllocations || [],
    status: "RFQ REQUIRED",
    orderStatus: "Not Started",
    deliveryStatus: "Not Required Yet",
    quoteRequired: true,
    costPending: true,
    approvedForOrdering: false,
    commercialIssueId: issueId,
    notes: "Created from Commercial Issue Review. Supplier rate, GST basis and source evidence remain pending.",
  };
  return withResolution({
    ...workbook,
    procurement: { ...(workbook.procurement || {}), items: [...current, item] },
  }, resolutionRecord("RFQ_CREATED", issueId, { procurementId: id }));
}

export function selectCommercialIssueProduct(workbook = {}, { issueId, selectionRowId, product }) {
  if (!selectionRowId) throw new Error("The saved Client Selection row could not be identified.");
  if (!product?.productId) throw new Error("Choose a Product Library product.");
  let matched = false;
  const updateBook = (book = {}) => ({
    ...book,
    rooms: (book.rooms || []).map((room) => ({
      ...room,
      rows: (room.rows || []).map((row) => {
        if (row.id !== selectionRowId) return row;
        matched = true;
        const field = row.guidedSelection ? "guidedSelection" : row.selected_details ? "selected_details" : "selectedDetails";
        const prior = row[field] || {};
        return {
          ...row,
          [field]: {
            ...prior,
            productId: product.productId,
            productCode: product.productCode || "",
            productName: product.productName || product.name || "",
            supplier: product.supplier || product.brand || "",
            selectedPrice: product.builderPrice ?? product.price ?? null,
            priceIncludesGst: product.priceIncludesGst ?? product.attributes?.priceIncludesGst ?? null,
            priceStatus: product.builderPrice || product.price ? "Current Price" : "PRICE REQUIRED",
          },
        };
      }),
    })),
  });
  const clientSelectionsBook = updateBook(workbook.clientSelectionsBook || workbook.selectionsBook || {});
  if (!matched) throw new Error("The saved Client Selection row no longer exists.");
  return withResolution({
    ...workbook,
    clientSelectionsBook,
    ...(workbook.selectionsBook ? { selectionsBook: clientSelectionsBook } : {}),
  }, resolutionRecord("PRODUCT_SELECTED", issueId, { selectionRowId, productId: product.productId }));
}
