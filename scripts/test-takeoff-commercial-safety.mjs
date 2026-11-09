import assert from 'node:assert/strict';
import { createJobSetupPayload, createQuotePreviewRows, createTakeoffSchedule } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { buildProfessionalTakeoffReportHtml } from '../components/construction-estimation/ai-plan-takeoff/takeoffReport.js';
import { roomLabelsFromText } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/localVectorAnalysis.js';

const polygon = [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 }];
const makeSchedule = (confirmed) => createTakeoffSchedule({
  projectInfo: { projectName: 'Commercial safety test' },
  pixelsPerMm: 1,
  completedFloorplans: [{
    id: 'ai-footprint',
    page: 1,
    level: 'Ground Floor',
    type: 'Footprint',
    label: 'AI footprint',
    nodes: polygon,
    source: 'ai',
    confirmed,
    reviewRequired: !confirmed,
  }],
  sheetLevels: { 1: 'Ground Floor' },
});

const unapproved = makeSchedule(false);
unapproved.aiAnalysis = { documentedAreas: [{ id: 'printed-area', page: 1, level: 'Ground Floor', type: 'Living', label: 'LIVING AREA', valueM2: 99, source: 'ai' }] };
const blockedPayload = createJobSetupPayload(unapproved);
assert.equal(blockedPayload.dataInputFields.lowerFloorAreaM2, undefined);
assert.equal(blockedPayload.commercialReady, false);
assert.equal(createQuotePreviewRows(unapproved, [{ id: 'floor', category: 'AI footprint', quantity: 0 }]).some((row) => row.itemId === 'ai-footprint'), false);
assert.match(blockedPayload.warnings.join(' '), /require approval/i);
assert.equal(unapproved.projectTotals.floorAreas.find((row) => row.itemId === 'ai-footprint').commercialStatus, 'Review required');

const approved = makeSchedule(true);
const approvedPayload = createJobSetupPayload(approved);
assert.equal(approvedPayload.dataInputFields.lowerFloorAreaM2, 100);
assert.equal(approvedPayload.commercialReady, true);

const report = buildProfessionalTakeoffReportHtml(unapproved);
assert.match(report, /Commercial Takeoff Report/);
assert.match(report, /AI footprint/);
assert.match(report, /Review required/);
assert.match(report, /Individual wall runs/);
assert.match(report, /Evidence \/ calculation/);

const unresolvedOpening = createTakeoffSchedule({
  projectInfo: { projectName: 'Unresolved opening test' },
  pixelsPerMm: 1,
  aiAnalysis: {
    rooms: [],
    review: [{ code: 'opening-needs-classification', page: 1, message: 'One measured opening needs classification.' }],
  },
});
const unresolvedPayload = createJobSetupPayload(unresolvedOpening);
assert.equal(unresolvedPayload.commercialReady, false);
assert.ok(unresolvedPayload.commercialBlockers.some((item) => item.id === 'analysis:opening-needs-classification'));
assert.match(buildProfessionalTakeoffReportHtml(unresolvedOpening), /Detected openings need classification/);

const labels = ['PWD', 'WC', 'FAMILY', 'FOYER', 'MEDIA', 'PAN', 'WIL', 'W/SHOP', 'linen 2', 'HALL'];
for (const label of labels) {
  const detected = roomLabelsFromText({ textItems: [{ text: label, x: 10, y: 10, width: 20, height: 8 }] });
  assert.equal(detected[0]?.name, label, `${label} should be recognised as a room label`);
}

console.log('Takeoff commercial safety tests passed');
