// Carpet is roll stock. A net room area is never silently turned into an order quantity.
import { isSelectionCategoryRoom, isSelectionCategoryName } from "./projectLocations.js";
const round = (n) => Math.round(n * 100) / 100;
const amount = (n) => n !== "" && n != null && Number.isFinite(Number(n)) && Number(n) >= 0 ? Number(n) : null;
const key = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

export function measuredFlooringRooms(workbook = {}) {
  const rooms = new Map();
  const add = (r, source) => {
    if (r.basis === "ASSUMED" || Number(r.confidence) < .5 || r.deleted || r.excluded) return;
    const name = r.roomName || r.roomLabel || r.name;
    if (!name || isSelectionCategoryName(name)) return;
    const g = r.geometry || r;
    const widthMm = amount(g.widthMm), lengthMm = amount(g.lengthMm);
    const area = amount(r.floorAreaM2 ?? r.areaM2 ?? g.floorAreaM2 ?? (r.kind === "floorFinish" || r.kind === "floorArea" ? r.quantity : null))
      ?? (widthMm > 0 && lengthMm > 0 ? widthMm * lengthMm / 1e6 : null);
    const previous = rooms.get(key(name));
    if (previous?.areaM2 > 0) return;
    rooms.set(key(name), { name, areaM2: area > 0 ? round(area) : "", widthMm, lengthMm, source, id: r.id || key(name), flooringType: /carpet/i.test(r.flooringType || r.floorFinish || r.category || "") ? "carpet" : "" });
  };
  const book = workbook.clientSelectionsBook || workbook.selectionsBook || {};
  (book.rooms || []).filter((r) => !isSelectionCategoryRoom(r)).forEach((r) => add(r, "project"));
  (workbook.projectRooms || workbook.rooms || []).forEach((r) => add(r, "project"));
  (workbook.jobSetup?.rooms || []).forEach((r) => add(r, "job-setup"));
  const job = workbook.aiPlanTakeoffJob || workbook.takeoffEngine?.aiPlanTakeoffJob || {};
  (job.aiAnalysis?.rooms || job.scheduleState?.aiAnalysis?.rooms || []).forEach((r) => add(r, "takeoff"));
  const schedule = workbook.takeoffEngine?.lastJobSetupSync?.payload?.schedule || workbook.takeoffSchedule || job.schedule || job.scheduleState?.schedule || {};
  (schedule.measurementRecords || []).filter((r) => ["floorFinish", "floorArea"].includes(r.kind)).forEach((r) => {
    const name = r.roomName || r.roomLabel || (rooms.has(key(r.label)) ? r.label : "");
    if (name) add({ ...r, name }, "takeoff");
  });
  // Unsynchronised but calibrated plan polygons: only match an actual named project room.
  const scale = Number(job.pixelsPerMm);
  if (scale > 0) {
    const polygonArea = (nodes) => !Array.isArray(nodes) || nodes.length < 3 ? null : Math.abs(nodes.reduce((sum, a, i) => { const b = nodes[(i + 1) % nodes.length]; return sum + a.x * b.y - b.x * a.y; }, 0)) / (2 * scale * scale * 1e6);
    [...(job.completedAreas || []), ...(job.completedFloorplans || [])].forEach((r) => {
      const name = r.roomName || r.roomLabel || (rooms.has(key(r.label)) ? r.label : "");
      const gross = polygonArea(r.nodes), exclusions = (r.exclusions || []).map((e) => polygonArea(e.nodes));
      if (name && gross !== null && exclusions.every((a) => a !== null)) add({ ...r, name, areaM2: Math.max(0, gross - exclusions.reduce((sum, a) => sum + a, 0)) }, "takeoff");
    });
  }
  return [...rooms.values()];
}

// The quotation is the project's estimating catalogue. Do not relabel an all-in rate as material.
export function carpetEstimateRates(quotation = {}) {
  const rows = Object.entries(quotation).filter(([name]) => /carpet|floorcover/i.test(name)).flatMap(([, section]) => section.rows || []).filter((r) => r.source !== "client-selections-flooring" && r.active !== false && r.included !== false && !r.quotedSupplierRate && !r.supplierQuote && !/\bquote\b|\btotal\b/i.test(r.item || "") && /^(m2|m²|m\^2)$/i.test(String(r.unit || "").trim()));
  const rate = (row) => amount(String(row?.manualRate || row?.excelRate || row?.rate || "").replace(/[$,]/g, ""));
  const find = (pattern) => rows.find((r) => pattern.test(r.item || r.description || "") && rate(r) !== null);
  const underlay = find(/underlay/i), installation = find(/install|laying|labour/i);
  const material = rows.find((r) => /carpet/i.test(r.item || "") && /material|supply only/i.test(r.item || "") && rate(r) !== null);
  const candidates = rows.filter((r) => !/underlay|install|laying|labour/i.test(r.item || "") && rate(r) !== null && r.active !== false && r.included !== false);
  const allIn = !material ? candidates.find((r) => Number(r.carpetAllocation?.original?.quantity ?? r.quantity ?? r.qty) > 0) || candidates[0] : null;
  return {
    materialPerM2ExGst: material ? rate(material) : null,
    underlayPerM2ExGst: underlay ? rate(underlay) : null,
    installationPerM2ExGst: installation ? rate(installation) : null,
    otherExGst: null,
    combinedAllowancePerM2ExGst: allIn ? rate(allIn) : null,
    source: [material, underlay, installation, allIn].filter(Boolean).map((r) => r.item).join("; "),
    sourceRowIds: [material, underlay, installation, allIn].filter(Boolean).map((r) => r.id),
  };
}

