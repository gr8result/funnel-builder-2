// Quantity edits from both Qty and Selection use the same persisted formula contract.
import { wallLiningRowPolicy } from './quotationWallLinings.js';
export function updateQuoteQuantityField(row, key, value) {
  if ((key === 'quantity' || key === 'quantityFormula') && wallLiningRowPolicy(row)?.key) return row;
  const text = String(value ?? '').trim();
  if (key === 'quantityFormula' || (key === 'quantity' && text.startsWith('='))) {
    const formula = text.replace(/^=/, '').trim();
    return {
      ...row, quantity: '', importedQuantity: '', quantityKey: '',
      autoQuantity: false, quantityManualOverride: false, quantityFormulaOverride: true,
      formulas: { ...row.formulas, B: formula || '0' },
    };
  }
  return {
    ...row, [key]: value,
    ...(key === 'quantity' ? { autoQuantity: false, quantityManualOverride: true, quantityFormulaOverride: false } : {}),
  };
}

const LABELS = {
  skirtingLm: 'Skirting Boards LM',
  totalInternal90mmWallsLm: 'total Internal 90mm Walls LM',
  internalDoors: 'Internal Doors',
  cavityDoorQty: 'Cavity Sliding Doors',
  takeoffCavitySliderDoorCount: 'Cavity Sliding Doors',
  takeoffCavityCageCount: 'Cavity Sliding Doors',
  takeoffDoubleDoorSetCount: 'Double Door Sets',
};

export function quoteQuantityExplanation(formula, values, qty) {
  if (!formula) return '';
  // Exact quantity keys can include punctuation (generated takeoff product rows).
  const label = (key) => LABELS[key] || key.replace(/([a-z\d])([A-Z])/g, '$1 $2');
  const source = Object.hasOwn(values, formula)
    ? `${label(formula)} (${values[formula]})`
    : formula.replace(/\b[A-Za-z_][A-Za-z_\d]*\b/g, (key) => Object.hasOwn(values, key) ? `${label(key)} (${values[key]})` : key)
      .replace(/\s*-\s*/g, ' - ').replace(/\s*\+\s*/g, ' + ');
  return `${source} = ${qty}`;
}
