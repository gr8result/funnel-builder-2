const WINDOW_TYPES = new Set(["window", "awning", "sliding", "fixed", "louvre", "casement", "double-hung"]);

function text(value) {
  return String(value ?? "").trim();
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function openingKind(opening = {}) {
  const type = text(opening.windowType || opening.openingType || "window").toLowerCase();
  if (WINDOW_TYPES.has(type)) return "window";
  if (type.includes("garage")) return "garage-door";
  if (type.includes("door")) return "door";
  return "other-opening";
}

function specKey(record) {
  return [
    record.code,
    record.type,
    record.widthMm || "",
    record.heightMm || "",
    record.frameMaterial,
    record.frameColour,
    record.glazingType,
    record.glassThickness,
    record.flyscreen,
    record.securityScreen,
    record.supplier,
    record.productModel,
  ].map((part) => text(part).toLowerCase()).join("|");
}

export function buildWindowRecordFromOpening(opening = {}, page = {}) {
  if (openingKind(opening) !== "window") return null;
  const widthMm = numberOrNull(opening.widthMm);
  const heightMm = numberOrNull(opening.heightMm);
  const quantity = Math.max(1, Number(opening.quantity) || 1);
  const code = text(opening.code || opening.mark || opening.label);
  const room = text(opening.room || opening.roomName);
  const floor = text(opening.level || opening.floor || page?.level || "Ground Level");
  const elevation = text(opening.elevation || opening.exteriorWallElevation || opening.location);
  const type = text(opening.windowType || "window") || "window";
  const descriptionParts = [
    code || type,
    widthMm && heightMm ? `${Math.round(widthMm)} x ${Math.round(heightMm)} mm` : "",
    room,
    elevation,
  ].filter(Boolean);

  return {
    id: opening.windowRecordId || opening.id,
    openingId: opening.id,
    source: opening.source || "manual",
    status: opening.confirmed === false ? "needs-review" : "approved",
    code,
    mark: code,
    type,
    widthMm,
    heightMm,
    quantity,
    floor,
    room,
    elevation,
    location: elevation,
    frameMaterial: text(opening.frameMaterial),
    frameColour: text(opening.frameColour || opening.frameColor),
    glazingType: text(opening.glazingType || opening.glassType),
    glassThickness: text(opening.glassThickness),
    obscureGlass: Boolean(opening.obscureGlass),
    safetyGlass: Boolean(opening.safetyGlass),
    energyRatingRequirements: text(opening.energyRatingRequirements),
    flyscreen: text(opening.flyscreen || opening.screenRequirements),
    securityScreen: text(opening.securityScreen),
    openingDirection: text(opening.openingDirection),
    supplier: text(opening.supplier),
    productModel: text(opening.productModel || opening.product || opening.model),
    installationNotes: text(opening.installationNotes),
    generalNotes: text(opening.generalNotes || opening.notes),
    wallId: opening.wallId || null,
    wallGraph: opening.wallGraph || "exterior",
    pageId: page?.id || null,
    documentId: page?.documentId || null,
    description: descriptionParts.join(" - "),
    missingSpecs: [
      !code ? "code" : "",
      !widthMm ? "width" : "",
      !heightMm ? "height" : "",
      !room ? "room" : "",
      !floor ? "floor" : "",
    ].filter(Boolean),
  };
}

export function buildWindowWorkflowModels(openings = [], page = {}) {
  const records = openings.map((opening) => buildWindowRecordFromOpening(opening, page)).filter(Boolean);
  const grouped = new Map();
  records.forEach((record) => {
    const key = specKey(record);
    const current = grouped.get(key) || {
      id: `window-order-${grouped.size + 1}`,
      key,
      code: record.code,
      type: record.type,
      widthMm: record.widthMm,
      heightMm: record.heightMm,
      frameMaterial: record.frameMaterial,
      frameColour: record.frameColour,
      glazingType: record.glazingType,
      glassThickness: record.glassThickness,
      flyscreen: record.flyscreen,
      securityScreen: record.securityScreen,
      supplier: record.supplier,
      productModel: record.productModel,
      quantity: 0,
      records: [],
      rooms: [],
      floors: [],
      status: "order-ready",
    };
    current.quantity += record.quantity;
    current.records.push(record.id);
    current.rooms = Array.from(new Set([...current.rooms, record.room].filter(Boolean)));
    current.floors = Array.from(new Set([...current.floors, record.floor].filter(Boolean)));
    if (record.missingSpecs.length) current.status = "needs-specs";
    grouped.set(key, current);
  });
  const orderLines = Array.from(grouped.values());
  const quotationLineItems = orderLines.map((line) => ({
    id: `quote-${line.id}`,
    source: "takeoff-window-workflow",
    description: [
      line.code || line.type || "Window",
      line.widthMm && line.heightMm ? `${Math.round(line.widthMm)} x ${Math.round(line.heightMm)} mm` : "",
      line.frameColour,
      line.glazingType,
    ].filter(Boolean).join(" - "),
    code: line.code,
    dimensions: line.widthMm && line.heightMm ? `${Math.round(line.widthMm)} x ${Math.round(line.heightMm)} mm` : "",
    qty: line.quantity,
    quantity: line.quantity,
    floor: line.floors.join(", "),
    room: line.rooms.join(", "),
    location: line.rooms.join(", "),
    supplier: line.supplier,
    unitRate: null,
    totalRate: null,
    status: line.status === "order-ready" ? "ready-for-pricing" : "needs-specs",
  }));
  const reconciliation = {
    status: orderLines.length && orderLines.every((line) => line.status === "order-ready") ? "ready-for-approval" : "needs-review",
    planDetected: records.filter((record) => record.source !== "manual").length,
    manuallyAdded: records.filter((record) => record.source === "manual").length,
    matched: records.filter((record) => !record.missingSpecs.length).length,
    unmatched: records.filter((record) => record.missingSpecs.length).map((record) => record.id),
    possibleDuplicates: orderLines.filter((line) => line.records.length > 1).map((line) => line.id),
    missingSpecs: records.filter((record) => record.missingSpecs.length).map((record) => ({ id: record.id, fields: record.missingSpecs })),
    finalOrderQty: orderLines.reduce((total, line) => total + line.quantity, 0),
    approved: Boolean(page?.windowReconciliation?.approved),
    approvedAt: page?.windowReconciliation?.approvedAt || null,
  };
  return {
    windowRecords: records,
    windowOrderLines: orderLines,
    windowReconciliation: reconciliation,
    windowsDoorsModel: { source: "takeoff-engine", rows: records, orderLines, reconciliation },
    quotationBuilderModel: { source: "takeoff-engine", windowLineItems: quotationLineItems },
    boqWindowLines: quotationLineItems,
    supplierQuotationWindowLines: quotationLineItems,
    procurementWindowLines: quotationLineItems,
    purchaseOrderWindowLines: quotationLineItems.filter((line) => line.status === "ready-for-pricing"),
    projectEstimateWindowLines: quotationLineItems,
  };
}

export function openingWorkflowPatch(openings = [], page = {}) {
  return buildWindowWorkflowModels(openings, page);
}
