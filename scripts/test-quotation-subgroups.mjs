// Collapsible quotation subgroups: display only, summaries from active rows, sensible defaults.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-quotation-subgroups.mjs
import assert from 'node:assert/strict';
import { FINAL_CABINETRY as source, reconcileCabinetryQuotation } from '../lib/construction-estimation/finalCabinetryQuotation.js';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { applyCabinetryRequirementsToQuotation as apply, cabinetryQuoteGroupStatus, cabinetryScheduleCatalogue } from '../lib/construction-estimation/cabinetryRequirements.js';
import { buildCabinetrySelectionPayload, defaultCabinetryDraft } from '../lib/builders/cabinetryWorkflow.js';
import { buildQuotationSubgroups, visibleSubgroupRows, isSubgroupOpen, subgroupSignature } from '../lib/construction-estimation/quotationSubgroups.js';

const owner = source.workspaceId;
const options = { headingLevel: row => row.cabinetryRowType === 'heading' ? row.cabinetryHeadingLevel : 0, isSpacer: row => row.cabinetryRowType === 'spacer' };
const item = (room, label) => cabinetryScheduleCatalogue(room).flatMap(group => group.items).find(entry => entry.label === label).id;
const bookFor = (rooms, lines) => {
  const selection = defaultCabinetryDraft({ locations: rooms, schedule: lines.map(([room, label, quantity], index) => ({ componentId: `L${index}`, location: room, cabinetTypeId: item(room, label), unitType: label, quantity })) });
  const details = buildCabinetrySelectionPayload({ workspaceId: owner, projectId: 'p', selection, requirement: { requirementKey: 'cabinetry', label: 'Cabinetry', areaKey: 'cabinetry' } }).selected_details;
  return { rooms: [{ id: 'kitchen', name: 'Kitchen', rows: [{ id: 'cabinetry', guidedRequirementKey: 'cabinetry', guidedSelection: { ...details, requirementKey: 'cabinetry' } }] }] };
};
const base = reconcileCabinetryQuotation({ ...createEstimateBuilderWorkbookDefaults({}, { workspaceId: owner }), workspaceId: owner }, owner);
const jobWith = (rooms, lines) => apply({ ...base, clientSelectionsBook: bookFor(rooms, lines) }, owner);
const LINES = [['Kitchen', '2 door base unit - 1200mm', 1], ['Kitchen', 'Corner base cabinet', 2], ['Kitchen', 'Sink base cabinet', 1], ['Laundry', 'Laundry sink cabinet', 1]];
const room = (name, extra = {}) => ({ location: name, name, ...extra });
const premium = { doorMaterialGroup: 'Premium laminate', doorAndPanelSelections: { material: 'Premium laminate' } };

const job = jobWith([room('Kitchen', premium), room('Laundry')], LINES);
const preview = calculateEstimateBuilderWorkbook(job);
const rows = preview.quotation.CABINETRY.rows;
const model = buildQuotationSubgroups(rows, options);
const status = cabinetryQuoteGroupStatus(job);
const byLabel = (label, parentLabel) => model.list.find(group => group.label === label && (!parentLabel || model.groups.get(group.parentKey)?.label === parentLabel));
const open = overrides => group => isSubgroupOpen(group, model, status, overrides);
const visible = overrides => visibleSubgroupRows(rows, model, open(overrides));

// Structure comes from the heading rows, not from row ids.
assert.equal(model.list.filter(group => group.level === 1).length, rows.filter(row => options.headingLevel(row) === 1).length);
assert.equal(model.list.filter(group => group.level === 2).length, rows.filter(row => options.headingLevel(row) === 2).length);
for (const label of ['KITCHEN CABINETRY', "BUTLER'S PANTRY CABINETRY", 'LAUNDRY CABINETRY', 'BATHROOM / ENSUITE / POWDER ROOM CABINETRY', 'WARDROBES', 'KITCHEN BENCHTOPS']) assert(byLabel(label), label);
for (const label of ['STANDARD COLOURBOARD', 'PREMIUM LAMINATE', '2 PACK', 'SHAKER STYLE', 'VINYL WRAP']) assert(byLabel(label, 'KITCHEN CABINETRY'), label);
for (const label of ['STANDARD LAMINATE', 'MID RANGE STONE - 20MM', 'PORCELAIN / SINTERED STONE', 'BENCHTOP EXTRAS']) assert(byLabel(label, 'KITCHEN BENCHTOPS'), label);

