// The selection-book row patch for an allocated (product -> location -> quantity) requirement,
// built from its product lines. Shared by the Selections Book save path (commitPlumbingAllocation)
// and by load-time migrations, so a migrated row is exactly what saving it would produce.
import { INDICATIVE_RATE_BASIS } from "./allocatedSelectionQuotation.js";
import { PRICE_STATES, requirementImage } from "./clientSelectionWorkflow.js";
import { formatPlumbingAllocations, plumbingAllocationRecord, plumbingAllocationSummary, plumbingLineWithTotals, plumbingLocationKey } from "./plumbingFixtureAllocation.js";

function selectionLineGstBasis(line = {}) {
  if (typeof line.priceIncludesGst === "boolean") return line.priceIncludesGst;
  const basis = `${line.priceBasis || ""} ${line.gstTreatment || ""}`;
  if (/\b(?:inc(?:lusive)?|including|included)\.?\s*gst\b|\bgst\s*(?:inclusive|included)\b/i.test(basis)) return true;
  if (/\b(?:ex(?:clusive)?|excluding|excluded)\.?\s*gst\b|\bgst\s*(?:exclusive|excluded)\b/i.test(basis)) return false;
  return null;
}

// Returns null when no line has any quantity (the selection is then cleared by the caller).
export function plumbingSelectionPatch(requirement = {}, lines = [], previousDetails = null, { projectId = "", organisationId = "", now = new Date().toISOString() } = {}) {
  const normalizedLines = lines.map((line) => {
    const priceIncludesGst = selectionLineGstBasis(line);
    return priceIncludesGst === line.priceIncludesGst ? line : { ...line, priceIncludesGst };
  });
  const record = plumbingAllocationRecord(requirement, normalizedLines, previousDetails?.plumbingAllocation || null);
  const summary = plumbingAllocationSummary(record.lines);
  if (!record.lines.length) return null;
  const lead = record.lines[0];
  const multiple = record.lines.length > 1;
  const leadGstBasis = lead.priceIncludesGst;
  const priceIncludesGst = typeof leadGstBasis === "boolean" && record.lines.every((line) => line.priceIncludesGst === leadGstBasis) ? leadGstBasis : null;
  const indicativeOnly = record.lines.every((line) => line.rateBasis === INDICATIVE_RATE_BASIS);
  const priceState = !summary.allPriced || summary.variation === null ? PRICE_STATES.pending : indicativeOnly ? PRICE_STATES.indicative : PRICE_STATES.current;
  const measured = record.lines.some((line) => line.unit && line.unit !== "EACH");
  const productSummary = record.lines.map((line) => (measured ? `${line.productName} ${line.quantity} ${line.unit}` : `${line.productName} ×${line.quantity}`)).join("; ");
  const locationAllocations = record.locationSchedule.map((entry) => ({ location: entry.location, locationKey: entry.locationKey, quantity: entry.quantity, productCode: entry.productCode, productName: entry.productName }));
  return {
    record,
    summary,
    patch: {
      selectedOptionId: lead.productId || lead.lineId,
      selectedProduct: multiple ? productSummary : lead.productName,
      productModel: record.lines.map((line) => line.supplierCode || line.model).filter(Boolean).join(", "),
      brand: Array.from(new Set(record.lines.map((line) => line.brand).filter(Boolean))).join(", "),
      description: record.lines.map((line) => `${line.productName}: ${formatPlumbingAllocations(line.allocations, line.unit)}`).join(" | "),
      supplier: lead.supplier,
      finishColour: lead.finish,
      imageUrl: lead.imageUrl || requirementImage(requirement),
      allowanceAmount: summary.unitAllowance,
      selectedCost: summary.unitPrice,
      upgradeCost: summary.variation,
      included: summary.allPriced && summary.variation === 0,
      status: "selected",
      guidedSelection: {
        source: "guided_client_selections",
        projectId,
        organisationId,
        area: requirement.areaKey,
        room: requirement.areaLabel,
        requirementKey: requirement.requirementKey,
        requirementLabel: requirement.label,
        familyKey: requirement.familyKey,
        linkedQuoteItemCode: requirement.linkedQuoteItemCode || "",
        productId: lead.productId,
        productCode: lead.productCode,
        brand: lead.brand,
        supplier: lead.supplier,
        productName: multiple ? productSummary : lead.productName,
        selectedProduct: multiple ? productSummary : lead.productName,
        model: lead.supplierCode || lead.model,
        colour: lead.colour,
        finish: lead.finish,
        unit: requirement.unit || "EACH",
        quantity: summary.quantity,
        allowance: summary.unitAllowance,
        selectedPrice: summary.unitPrice,
        priceIncludesGst,
        allowanceTotal: summary.allowanceTotal,
        selectedTotal: summary.selectedTotal,
        variation: summary.variation,
        priceState,
        priceStatus: priceState,
        variationPending: !summary.allPriced || summary.variation === null,
        imageReference: lead.imageUrl || requirementImage(requirement),
        officialProductURL: lead.officialProductURL,
        locationAllocations,
        plumbingAllocation: record,
        selectedAt: previousDetails?.selectedAt || now,
        updatedAt: now,
        selectionTimestamp: now,
      },
    },
  };
}

export function normalizeSelectionPackRoomAliases(book = {}) {
  if (!Array.isArray(book.rooms)) return book;
  const candidates = new Map();
  book.rooms.filter((room) => room?.name && !String(room.id || "").startsWith("guided-")).forEach((room) => {
    const key = plumbingLocationKey(room.name);
    if (!/^bedroom-\d+-ensuite(?:-|$)/.test(key)) return;
    candidates.set(key, [...new Set([...(candidates.get(key) || []), room.name])]);
  });
  const canonicalLabel = (allocation) => {
    const key = plumbingLocationKey(allocation.location);
    const labels = candidates.get(key) || [];
    return labels.length === 1 ? labels[0] : allocation.location;
  };
  let changed = false;
  const rooms = book.rooms.map((room) => {
    let roomChanged = false;
    const rows = (room.rows || []).map((row) => {
      const selection = row.guidedSelection;
      const savedLines = selection?.plumbingAllocation?.lines;
      if (!Array.isArray(savedLines) || !savedLines.some((line) => line.selectionPack?.packId)) return row;
      const lines = savedLines.map((saved) => {
        const normalized = plumbingLineWithTotals(saved);
        const allocations = normalized.allocations.map((allocation) => ({ ...allocation, location: canonicalLabel(allocation) }));
        return plumbingLineWithTotals({ ...normalized, allocations });
      });
      const lineChanged = lines.some((line, index) => {
        const saved = savedLines[index];
        return line.quantity !== saved.quantity
          || line.selectionPack?.packQuantity !== saved.selectionPack?.packQuantity
          || JSON.stringify(line.allocations) !== JSON.stringify(saved.allocations);
      });
      if (!lineChanged) return row;
      const built = plumbingSelectionPatch({
        requirementKey: selection.requirementKey || row.guidedRequirementKey || "",
        label: selection.requirementLabel || row.guidedRequirementLabel || "",
        areaKey: selection.area || "",
        unit: selection.unit || "EACH",
      }, lines, selection);
      if (!built) return row;
      roomChanged = true;
      return { ...row, ...built.patch, guidedSelection: { ...selection, ...built.patch.guidedSelection } };
    });
    if (!roomChanged) return room;
    changed = true;
    return { ...room, rows };
  });
  return changed ? { ...book, rooms, updatedAt: new Date().toISOString() } : book;
}

