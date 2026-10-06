import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTakeoffSchedule, createJobSetupPayload, createJobSetupWindowSchedule } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { V4_DATA_SECTIONS } from '../lib/construction-estimation/estimateWorksheetV4Schema.js';
import { applyJobSetupImport } from '../lib/construction-estimation/jobSetupTakeoffImport.js';
import { calculateEstimateBuilderWorkbook, V4_DEFAULT_FORMULAS } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { takeoffProcurementDetails, assignPlasterboardSupplier, refreshTakeoffProcurementItems } from '../lib/construction-estimation/takeoffProcurement.js';
import { quotationSectionsForFinalBoq, quoteQuantity, quoteRate, quoteLineTotal, shouldIncludeQuoteRowInFinalBoq } from '../lib/construction-estimation/finalQuotationBoq.js';

// Use the shipped material and labour lines, including their original units and rates.
const template = JSON.parse(readFileSync('lib/construction-estimation/importedExcelWorkbookTemplate.json', 'utf8'));
function workbook() {
  const rows = Object.fromEntries(V4_DATA_SECTIONS.find((section) => section.key === 'inputDataSheet').rows.map((row) => [row.key, { value: '', notes: '' }]));
  rows.floorCount.value = 'Two storey';
  const quotation = {};
  for (const source of template.quotation.rows.filter((row) => [1093, 1096, 1097, 1099, 1112].includes(row.sourceRow))) {
    const section = quotation[source.section] ||= { rows: [] };
    section.rows.push({ ...source, id: `quote-${source.sourceRow}`, item: source.values[0], quantity: '', unit: source.values[3], excelRate: source.values[5], autoQuantity: true });
  }
  return { data: { inputDataSheet: { rows, customRows: [], hiddenRows: [] } }, formulas: { ...V4_DEFAULT_FORMULAS }, windowsDoors: [], quotation };
}
const wall = (id, exteriorType, page = 1) => ({ id, page, category: 'exterior', lengthMm: 10000, wallHeightM: 2.4, thicknessMm: 90, exteriorType });
const opening = (id, hostWallId, openingClass, widthMm, heightMm, extra = {}) => ({ id, hostWallId, page: 1, openingClass, widthMm, heightMm, ...extra });
const takeoff = {
  totalPages: 2, pixelsPerMm: 1, sheetLevels: { 1: 'Ground Floor', 2: 'Second Level' },
  completedWallRuns: [wall('face', 'Face Brick Veneer'), wall('rendered', 'Rendered Brick Veneer', 2), wall('cladding', 'Lightweight Cladding')],
  placedOpenings: [
    opening('face-window-pair', 'face', 'Window', 1800, 1200, { quantity: 2 }),
    opening('rendered-window', 'rendered', 'Window', 3000, 900, { page: 2 }),
    opening('garage', 'face', 'Garage Door', 4800, 2100, { brickSillRequired: true }),
    opening('cladding-window', 'cladding', 'Window', 1200, 1200),
  ],
};
const schedule = createJobSetupWindowSchedule(takeoff);
const payload = createJobSetupPayload(createTakeoffSchedule(takeoff));
const imported = applyJobSetupImport(workbook(), payload);
const calculated = calculateEstimateBuilderWorkbook(imported);
const sillLm = 6.6;
const sillBricksInThousands = Math.round(sillLm / 0.085 / 1000 * 1000) / 1000;
assert.equal(schedule.totalBrickSillLm, sillLm);
assert.equal(payload.dataInputFields.brickVeneerSillsLm, sillLm);
assert.equal(Number(imported.data.inputDataSheet.rows.brickVeneerSillsLm.value), sillLm);
for (const key of ['brickVeneerSillsLm', 'lockupBrickSillsLm', 'quoteBricklayerSillsLm']) {
  assert.equal(calculated.quantities[key], sillLm, `${key} receives the opening schedule total in LM`);
}
assert.equal(calculated.quantities.quoteBrickSillBricks, sillBricksInThousands, 'Sill material uses the existing brick conversion and per-thousand quote unit');
const boq = quotationSectionsForFinalBoq(calculated.quotation).flatMap((section) => section.rows);
const byId = (rows, id) => rows.find((row) => row.id === id);
assert.equal(byId(boq, 'quote-1112').qty, sillLm);
assert.equal(byId(boq, 'quote-1112').unit, 'LM');
assert.equal(byId(boq, 'quote-1099').qty, sillBricksInThousands);
assert.equal(byId(boq, 'quote-1099').unit, '1000');
assert.equal(boq.filter((row) => row.quantityKey === 'quoteBricklayerSillsLm').length, 1);
assert.equal(boq.filter((row) => row.quantityKey === 'quoteBrickSillBricks').length, 1);

