// Verifies a consolidated isolated test job from its bytes on disk, against the protected recovered job (read only).
//   node --max-old-space-size=8192 --experimental-strip-types --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-consolidated-job-file.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import JSZip from 'jszip';
import { readJob } from '../lib/jobFile.ts';
import { normalizeQuotationStructure } from '../lib/construction-estimation/quotationStructure.js';
import { ensureQuotationSectionIds } from '../lib/construction-estimation/quotationOrder.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';

const root = 'test-artifacts/isolated-jobs';
const dir = fs.readdirSync(root).find((name) => fs.existsSync(`${root}/${name}/isolation-report.json`) && JSON.parse(fs.readFileSync(`${root}/${name}/isolation-report.json`, 'utf8')).newJobName === 'GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST');
if (!dir) { console.log('SKIP no consolidated isolated job present'); process.exit(0); }
const report = JSON.parse(fs.readFileSync(`${root}/${dir}/isolation-report.json`, 'utf8'));
const protectedPath = 'recovery/master-quotation-reconstruction-2026-10-09/job-file/New Job 03 09.gr8job';
const protectedHash = crypto.createHash('sha256').update(fs.readFileSync(protectedPath)).digest('hex');
assert.equal(protectedHash, report.protectedRecoveredJobSha256, 'the protected recovered job is byte-identical');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(report.outFile)).digest('hex'), report.outSha256, 'the test file is the one reported');

const protectedZip = await JSZip.loadAsync(fs.readFileSync(protectedPath));
const protectedDetails = JSON.parse(await protectedZip.file('job-details.json').async('string'));
const protectedEstimate = JSON.parse(await protectedZip.file('estimate.json').async('string')).workbook;
const bytes = fs.readFileSync(report.outFile);
const zip = await JSZip.loadAsync(bytes);
for (const name of Object.keys(zip.files).filter((entry) => entry.endsWith('.json'))) {
  const text = await zip.file(name).async('string');
  for (const value of [protectedDetails.jobId, protectedDetails.jobNumber, protectedDetails.jobName]) assert(!text.includes(value), `${name} holds no protected-job identity (${value})`);
}
const job = await readJob(new File([bytes], 'consolidated.gr8job'));
const workbook = job.workbook;
assert.equal(workbook.jobId, report.newJobId); assert.notEqual(workbook.jobId, protectedDetails.jobId);
assert.equal(Object.keys(workbook.quotation).length, 107);

// Row integrity against the protected job's rows, identity text aside.
const swapped = JSON.parse(JSON.stringify(protectedEstimate.quotation).split(protectedDetails.jobId).join(report.newJobId).split(protectedDetails.jobNumber).join(report.newJobNumber).split(protectedDetails.jobName).join(report.newJobName));
const rowsOf = (q) => Object.entries(q).flatMap(([section, group]) => (group.rows || []).map((row) => ({ section, row })));
const isHeading = (row) => row.lineType === 'Heading' || row.quotationSubgroupHeadingLevel;
const original = rowsOf(swapped), now = rowsOf(workbook.quotation);
const headings = now.filter(({ row }) => isHeading(row));
assert.equal(original.length, 3469); assert.equal(headings.length, 62); assert.equal(now.length, original.length + headings.length, 'every original row plus the new subheadings, nothing else');
assert(headings.every(({ row }) => /^quotation-subheading:/.test(row.id) || row.applianceHeading), 'every added heading is a generated subheading');
const priorHeadings = original.filter(({ row }) => isHeading(row)).length; assert.equal(priorHeadings, 0);
const strip = ({ section, id, legacyRowId, legacySectionName, sortSection, sortSectionId, sortOrder, ...rest }) => rest;
const pool = new Map(); for (const entry of now.filter(({ row }) => !isHeading(row))) pool.set(JSON.stringify(strip(entry.row)), (pool.get(JSON.stringify(strip(entry.row))) || 0) + 1);
const differing = [];
for (const { row } of original) { const key = JSON.stringify(strip(row)); const left = pool.get(key); if (left) pool.set(key, left - 1); else differing.push(row.id); }
// Rows may differ only by an accepted structural change; everything else is byte-identical.
const accepted = new Set(['quote-30075']);
const unexplained = differing.filter((id) => !accepted.has(id) && !/^quote-appliance-package-/.test(id) && !/^tiling:/.test(id));
assert.deepEqual(unexplained, [], 'no priced line, formula, selection or override changed outside the accepted structural migrations');
const byLegacy = new Map(now.map(({ row }) => [row.legacyRowId || row.id, row]));
const ids = original.map(({ row }) => row.id); assert(ids.every((id) => now.some((entry) => entry.row.id === id || entry.row.legacyRowId === id)), 'every original row id is still addressable');
const finalIds = now.map(({ row }) => row.id); const dupFinal = finalIds.filter((id, index) => finalIds.indexOf(id) !== index);

