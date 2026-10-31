import assert from 'node:assert/strict';
import { connectEntryDoorFurnitureSchedules } from '../lib/builders/entryDoorFurnitureSelection.js';
import { normalizeQuotationStructure } from '../lib/construction-estimation/quotationStructure.js';

const door = { id: 'door-1', doorReference: 'ED1', location: 'Entry', level: 'Ground', quantity: 1, source: 'manual' };
const product = {
  id: 'handle-1', productCode: 'HANDLE-1', brand: 'Lockwood', supplier: 'Lockwood',
  productName: 'Entrance Lever Set', model: 'MODEL-1', manufacturerSku: 'MODEL-1', selectedCost: null,
  finishOptions: ['Satin Chrome'],
};
const book = {
  rooms: [{ id: 'exterior', name: 'Exterior', rows: [{ id: 'entry-door-selection', guidedSelection: {
    requirementKey: 'entry-door',
    entryDoors: [{ door, entryDoorFurniture: product, furnitureFinish: 'Satin Chrome', hardwareOptions: { finish: 'Satin Chrome' } }],
  } }] }],
};
const oldId = 'entry-door-furniture:door-1';
const source = {
  quotation: {
    'ENTRY DOORS': { collapsed: true, rows: [{ id: 'entry-door', section: 'ENTRY DOORS', item: 'Entry door', quantity: 1 }] },
    'ENTRY DOOR FURNITURE - CLIENT SELECTIONS': { collapsed: true, rows: [{
      id: oldId, source: 'client-selections-entry-door-furniture', productCode: product.productCode,
      item: 'Old entry furniture row', quantity: 1, manualRate: '',
    }] },
  },
  procurement: { items: [{ id: oldId, source: 'client-selections-entry-door-furniture', productCode: product.productCode }] },
};
const normalized = normalizeQuotationStructure(source.quotation);
const connected = connectEntryDoorFurnitureSchedules({ ...source, quotation: normalized }, book);
const canonical = normalizeQuotationStructure(connected.quotation);
const rows = canonical['ENTRY DOORS'].rows.filter(row => row.source === 'client-selections-entry-door-furniture');
assert.equal(rows.length, 1);
assert.equal(rows[0].id, oldId);
assert.equal(rows[0].quoteRequired, true);
assert.equal(rows[0].lineType, 'Quote required');
assert.equal(rows[0].priceStatus, 'Rate required');
assert.equal(Object.hasOwn(canonical, 'ENTRY DOOR FURNITURE - CLIENT SELECTIONS'), false);
assert.equal(connected.procurement.items.filter(item => item.source === 'client-selections-entry-door-furniture').length, 1);

const manual = {
  ...connected,
  quotation: { ...connected.quotation, 'ENTRY DOORS': { ...connected.quotation['ENTRY DOORS'], rows: connected.quotation['ENTRY DOORS'].rows.map(row => row.id === oldId ? { ...row, quantity: 2, quantityManualOverride: true, manualRate: '$125.00' } : row) } },
};
const refreshed = connectEntryDoorFurnitureSchedules(manual, book);
const manualRow = refreshed.quotation['ENTRY DOORS'].rows.find(row => row.id === oldId);
assert.equal(manualRow.manualRate, '$125.00');
assert.equal(manualRow.quantity, 2);
assert.equal(manualRow.quantityManualOverride, true);
assert.equal(manualRow.quoteRequired, false);
assert.equal(refreshed.quotation['ENTRY DOORS'].rows.filter(row => row.source === 'client-selections-entry-door-furniture').length, 1);

console.log('Entry-door furniture quote sync: canonical section, no duplicates, pending-price warning, and manual rate passed.');