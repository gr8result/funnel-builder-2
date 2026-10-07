// Lighting & Ceiling Fans: product selections that replace the material on an existing quotation
// line. Electrical points are not here - they are a quantity schedule (electricalSchedule.js).
export const RESIDENTIAL_SERVICE_KEYS = ['interior-lighting', 'ceiling-fan'];
const patterns = {
  'interior-lighting': /downlight|pendant|light fitting|wall light|ceiling light|led strip|step light/i,
  'ceiling-fan': /ceiling fan/i,
};

export function serviceQuoteRequirements(workbook = {}, key) {
  if (!patterns[key]) return [];
  return Object.entries(workbook.quotation || {}).flatMap(([section, group]) => {
    if (!/electrical|lighting|ceiling fan/i.test(section) || /CLIENT SELECTIONS/i.test(section)) return [];
    return (group.rows || []).filter(row => row.source !== 'client-selections-allocated-product' && (row.requirementKey === key || patterns[key].test(row.item || row.description || '')))
      .map(row => ({ section, rowId: row.id, label: row.item || row.description, quantity: Number(row.qty ?? row.quantity) || 0,
        unit: row.unit || 'EACH', location: row.location || row.level || '',
        materialAllowance: row.serviceSelectionOriginal?.materialAllowance ?? row.materialRate ?? row.materialAllowancePerUnit ?? null }));
  });
}

export function serviceProjectRequirement(workbook, key) {
  const rows = serviceQuoteRequirements(workbook, key).filter(r => r.quantity > 0);
  if (!rows.length) return null;
  return { quantity: rows.reduce((n,r) => n + r.quantity, 0), label: rows.map(r => r.label).join(', '), source: 'Project quotation / electrical schedule', rows };
}

export function linkServiceQuotationEntries(entries, workbook) {
  return entries.map(entry => {
    if (!RESIDENTIAL_SERVICE_KEYS.includes(entry.requirementKey)) return entry;
    const candidates = serviceQuoteRequirements(workbook, entry.requirementKey);
    const target = candidates.find(r => r.rowId === entry.line.quotationRowId && r.section === entry.line.quotationSection)
      || (candidates.length === 1 ? candidates[0] : null);
    return { ...entry, serviceSelection: true, target, sectionName: target?.section || entry.sectionName };
  });
}

export function updateServiceQuotationRows(quotation, entries) {
  const groups = new Map();
  entries.filter(e => e.serviceSelection && e.target).forEach(e => {
    const key = `${e.target.section}:${e.target.rowId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });
  for (const [section, group] of Object.entries(quotation)) quotation[section] = { ...group, rows: (group.rows || []).map(row => {
    const chosen = groups.get(`${section}:${row.id}`);
    if (!chosen?.length) {
      if (!row.serviceSelectionOriginal) return row;
      const { serviceSelectionOriginal: old, selectedProducts, selectedMaterialValue, selectedMaterialRate, materialVariation, serviceSelectionStatus, ...rest } = row;
      return { ...rest, excelRate: old.excelRate, manualRate: old.manualRate, materialRate: old.materialRate, finalRateUsed: old.finalRateUsed, cost: old.cost, description: old.description };
    }
    const original = { ...(row.serviceSelectionOriginal || { excelRate: row.excelRate, manualRate: row.manualRate, materialRate: row.materialRate, finalRateUsed: row.finalRateUsed, cost: row.cost, description: row.description,
      materialAllowance: row.materialRate ?? row.materialAllowancePerUnit ?? chosen[0].line.originalMaterialAllowance ?? null }) };
    if (original.materialAllowance == null && chosen[0].line.originalMaterialAllowance != null) original.materialAllowance = chosen[0].line.originalMaterialAllowance;
    const quantity = chosen.reduce((n,e) => n + e.line.quantity, 0);
    const priced = chosen.every(e => e.rate != null);
    const value = priced ? chosen.reduce((n,e) => n + e.rate * e.line.quantity, 0) : null;
    const quoteQuantity = Number(row.qty ?? row.quantity) || 0;
    const combinedRaw = original.manualRate !== '' && original.manualRate != null ? original.manualRate : original.excelRate;
    const originalCombined = combinedRaw === '' || combinedRaw == null ? NaN : Number(combinedRaw);
    const canPrice = priced && Number.isFinite(originalCombined) && original.materialAllowance != null && original.materialAllowance !== '' && quantity === quoteQuantity && quantity > 0;
    const rate = canPrice ? value / quantity : null;
    return { ...row, serviceSelectionOriginal: original,
      description: [original.description, ...chosen.map(e => `${e.line.quantity} x ${e.line.productName} (${e.line.productCode}) — ${e.locations}`)].filter(Boolean).join('; '),
      selectedProducts: chosen.map(e => ({ ...e.line, requirementKey: e.requirementKey, materialRateExGst: e.rate })),
      selectedMaterialValue: value, selectedMaterialRate: rate,
      materialVariation: canPrice ? value - Number(original.materialAllowance) * quantity : null,
      serviceSelectionStatus: canPrice ? 'Priced' : !priced ? 'Supplier price required' : !Number.isFinite(originalCombined) ? 'Original installation rate required' : original.materialAllowance == null || original.materialAllowance === '' ? 'Original material allowance required' : 'Allocate the full project quantity',
      ...(canPrice && Number.isFinite(originalCombined) ? { manualRate: Math.round((originalCombined - Number(original.materialAllowance) + rate) * 10000) / 10000, finalRateUsed: Math.round((originalCombined - Number(original.materialAllowance) + rate) * 10000) / 10000, cost: '', materialRate: rate } : { manualRate: original.manualRate, finalRateUsed: original.finalRateUsed, cost: original.cost, materialRate: original.materialRate }) };
  }) };
  return quotation;
}
