// A standard inclusion or allowance that a Client Selection replaces. The original quotation row keeps
// its quantity, rate and overrides; it is only marked and made inactive, so it drops out of totals,
// BOQ and procurement (they already skip inactive rows) and is restored when the selection goes.

export const SELECTION_REPLACED_STATUS = "Replaced by Client Selection";

export const isReplacedBySelection = (row) => row?.selectionReplacement?.status === SELECTION_REPLACED_STATUS;

const money = (value) => (Number.isFinite(value) ? Math.round(value * 100) / 100 : null);
const numeric = (value) => { const number = Number(String(value ?? "").replace(/[^0-9.-]/g, "")); return String(value ?? "").trim() !== "" && Number.isFinite(number) ? number : null; };

// Returns the quotation with every row replaced by `source` back as the estimator left it.
export function restoreReplacedRows(quotation = {}, source = "") {
  return Object.fromEntries(Object.entries(quotation).map(([name, section]) => [name, {
    ...section,
    rows: (section.rows || []).map((row) => {
      if (!isReplacedBySelection(row) || (source && row.selectionReplacement.source !== source)) return row;
      const { selectionReplacement, ...rest } = row;
      if (selectionReplacement.original.hadActive) rest.active = selectionReplacement.original.active; else delete rest.active;
      return rest;
    }),
  }]));
}

// Marks the rows with these ids as replaced by `replacement` ({ rowId, label, section, cost }).
export function markRowsReplaced(quotation = {}, rowIds = [], { source, replacement }) {
  const ids = new Set(rowIds);
  return Object.fromEntries(Object.entries(quotation).map(([name, section]) => [name, {
    ...section,
    rows: (section.rows || []).map((row) => {
      if (!ids.has(row.id) || isReplacedBySelection(row)) return row;
      const quantity = numeric(row.quantity ?? row.qty);
      const rate = numeric(row.manualRate || row.excelRate);
      return {
        ...row,
        active: false,
        selectionReplacement: {
          status: SELECTION_REPLACED_STATUS,
          source,
          replacementRowId: replacement.rowId,
          replacementLabel: replacement.label,
          replacementSection: replacement.section,
          allowanceQuantity: quantity,
          allowanceRate: rate,
          allowanceCost: quantity !== null && rate !== null ? money(quantity * rate) : null,
          replacementCost: replacement.cost ?? null,
          original: { hadActive: Object.prototype.hasOwnProperty.call(row, "active"), active: row.active },
        },
      };
    }),
  }]));
}

// What the selected row records about the allowances it replaced (shown beside it in the quotation).
export function replacedRowSummary(quotation = {}, rowIds = []) {
  const ids = new Set(rowIds);
  return Object.entries(quotation).flatMap(([section, { rows = [] }]) => rows.filter((row) => ids.has(row.id))
    .map((row) => ({ rowId: row.id, section, item: row.item, quantity: numeric(row.quantity ?? row.qty), rate: numeric(row.manualRate || row.excelRate) })));
}
