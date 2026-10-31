import { plumbingLinesFromSelection } from "./plumbingFixtureAllocation.js";
import { serviceQuoteRequirements } from "./residentialServices.js";

const FIXTURE_REQUIREMENTS = new Set(["interior-lighting", "ceiling-fan"]);
const text = (value) => String(value ?? "").trim();
const number = (value) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
const productIdOf = (line) => text(line.productId || line.productCode || line.lineId);
const fixtureKey = (requirementKey, productId) => `${requirementKey}|${productId}`;

function explicitRowFor(line, requirementKey, rows, mappings, workbook) {
  const productId = productIdOf(line);
  const mapped = mappings.filter((mapping) => mapping.status === "MAPPED"
    && mapping.template_id === (workbook.templateKey || "")
    && mapping.workspace_id === workbook.workspaceId
    && mapping.requirement_key === requirementKey
    && (mapping.metadata?.productId || mapping.product_id) === productId);
  const rowTargets = [line.quotationRowId ? { section: line.quotationSection || "", rowId: line.quotationRowId } : null,
    ...mapped.map((mapping) => ({ section: mapping.quote_section_id, rowId: mapping.quote_row_id }))].filter(Boolean);
  for (const candidate of rows) {
    const match = rowTargets.some((target) => target.rowId === candidate.rowId && (!target.section || target.section === candidate.section));
    const selectedProduct = (candidate.selectedProducts || []).some((selected) => selected.productId === productId || selected.productCode === line.productCode);
    if (match || candidate.productId === productId || selectedProduct) return candidate;
  }
  return null;
}

export function fixtureQuotationReconciliation(workbook = {}, book = workbook.clientSelectionsBook, { confirmedTargets = {}, mappings = [] } = {}) {
  const results = [];
  for (const room of book?.rooms || []) for (const row of room.rows || []) {
    const guided = row.guidedSelection || {};
    const requirementKey = text(guided.requirementKey);
    if (!FIXTURE_REQUIREMENTS.has(requirementKey)) continue;
    const lines = plumbingLinesFromSelection(guided);
    const candidates = serviceQuoteRequirements(workbook, requirementKey);
    for (const line of lines) {
      const productId = productIdOf(line);
      const key = fixtureKey(requirementKey, productId);
      const configuredTarget = confirmedTargets[key] || null;
      const targetId = typeof configuredTarget === "string" ? configuredTarget : configuredTarget?.rowId || "";
      const target = targetId ? candidates.find((candidate) => candidate.rowId === targetId) || null : explicitRowFor(line, requirementKey, candidates, [...(workbook.quoteTargetMappings || []), ...mappings], workbook);
      const selectedTarget = typeof configuredTarget === "object" && configuredTarget ? { section: configuredTarget.section, rowId: targetId } : null;
      const resolvedTarget = target && selectedTarget?.section ? { ...target, section: selectedTarget.section } : target;
      const allocations = (line.allocations || []).map((allocation) => ({ location: allocation.location, quantity: number(allocation.quantity) || 0 }));
      const selectedQuantity = number(line.quantity) || allocations.reduce((total, allocation) => total + allocation.quantity, 0);
      const existingQuantity = resolvedTarget ? number(resolvedTarget.quantity) : null;
      const mappedLocations = new Set((resolvedTarget?.locationSchedule || []).map((item) => text(item.location).toLowerCase()));
      const unmatchedLocations = resolvedTarget && mappedLocations.size
        ? allocations.filter((allocation) => !mappedLocations.has(allocation.location.toLowerCase())).map((allocation) => allocation.location)
        : allocations.map((allocation) => allocation.location);
      results.push({
        key, requirementKey, productId, productName: text(line.productName), model: text(line.supplierCode || line.model),
        selectedQuantity, unit: text(line.unit || "EACH"), allocations, target: resolvedTarget ? { section: resolvedTarget.section, rowId: resolvedTarget.rowId, label: resolvedTarget.label, quantity: existingQuantity } : null,
        difference: null,
        candidates: candidates.map(({ section, rowId, label, quantity, unit }) => ({ section, rowId, label, quantity, unit })),
        unmatchedLocations, action: resolvedTarget ? "TARGET_SELECTED_QUANTITY_REQUIRES_REVIEW" : "SELECT_QUOTATION_TARGET_OR_CONFIRM_ADDITIONAL_ITEM",
      });
    }
  }
  const byTarget = new Map();
  results.forEach((result) => {
    if (!result.target) return;
    const key = `${result.target.section}\u0000${result.target.rowId}`;
    byTarget.set(key, [...(byTarget.get(key) || []), result]);
  });
  for (const [key, entries] of byTarget) {
    const selectedQuantity = entries.reduce((total, entry) => total + entry.selectedQuantity, 0);
    const existingQuantity = entries[0].target.quantity;
    const difference = existingQuantity === null ? null : selectedQuantity - existingQuantity;
    const targetSummary = { section: entries[0].target.section, rowId: entries[0].target.rowId, selectedQuantity, existingQuantity, difference, products: entries.map((entry) => entry.productName) };
    entries.forEach((entry) => {
      entry.targetSummary = targetSummary;
      entry.difference = difference;
      entry.action = difference === 0 && !entry.unmatchedLocations.length ? "MATCHED" : "APPROVE_QUANTITY_OR_SELECT_ANOTHER_TARGET";
    });
  }
  return results;
}

export function bookWithConfirmedFixtureTargets(book = {}, confirmedTargets = {}, mappings = [], workbook = {}) {
  const resolvedTargets = {};
  for (const mapping of [...mappings, ...(workbook.quoteTargetMappings || [])]) {
    if (mapping.status !== "MAPPED" || (mapping.template_id || "") !== (workbook.templateKey || "") || (mapping.workspace_id || workbook.workspaceId) !== workbook.workspaceId) continue;
    const requirementKey = mapping.requirement_key || mapping.metadata?.requirementKey;
    const productId = mapping.product_id || mapping.metadata?.productId;
    if (requirementKey && productId && mapping.quote_row_id) resolvedTargets[fixtureKey(requirementKey, productId)] = { rowId: mapping.quote_row_id, section: mapping.quote_section_id || "" };
  }
  Object.assign(resolvedTargets, confirmedTargets || {});
  if (!book || !Object.keys(resolvedTargets).length) return book;
  return {
    ...book,
    rooms: (book.rooms || []).map((room) => ({
      ...room,
      rows: (room.rows || []).map((row) => {
        const guided = row.guidedSelection;
        const requirementKey = text(guided?.requirementKey);
        if (!FIXTURE_REQUIREMENTS.has(requirementKey) || !Array.isArray(guided.plumbingAllocation?.lines)) return row;
        let changed = false;
        const lines = guided.plumbingAllocation.lines.map((line) => {
          const configuredTarget = resolvedTargets[fixtureKey(requirementKey, productIdOf(line))];
          const rowId = typeof configuredTarget === "string" ? configuredTarget : configuredTarget?.rowId || "";
          if (!rowId || rowId === line.quotationRowId) return line;
          changed = true;
          return { ...line, quotationRowId: rowId, quotationSection: text(configuredTarget?.section || line.quotationSection) };
        });
        return changed ? { ...row, guidedSelection: { ...guided, plumbingAllocation: { ...guided.plumbingAllocation, lines } } } : row;
      }),
    })),
  };
}
