// Read-only audit of an EXTRACTED .gr8job copy: Client Selections -> Quotation mapping, quantities and
// the cabinetry takeoff measurements. Writes only the JSON report; the job files are never modified.
// Run: node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/audit-resume-job-copy.mjs <extracted-dir> <report.json>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { selectionRequirementQuoteTarget, selectionFoundationStatus, requirementsForProduct } from '../lib/builders/selectionRequirementTaxonomy.js';
import { planCabinetryQuotation } from '../lib/construction-estimation/cabinetryRequirements.js';
import { cabinetryRequirementsFromTakeoff } from '../lib/construction-estimation/takeoffCabinetryMeasurements.js';

const [dir, reportPath] = process.argv.slice(2);
if (!dir || !reportPath) throw new Error('Usage: audit-resume-job-copy.mjs <extracted-dir> <report.json>');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const sha = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex').slice(0, 16);
const selections = read('client-selections.json');
const quote = read('quotation.json');
const takeoffFile = read('takeoff.json');
const takeoff = takeoffFile.aiPlanTakeoffJob || takeoffFile.job || takeoffFile;
const workbook = { quotation: quote.quotation, clientSelectionsBook: selections.book, aiPlanTakeoffJob: takeoff };
const rooms = selections.book.rooms;
const rows = rooms.flatMap(room => (room.rows || []).map(row => ({ room: room.name, ...row })));
const guided = rows.filter(row => row.guidedSelection);

const quoteRows = Object.entries(quote.quotation).flatMap(([section, group]) => (group.rows || []).map(row => ({ section, row })));
const byProduct = new Map();
for (const entry of quoteRows) for (const id of [entry.row.productId, entry.row.selectedProductId, entry.row.activeProductId].filter(Boolean)) byProduct.set(id, [...(byProduct.get(id) || []), entry]);

const audit = guided.map(({ room, guidedSelection: g, id }) => {
  const key = g.requirementKey;
  const target = selectionRequirementQuoteTarget(workbook, key);
  const foundation = selectionFoundationStatus({ requirementKey: key, quoteTargetMapping: g.quoteTargetMapping, estimateSection: g.estimateSection });
  const linked = g.productId ? (byProduct.get(g.productId) || []) : [];
  const taxonomy = g.productId ? requirementsForProduct({ requirementType: key, productName: g.productName, category: g.requirementLabel }).map(item => item.requirementKey) : [];
  return { rowId: id, room: g.room || room, requirementKey: key, productId: g.productId || '', product: g.selectedProduct || g.productName || '', quantity: g.quantity ?? null, priceStatus: g.priceStatus || '',
    quoteTarget: target.status, targetSection: target.section || target.target?.section || '', targetRowId: target.target?.rowId || '', candidates: target.candidates || undefined,
    foundation: foundation.quoteMappingStatus, linkedQuoteRows: linked.map(entry => ({ section: entry.section, id: entry.row.id, quantity: entry.row.quantity, source: entry.row.source || '' })), taxonomyKeys: taxonomy };
});
const count = (list, pick) => list.reduce((out, item) => ({ ...out, [pick(item)]: (out[pick(item)] || 0) + 1 }), {});
const plan = planCabinetryQuotation(workbook);
const cabinetryAttention = plan.entries.filter(entry => entry.status !== 'MATCHED TO QUOTE ROW');
const tagged = (takeoff.completedMeasurements || []).filter(item => item.cabinetry);
const report = {
  source: { dir, sha256_16: Object.fromEntries(['client-selections.json', 'quotation.json', 'takeoff.json', 'procurement.json', 'boq.json', 'variations.json'].map(name => [name, sha(name)])) },
  rooms: rooms.length, rows: rows.length, guidedSelections: guided.length,
  mappingStatus: count(audit, item => item.quoteTarget), foundationStatus: count(audit, item => item.foundation),
  noLinkedQuoteRow: audit.filter(item => !item.linkedQuoteRows.length).map(item => `${item.requirementKey} (${item.quoteTarget})`),
  ambiguous: audit.filter(item => item.quoteTarget === 'REVIEW_REQUIRED'),
  templateMappingRequired: audit.filter(item => item.quoteTarget === 'TEMPLATE_MAPPING_REQUIRED').map(item => item.requirementKey),
  audit,
  takeoff: { pixelsPerMm: takeoff.pixelsPerMm ?? null, sheetCalibrations: takeoff.scheduleState?.sheetCalibrations || {}, measurements: (takeoff.completedMeasurements || []).length, taggedCabinetryRuns: tagged.length, derivedRequirements: cabinetryRequirementsFromTakeoff(takeoff) },
  cabinetry: { entries: plan.entries.length, matched: plan.entries.length - cabinetryAttention.length, attention: cabinetryAttention.map(entry => ({ room: entry.room, label: entry.label, type: entry.type, reason: entry.reason })) },
  quotationSections: Object.keys(quote.quotation).length, quotationRows: quoteRows.length,
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ rooms: report.rooms, rows: report.rows, guided: report.guidedSelections, mappingStatus: report.mappingStatus, foundationStatus: report.foundationStatus, noLinkedQuoteRow: report.noLinkedQuoteRow.length, ambiguous: report.ambiguous.length,
  takeoff: { pixelsPerMm: report.takeoff.pixelsPerMm, measurements: report.takeoff.measurements, tagged: report.takeoff.taggedCabinetryRuns }, cabinetry: { entries: report.cabinetry.entries, matched: report.cabinetry.matched, attention: report.cabinetry.attention } }, null, 1));
