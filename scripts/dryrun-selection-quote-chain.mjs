// Dry run of the Client Selections -> Quotation save chain on an EXTRACTED .gr8job copy.
// Nothing is written to the job: the result is compared row by row and reported.
// Run: node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/dryrun-selection-quote-chain.mjs <extracted-dir> <report.json>
import fs from 'node:fs';
import path from 'node:path';
import { applyCabinetryRequirementsToQuotation } from '../lib/construction-estimation/cabinetryRequirements.js';
import { connectAllocatedSelectionsToQuotation } from '../lib/builders/allocatedSelectionQuotation.js';
import { connectEntryDoorFurnitureSchedules } from '../lib/builders/entryDoorFurnitureSelection.js';
import { linkInternalPaintColoursToQuotation } from '../lib/builders/internalPaintColours.js';
import { connectElectricalScheduleToQuotation } from '../lib/builders/electricalSchedule.js';
import { connectFlooringSelectionsToQuotation } from '../lib/builders/flooringSelection.js';
import { connectApplianceSelectionsToQuotation } from '../lib/builders/applianceClientSelectionFlow.js';
import { connectTilingSelectionsToQuotation } from '../lib/builders/tilingRooms.js';
import { preserveQuoteQuantityOwnership } from '../lib/builders/selectionRegistry.js';
import { normalizeQuotationStructure } from '../lib/construction-estimation/quotationStructure.js';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';

const [dir, reportPath] = process.argv.slice(2);
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const selections = read('client-selections.json');
const quote = read('quotation.json');
const takeoffFile = read('takeoff.json');
const owner = process.env.AUDIT_WORKSPACE_ID || '846885cd-25b9-4eca-b9f9-3fd02f5882d8';
const book = selections.book;
const original = { workspaceId: owner, procurement: read('procurement.json').items || { items: [] }, quotation: quote.quotation, clientSelectionsBook: book, selectionsBook: book, aiPlanTakeoffJob: takeoffFile.aiPlanTakeoffJob || takeoffFile.job || takeoffFile, ...(quote.quoteSummary ? { quoteSummary: quote.quoteSummary } : {}), ...(quote.summaryAdjustments ? { summaryAdjustments: quote.summaryAdjustments } : {}) };
const before = JSON.stringify(original.quotation);
let products = new Map();
try { products = new Map((await getMasterProducts()).map(product => [product.id || product.productId, product])); } catch { /* connectors fall back to stored selection snapshots */ }
const productById = id => products.get(id) || null;

const steps = [];
let book2 = JSON.parse(JSON.stringify(original));
const step = (name, run) => { const prior = JSON.stringify(book2.quotation); book2 = run(book2); steps.push({ step: name, changed: JSON.stringify(book2.quotation) !== prior }); };
step('cabinetry', wb => applyCabinetryRequirementsToQuotation(preserveQuoteQuantityOwnership(wb, wb), owner));
step('internal paint', wb => linkInternalPaintColoursToQuotation(wb, book));
step('electrical', wb => connectElectricalScheduleToQuotation(wb, book));
step('tiling', wb => connectTilingSelectionsToQuotation(wb, book, { productById }));
step('flooring', wb => connectFlooringSelectionsToQuotation(wb, book, { productById }));
step('appliances', wb => connectApplianceSelectionsToQuotation(wb, book));
step('entry door furniture', wb => connectEntryDoorFurnitureSchedules(wb, book));
step('allocated products', wb => connectAllocatedSelectionsToQuotation(wb, book));
const after = normalizeQuotationStructure(book2.quotation);