// The same measured geometry with no sill allowance has identical net wall area and wall bricks.
const noSill = structuredClone(imported);
noSill.data.inputDataSheet.rows.brickVeneerSillsLm.value = '0';
noSill.data.inputDataSheet.rows.totalBrickSillLengthLm.value = '999';
const noSillCalculated = calculateEstimateBuilderWorkbook(noSill);
for (const key of ['faceBrickNetM2', 'renderedNetM2', 'brickworkAreaM2', 'windowDoorDeductionsM2', 'faceBrickOrderEach', 'renderedSingleOrderEach', 'renderedTwinOrderEach']) {
  assert.equal(calculated.quantities[key], noSillCalculated.quantities[key], `${key} never adds sill LM to wall M2 or main wall bricks`);
}
assert.equal(noSillCalculated.quantities.brickVeneerSillsLm, 0, 'Canonical measured zero takes precedence over a stale legacy sill alias');
assert.equal(noSillCalculated.quantities.quoteBricklayerSillsLm, 0);
assert.equal(noSillCalculated.quantities.quoteBrickSillBricks, 0);

// Previously imported spreadsheet formulas must not replace the canonical sill total.
const staleFormula = structuredClone(imported);
for (const row of Object.values(staleFormula.quotation).flatMap((section) => section.rows)) {
  if ([1099, 1112].includes(row.sourceRow)) row.formulas = { ...row.formulas, B: '999' };
}
const staleCalculated = calculateEstimateBuilderWorkbook(staleFormula);
assert.equal(staleCalculated.quotation["BRICKLAYER'S LABOUR"].rows[0].qty, sillLm);
assert.equal(byId(staleCalculated.quotation['FACE BRICKWORK'].rows, 'quote-1099').qty, sillBricksInThousands);
const explicitOverride = structuredClone(imported);
Object.assign(explicitOverride.quotation["BRICKLAYER'S LABOUR"].rows[0], { quantity: '7.25', quantityManualOverride: true, autoQuantity: false });
assert.equal(calculateEstimateBuilderWorkbook(explicitOverride).quotation["BRICKLAYER'S LABOUR"].rows[0].qty, 7.25, 'An explicit quote quantity override remains supported');
const manualInput = workbook();
manualInput.data.inputDataSheet.rows.brickVeneerSillsLm = { value: '12.75', notes: 'Agreed manual allowance' };
assert.deepEqual(applyJobSetupImport(manualInput, payload).data.inputDataSheet.rows.brickVeneerSillsLm, manualInput.data.inputDataSheet.rows.brickVeneerSillsLm, 'Normal import review preserves an unselected manual sill value and note');

