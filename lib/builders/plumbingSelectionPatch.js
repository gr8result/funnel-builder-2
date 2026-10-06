// The selection-book row patch for an allocated (product -> location -> quantity) requirement,
// built from its product lines. Shared by the Selections Book save path (commitPlumbingAllocation)
// and by load-time migrations, so a migrated row is exactly what saving it would produce.
import { INDICATIVE_RATE_BASIS } from "./allocatedSelectionQuotation.js";
import { PRICE_STATES, requirementImage } from "./clientSelectionWorkflow.js";
import { formatPlumbingAllocations, plumbingAllocationRecord, plumbingAllocationSummary } from "./plumbingFixtureAllocation.js";

// Returns null when no line has any quantity (the selection is then cleared by the caller).
export function plumbingSelectionPatch(requirement = {}, lines = [], previousDetails = null, { projectId = "", organisationId = "", now = new Date().toISOString() } = {}) {
  const record = plumbingAllocationRecord(requirement, lines, previousDetails?.plumbingAllocation || null);
  const summary = plumbingAllocationSummary(record.lines);
  if (!record.lines.length) return null;
  const lead = record.lines[0];
  const multiple = record.lines.length > 1;
  const indicativeOnly = record.lines.every((line) => line.rateBasis === INDICATIVE_RATE_BASIS);
  const priceState = !summary.allPriced ? PRICE_STATES.pending : indicativeOnly ? PRICE_STATES.indicative : PRICE_STATES.current;
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
        allowanceTotal: summary.allowanceTotal,
        selectedTotal: summary.selectedTotal,
        variation: summary.variation,
        priceState,
        priceStatus: priceState,
        variationPending: !summary.allPriced,
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