const index = quotation => new Map(Object.entries(quotation).flatMap(([section, group]) => (group.rows || []).map(row => [`${section}\u0000${row.id ?? row.importKey ?? row.item}`, row])));
const was = index(normalizeQuotationStructure(JSON.parse(before))), now = index(after);
const added = [...now].filter(([key]) => !was.has(key)).map(([key, row]) => ({ section: key.split('\u0000')[0], id: row.id, item: row.item, qty: row.quantity ?? row.qty, rate: row.manualRate || row.excelRate, source: row.source || '' }));
const removed = [...was].filter(([key]) => !now.has(key)).map(([key, row]) => ({ section: key.split('\u0000')[0], id: row.id, item: row.item, qty: row.quantity ?? row.qty }));
const protectedFields = ['manualRate', 'excelRate', 'margin', 'markup', 'allowance', 'baselineUnitPrice', 'notes'];
const changed = [...now].filter(([key, row]) => was.has(key) && JSON.stringify(was.get(key)) !== JSON.stringify(row)).map(([key, row]) => {
  const old = was.get(key);
  const fields = [...new Set([...Object.keys(old), ...Object.keys(row)])].filter(field => JSON.stringify(old[field]) !== JSON.stringify(row[field]));
  return { section: key.split('\u0000')[0], id: row.id, item: row.item, fields, quantity: [old.quantity ?? old.qty, row.quantity ?? row.qty], protectedChanged: fields.filter(field => protectedFields.includes(field)) };
});
const duplicateIds = [...new Map([...now.keys()].map(key => [key, 1])).keys()].length !== now.size;
const dupItems = {};
for (const [key, row] of now) if (/CLIENT SELECTIONS$/.test(key.split('\u0000')[0])) { const k = `${key.split('\u0000')[0]}|${row.productId}|${(row.locations || '')}`; dupItems[k] = (dupItems[k] || 0) + 1; }
const report = { steps, before: { sections: Object.keys(JSON.parse(before)).length, rows: was.size }, after: { sections: Object.keys(after).length, rows: now.size }, added, removed, changedCount: changed.length, changed: changed.slice(0, 200),
  protectedFieldChanges: changed.filter(item => item.protectedChanged.length), duplicateClientSelectionLines: Object.entries(dupItems).filter(([, count]) => count > 1), idCollision: duplicateIds };
// Which saved product selections are visible on any quotation row after the chain: by product id / code only.
const guided = book.rooms.flatMap(room => (room.rows || []).filter(row => row.guidedSelection).map(row => row.guidedSelection));
const haystack = [...now].map(([key, row]) => ({ section: key.split('\u0000')[0], id: row.id, text: JSON.stringify(row) }));
const reflected = guided.map(g => {
  const needles = [g.productId, g.productCode].filter(Boolean);
  const hits = needles.length ? haystack.filter(row => needles.some(needle => row.text.includes(needle))) : [];
  return { requirementKey: g.requirementKey, product: g.selectedProduct || g.productName || '', hasProduct: needles.length > 0, rows: hits.map(hit => `${hit.section}:${hit.id}`).slice(0, 4), rowCount: hits.length };
});
report.selectionReflected = reflected;
// Procurement and variation parity for every row a connector owns.
const procurementItems = book2.procurement?.items || [];
const owned = [...now].filter(([, row]) => /^client-selections-/.test(row.source || ''));
const parity = owned.map(([key, row]) => {
  const item = procurementItems.find(candidate => candidate.id === row.id);
  const rowQty = Number(row.quantity ?? row.qty), itemQty = item ? Number(item.qty ?? item.quantity) : null;
  const variation = row.variation ?? null;
  const expectedVariation = Number.isFinite(Number(row.allowancePerUnit)) && row.activeUnitPrice != null ? null : variation;
  return { section: key.split('\u0000')[0], id: row.id, source: row.source, quoteQty: rowQty, procurementQty: itemQty, procurementFound: Boolean(item), quantityAgrees: item ? rowQty === itemQty : null, variation: expectedVariation };
});
report.parity = { ownedRows: parity.length, withProcurement: parity.filter(item => item.procurementFound).length, quantityDisagreements: parity.filter(item => item.procurementFound && !item.quantityAgrees), noProcurement: [...new Set(parity.filter(item => !item.procurementFound).map(item => item.source))] };
report.procurement = { before: (original.procurement.items || []).length, after: procurementItems.length };
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ steps, before: report.before, after: report.after, added: added.length, removed: removed.length, changed: changed.length, protectedFieldChanges: report.protectedFieldChanges.length, duplicates: report.duplicateClientSelectionLines.length }, null, 1));
console.log('ADDED', JSON.stringify(added.slice(0, 40), null, 0));