// Summaries count rows in the quote (Qty > 0), not catalogue options, and total their Cost.
const price = (catalogueRoom, range, label) => source.rows.find(row => row.room === catalogueRoom && row.range === range && row.description === label).price;
const kitchenTotal = price('KITCHEN CABINETRY', 'PREMIUM LAMINATE', '2 door base unit - 1200mm') + 2 * price('KITCHEN CABINETRY', 'PREMIUM LAMINATE', 'Corner base cabinet') + price('KITCHEN CABINETRY', 'PREMIUM LAMINATE', 'Sink base cabinet');
assert.deepEqual([byLabel('KITCHEN CABINETRY').items, byLabel('KITCHEN CABINETRY').total, byLabel('KITCHEN CABINETRY').activeGroups], [3, kitchenTotal, ['PREMIUM LAMINATE']]);
assert.deepEqual([byLabel('PREMIUM LAMINATE', 'KITCHEN CABINETRY').items, byLabel('PREMIUM LAMINATE', 'KITCHEN CABINETRY').total], [3, kitchenTotal]);
assert.deepEqual([byLabel('STANDARD COLOURBOARD', 'KITCHEN CABINETRY').items, byLabel('STANDARD COLOURBOARD', 'KITCHEN CABINETRY').total], [0, 0]);
assert.equal(model.list.filter(group => group.level === 1).reduce((sum, group) => sum + group.total, 0), preview.quotation.CABINETRY.subtotal ?? rows.reduce((sum, row) => sum + (Number(row.cost) || 0), 0));

// Defaults: selected finish open, alternatives closed; in-progress rooms open; untouched areas closed.
assert.deepEqual(status['KITCHEN CABINETRY'], { confirmed: false, selected: ['PREMIUM LAMINATE'] });
const isOpen = open({});
assert.equal(isOpen(byLabel('KITCHEN CABINETRY')), true);
assert.equal(isOpen(byLabel('PREMIUM LAMINATE', 'KITCHEN CABINETRY')), true);
for (const label of ['STANDARD COLOURBOARD', '2 PACK', 'SHAKER STYLE', 'VINYL WRAP']) assert.equal(isOpen(byLabel(label, 'KITCHEN CABINETRY')), false, label);
assert.equal(isOpen(byLabel('LAUNDRY CABINETRY')), true); assert.equal(isOpen(byLabel('STANDARD COLOURBOARD', 'LAUNDRY CABINETRY')), true);
for (const label of ["BUTLER'S PANTRY CABINETRY", 'BATHROOM / ENSUITE / POWDER ROOM CABINETRY', 'WARDROBES', "BUTLER'S PANTRY BENCHTOPS"]) assert.equal(isOpen(byLabel(label)), false, label);
const shown = visible({});
assert(shown.length < rows.length / 4, `the default view is far shorter (${shown.length} of ${rows.length} rows)`);
assert(rows.filter(row => Number(row.qty) > 0).every(row => shown.includes(row)), 'every row in the quote is visible by default');