// Stable ids, idempotence and calculations.
const sectionIds = Object.values(workbook.quotation).map((section) => section.sectionId);
assert(sectionIds.every(Boolean) && new Set(sectionIds).size === sectionIds.length, 'every section has one unique stable id');
assert.equal(ensureQuotationSectionIds(workbook.quotation), workbook.quotation, 'section ids are already complete');
assert.deepEqual(Object.keys(normalizeQuotationStructure(JSON.parse(JSON.stringify(workbook.quotation)))).sort(), Object.keys(workbook.quotation).sort(), 'normalising again changes no section');
assert.deepEqual([...workbook.quotationSectionOrder].sort(), Object.keys(workbook.quotation).sort());
const calc = calculateEstimateBuilderWorkbook(workbook), calcProtected = calculateEstimateBuilderWorkbook(protectedEstimate);
const sum = (c) => rowsOf(c.quotation).filter(({ row }) => !isHeading(row) && !row.feeType).reduce((total, { row }) => total + (Number(row.cost) || 0), 0);
const underslab = calc.quotation['UNDERSLAB AND DRAINAGE'].rows[0];
assert.equal(underslab.cost, 0, 'the underslab allocation is not a quotation cost'); assert.equal(underslab.progressAllocationResult.allocatedAmount, 14567.5);
assert(Math.abs((sum(calc) - sum(calcProtected)) + 3800) < 0.01, 'the only cost change against the protected job is the removal of the superseded 3,800 underslab charge');
// Duplicate id correction: both rows survive, the owner keeps the id, and every reference follows its row.
assert.deepEqual([...new Set(dupFinal)], [], 'no row id is shared');
const frameRow = now.find(({ row }) => row.legacyRowId === 'quote-30039');
assert(frameRow && frameRow.row.id === 'quote-74.1' && frameRow.row.item === 'ADD FOR THIRD STOREY WINDOWS' && frameRow.section === 'Frame Stage Labour (5)', 'the third-storey windows row takes its own source-row id');
assert.equal(now.find(({ row }) => row.id === 'quote-30039').row.item, 'INSTALL LINEA BOARD CLADDING', 'the Linea cladding row keeps quote-30039');
const refs = []; const scan = (value) => { if (Array.isArray(value)) value.forEach(scan); else if (value && typeof value === 'object') { if (value.section === 'Frame Stage Labour (5)' && /^quote-(30039|74\.1)$/.test(String(value.id)) && !Array.isArray(value.rows)) refs.push(value.id); Object.values(value).forEach(scan); } };
scan(workbook.aiPlanTakeoffJob); scan(workbook.takeoffEngine); scan(JSON.parse(await zip.file('takeoff.json').async('string')));
assert(refs.length >= 4 && refs.every((id) => id === 'quote-74.1'), 'schedule references to the Frame row follow its new id');
const framing = Object.values(calc.quotation).flatMap((g) => g.rows).find((row) => row.id === 'quote-593.6');
console.log(JSON.stringify({ file: report.outFile, jobId: workbook.jobId, sections: Object.keys(workbook.quotation).length, rowsProtected: original.length, rowsNow: now.length, subheadings: headings.length, accountedDifferences: differing.length, duplicateRowIdsNow: [...new Set(dupFinal)], underslab: underslab.cost, totalCostProtected: sum(calcProtected), totalCostNow: sum(calc), structuralFlooring: [framing.qty, framing.finalRateUsed] }, null, 1));
console.log('Consolidated job file verification passed.');