export function validateCarpetQuote(quote = {}) {
  if (!String(quote.supplier || "").trim()) return "Enter the retailer that supplied this quote.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(quote.quoteDate || "") || !Number.isFinite(Date.parse(quote.quoteDate))) return "Enter the quote date.";
  if (!(amount(quote.materialPerM2ExGst) > 0)) return "Enter the actual quoted material rate.";
  for (const field of ["underlayPerM2ExGst", "installationPerM2ExGst", "otherExGst"]) if (amount(quote[field]) === null) return "Enter each quoted cost, using 0 only when included or not required.";
  return "";
}

export function appendCarpetQuote(history = [], quote, { now = new Date().toISOString() } = {}) {
  const error = validateCarpetQuote(quote);
  if (error) throw new Error(error);
  const record = { supplier: quote.supplier.trim(), quoteDate: quote.quoteDate, reference: String(quote.reference || "").trim(), currency: "AUD", gstIncluded: false,
    ...Object.fromEntries(["materialPerM2ExGst", "underlayPerM2ExGst", "installationPerM2ExGst", "otherExGst"].map((k) => [k, amount(quote[k])])) };
  const same = (r) => Object.keys(record).every((k) => r[k] === record[k]);
  if (history.some(same)) return history;
  return [...history, { ...record, id: `carpet-quote-${now}-${history.length}`, recordedAt: now }];
}

export function carpetLineDetails({ product, variant, rooms, net, options = {}, estimateRates = {} }) {
  const specs = product?.attributes?.carpetSpecs || {};
  const estimated = amount(options.estimatedOrderAreaM2);
  const areaChanged = options.orderNetAreaM2 != null && round(Number(options.orderNetAreaM2)) !== round(net);
  const order = !areaChanged && estimated >= round(net) && estimated > 0 ? round(estimated) : null;
  const quoteHistory = options.supplierQuoteHistory || [];
  const chosen = quoteHistory.find((q) => q.id === options.selectedQuoteId) || null;
  const quote = chosen && !validateCarpetQuote(chosen) ? chosen : null;
  const rates = { ...estimateRates };
  for (const [field, value] of Object.entries(options.estimate || {})) if (amount(value) !== null) rates[field] = amount(value);
  const hasComponents = amount(rates.materialPerM2ExGst) !== null || Object.values(options.estimate || {}).some((v) => amount(v) !== null) || (rates.combinedAllowancePerM2ExGst == null && ["underlayPerM2ExGst", "installationPerM2ExGst", "otherExGst"].some((k) => amount(rates[k]) !== null));
  const internalEstimateExGst = hasComponents
    ? round((rates.materialPerM2ExGst || 0) * (order ?? net) + ((rates.underlayPerM2ExGst || 0) + (rates.installationPerM2ExGst || 0)) * net + (rates.otherExGst || 0))
    : rates.combinedAllowancePerM2ExGst != null ? round(rates.combinedAllowancePerM2ExGst * net) : null;
  const internalEstimateComplete = hasComponents ? ["materialPerM2ExGst", "underlayPerM2ExGst", "installationPerM2ExGst", "otherExGst"].every((k) => amount(rates[k]) !== null) : rates.combinedAllowancePerM2ExGst != null;
  const materialCostExGst = quote && order !== null ? round(quote.materialPerM2ExGst * order) : null;
  const selectedCostExGst = materialCostExGst !== null ? round(materialCostExGst + (quote.underlayPerM2ExGst + quote.installationPerM2ExGst) * net + quote.otherExGst) : null;
  return {
    manufacturer: product?.manufacturer || "", fibre: specs.fibre || "", colourCode: variant.colourCode || "", carpetSpecs: specs,
    rollWidthM: specs.rollWidthM || variant.rollWidthM || null,
    estimatedOrderAreaM2: order, orderQuantityStatus: areaChanged ? "Room areas changed — review the cutting estimate" : order === null ? "Cutting plan required" : "Manual estimate — confirm cutting plan",
    cuttingPlan: { schemaVersion: 1, method: order === null ? "not-calculated" : "manual-estimate", direction: options.direction || null, seams: options.seams || null, notes: options.cuttingNotes || "", roomDimensions: rooms.map((r) => ({ areaId: r.areaId, widthMm: r.widthMm || null, lengthMm: r.lengthMm || null })) },
    wastagePct: null, requiredAreaM2: order, purchasedAreaM2: order, packs: null, packCoverageM2: null,
    supplier: quote?.supplier || "", supplierQuote: quote, supplierQuoteHistory: quoteHistory,
    regularPricePerM2: quote ? round(quote.materialPerM2ExGst * 1.1) : null, regularPricePerPack: null,
    priceBasis: quote ? `Retailer quote ${quote.quoteDate} (material inc GST)` : "Supplier quote required", priceRetrievedAt: quote?.quoteDate || "",
    materialCost: materialCostExGst === null ? null : round(materialCostExGst * 1.1),
    selectedCostExGst, selectedCost: selectedCostExGst === null ? null : round(selectedCostExGst * 1.1), priced: selectedCostExGst !== null,
    estimateRates: rates, internalEstimateExGst, internalEstimateComplete,
    allowancePerM2ExGst: internalEstimateExGst === null ? 0 : internalEstimateExGst / net,
    allowancePerM2: internalEstimateExGst === null ? 0 : round(internalEstimateExGst * 1.1 / net),
    allowanceTotal: internalEstimateExGst === null ? 0 : round(internalEstimateExGst * 1.1), allowanceSource: rates.source || (hasComponents ? "Internal carpet estimate" : ""),
    variation: selectedCostExGst === null || !internalEstimateComplete ? null : round((selectedCostExGst - internalEstimateExGst) * 1.1),
    variationExGst: selectedCostExGst === null || !internalEstimateComplete ? null : round(selectedCostExGst - internalEstimateExGst),
  };
}