// Exercise the actual Supplier & Procurement generator, rather than a test-only mapping.
const hook = readFileSync('hooks/estimate-builder/useEstimateBuilderWorkbook.js', 'utf8').replace(/\r\n/g, '\n');
const procurementSource = hook.slice(hook.indexOf('function buildProcurementItemsFromQuote('), hook.indexOf('\nfunction numberFromInput', hook.indexOf('function buildProcurementItemsFromQuote(')));
const buildProcurement = new Function('orderedQuoteSections', 'quoteFirstDisplayNumber', 'quoteRowSourceNumber', 'shouldIncludeQuoteRowInFinalBoq', 'quoteQuantity', 'quoteRate', 'quoteLineTotal', 'takeoffProcurementDetails', 'assignPlasterboardSupplier', `${procurementSource}; return buildProcurementItemsFromQuote;`)(
  (quotation) => Object.keys(quotation), () => '', () => 0, shouldIncludeQuoteRowInFinalBoq, quoteQuantity, quoteRate, quoteLineTotal, takeoffProcurementDetails, assignPlasterboardSupplier,
);
const procurement = buildProcurement(imported, calculated, []);
assert.equal(procurement.find((row) => row.quoteRowId === 'quote-1112').qty, sillLm);
assert.equal(procurement.find((row) => row.quoteRowId === 'quote-1112').unit, 'LM');
assert.equal(procurement.find((row) => row.quoteRowId === 'quote-1099').qty, sillBricksInThousands);
assert.equal(procurement.find((row) => row.quoteRowId === 'quote-1099').unit, '1000');
assert.equal(buildProcurement(imported, calculated, procurement).length, procurement.length, 'Regeneration does not duplicate the sill material or labour line');

// Also exercise the BOQ and procurement records built for the commercial module.
const api = readFileSync('pages/api/builders/sync-commercial-snapshot.js', 'utf8').replace(/\r\n/g, '\n');
const snapshotSource = api.slice(api.indexOf('function buildBoqItemRows('), api.indexOf('\nasync function insertRows(', api.indexOf('function buildBoqItemRows(')));
const snapshot = new Function('quotationSectionsForFinalBoq', 'shouldIncludeQuoteRowInFinalBoq', 'takeoffProcurementDetails', 'refreshTakeoffProcurementItems', 'quoteQuantity', 'quoteRate', 'quoteLineTotal', `
  const firstText = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim()) || '';
  const textOrNull = (value) => value || null;
  const decimalNumber = (value) => Number(value) || 0;
  const moneyNumber = decimalNumber;
  const stripLargeFields = (value) => value;
  const boqItemStatus = () => 'active';
  const normaliseStatus = (value, fallback) => value || fallback;
  const dateOrNull = textOrNull;
  ${snapshotSource}; return { buildBoqItemRows, buildProcurementRows };
`)(quotationSectionsForFinalBoq, shouldIncludeQuoteRowInFinalBoq, takeoffProcurementDetails, refreshTakeoffProcurementItems, quoteQuantity, quoteRate, quoteLineTotal);
const snapshotBoq = snapshot.buildBoqItemRows({ calculated, sectionMap: new Map() });
const snapshotProcurement = snapshot.buildProcurementRows({ workbook: imported, calculated, boqItemMap: new Map() });
for (const rows of [snapshotBoq, snapshotProcurement]) {
  assert.equal(rows.find((row) => row.source_quote_row_id === 'quote-1112').quantity, sillLm);
  assert.equal(rows.find((row) => row.source_quote_row_id === 'quote-1112').unit, 'LM');
  assert.equal(rows.find((row) => row.source_quote_row_id === 'quote-1099').quantity, sillBricksInThousands);
  assert.equal(rows.find((row) => row.source_quote_row_id === 'quote-1099').unit, '1000');
  assert.equal(rows.filter((row) => row.source_quote_row_id === 'quote-1112').length, 1);
  assert.equal(rows.filter((row) => row.source_quote_row_id === 'quote-1099').length, 1);
}
const refreshed = refreshTakeoffProcurementItems(calculated, procurement);
assert.equal(refreshed.length, procurement.length);
assert.ok(refreshTakeoffProcurementItems(noSillCalculated, refreshed).filter((row) => ['quote-1099', 'quote-1112'].includes(row.quoteRowId)).every((row) => row.removedFromQuote), 'Zero sill quantities remove the old allowance from active procurement');
console.log('PASS: opening sill LM flows through Job Setup, quote, BOQ, bricklayer labour and procurement; wall areas/orders and manual overrides remain separate.');