// Collapsing one finish hides only that finish's rows; reopening returns the identical rows.
const kitchen = byLabel('KITCHEN CABINETRY'), premiumGroup = byLabel('PREMIUM LAMINATE', 'KITCHEN CABINETRY');
const override = (group, value) => ({ [group.key]: { open: value, signature: subgroupSignature(group, model, status) } });
const withoutPremium = visible(override(premiumGroup, false));
const hidden = shown.filter(row => !withoutPremium.includes(row));
assert(hidden.length > 0 && hidden.every(row => model.placement.get(row.id).group === premiumGroup.key));
assert(withoutPremium.includes(rows.find(row => row.id === premiumGroup.key)), 'the collapsed heading itself stays');
assert.deepEqual(visible(override(premiumGroup, true)), shown);
// Collapsing the room hides every finish under it, up to the next room heading, and nothing else.
const withoutKitchen = visible(override(kitchen, false));
assert(shown.filter(row => !withoutKitchen.includes(row)).every(row => model.placement.get(row.id).area === kitchen.key));
assert(withoutKitchen.includes(rows.find(row => row.id === kitchen.key)));
assert(!withoutKitchen.some(row => model.placement.get(row.id).area === kitchen.key && !model.placement.get(row.id).heading));
assert(withoutKitchen.some(row => row.room === 'LAUNDRY CABINETRY' && Number(row.qty) > 0));
// Expand all / collapse all.
const all = value => Object.fromEntries(model.list.map(group => [group.key, { open: value, signature: subgroupSignature(group, model, status) }]));
assert.equal(visible(all(true)).length, rows.length);
assert.deepEqual(visible(all(false)).map(row => row.id), rows.filter(row => options.headingLevel(row) === 1 || !model.placement.get(row.id).area).map(row => row.id));

// Display only: the rows, the calculation and the job are never touched.
const snapshot = JSON.stringify(job.quotation);
for (const state of [{}, all(true), all(false), override(kitchen, false)]) visible(state);
assert.equal(JSON.stringify(job.quotation), snapshot);
assert.equal(calculateEstimateBuilderWorkbook(job).summary.finalQuoteTotal, preview.summary.finalQuoteTotal);

// Confirming the Kitchen collapses it automatically, even if the user had opened it before; the
// user can open it again and that choice then stands.
const confirmedJob = jobWith([room('Kitchen', { ...premium, confirmedAt: '2026-10-05T00:00:00.000Z', status: 'complete' }), room('Laundry')], LINES);
const confirmedStatus = cabinetryQuoteGroupStatus(confirmedJob);
assert.deepEqual(confirmedStatus['KITCHEN CABINETRY'], { confirmed: true, selected: ['PREMIUM LAMINATE'] });
assert.equal(confirmedStatus['LAUNDRY CABINETRY'].confirmed, false);
const userOpened = override(kitchen, true);
assert.equal(isSubgroupOpen(kitchen, model, confirmedStatus, userOpened), false, 'an earlier choice does not keep a newly confirmed room open');
assert.equal(isSubgroupOpen(kitchen, model, confirmedStatus, { [kitchen.key]: { open: true, signature: subgroupSignature(kitchen, model, confirmedStatus) } }), true, 'reopening a confirmed room works');
assert.equal(isSubgroupOpen(byLabel('LAUNDRY CABINETRY'), model, confirmedStatus, {}), true);
assert.deepEqual(rowsQuantities(confirmedJob), rowsQuantities(job), 'confirming changes no quantity');
// Changing the selected finish re-applies the defaults for that room: new finish open, the rest closed.
const packJob = jobWith([room('Kitchen', { doorMaterialGroup: 'Two-pack painted' }), room('Laundry')], LINES);
const packRows = calculateEstimateBuilderWorkbook(packJob).quotation.CABINETRY.rows, packModel = buildQuotationSubgroups(packRows, options), packStatus = cabinetryQuoteGroupStatus(packJob);
const packGroup = label => packModel.list.find(group => group.label === label && packModel.groups.get(group.parentKey)?.label === 'KITCHEN CABINETRY');
assert.equal(isSubgroupOpen(packGroup('2 PACK'), packModel, packStatus, override(premiumGroup, true)), true);
assert.equal(isSubgroupOpen(packGroup('PREMIUM LAMINATE'), packModel, packStatus, override(premiumGroup, true)), false);

function rowsQuantities(book) { return book.quotation.CABINETRY.rows.filter(row => row.importKey).map(row => [row.importKey.replace(/kitchen-panel.*/, 'panel'), row.quantity === '' ? '' : Number(row.quantity)]).filter(([, quantity]) => quantity !== ''); }
console.log(`PASS: room and finish groups from heading rows, active-row summaries, defaults (${shown.length} of ${rows.length} rows shown), collapse/expand, auto-collapse on confirm, finish change, display-only.`);
