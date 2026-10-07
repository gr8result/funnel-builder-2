// Runs the real AI Takeoff pipeline against a saved takeoff's own plan set, outside the browser,
// and prints the before/after report. It uses the same modules the app uses (page preparation,
// server request validation and provider call, analysis contract, canonical adapter, schedule and
// Job Setup payload); only the React state and the authenticated route are replaced.
//
//   node scripts/run-ai-takeoff-plan-set.mjs --job <decoded-takeoff.json> --assets <dir> --out <dir> [--replay]
//
// --job     JSON holding { job: <ai-plan-takeoff job>, inputRows: <Job Setup rows> }
// --assets  directory of the plan page images saved as data-URL text files (matched by byte size)
// --out     directory for the provider responses and the report; --replay reuses saved responses
//           instead of calling the provider again (no cost).
// Calling the provider spends OpenAI credit: about ten requests for a two-storey plan set.
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => (arg.startsWith('--') ? [arg.slice(2), all[index + 1]?.startsWith('--') || all[index + 1] === undefined ? true : all[index + 1]] : null)).filter(Boolean));
if (!args.job || !args.assets || !args.out) { console.error('Usage: --job <json> --assets <dir> --out <dir> [--replay]'); process.exit(2); }
fs.mkdirSync(args.out, { recursive: true });

// The browser APIs page preparation needs, backed by node-canvas.
if (!globalThis.crypto) globalThis.crypto = webcrypto;
globalThis.Image = class {
  set src(value) { this.source = value; }
  get src() { return this.source; }
  async decode() { this.bitmap = await loadImage(Buffer.from(this.source.slice(this.source.indexOf(',') + 1), 'base64')); }
  get naturalWidth() { return this.bitmap.width; }
  get naturalHeight() { return this.bitmap.height; }
};
globalThis.document = { createElement: () => {
  const canvas = createCanvas(1, 1);
  const getContext = canvas.getContext.bind(canvas);
  canvas.getContext = (type) => {
    const context = getContext(type);
    const drawImage = context.drawImage.bind(context);
    context.drawImage = (image, ...rest) => drawImage(image?.bitmap || image, ...rest);
    return context;
  };
  return canvas;
} };

const T = '../components/construction-estimation/ai-plan-takeoff/';
const { prepareAnalysisPage, prepareGeometryReviewImage, restoreAnalysisCoordinates } = await import(`${T}ai-integration/analysisPages.js`);
const { fingerprintTakeoffDocument, fingerprintTakeoffPage } = await import(`${T}ai-integration/documentIdentity.js`);
const { normalizePlanAnalysis, resolveAnalysisScale } = await import(`${T}ai-integration/analysisContract.js`);
const { convertAiTakeoffDetections } = await import(`${T}ai-integration/adapter.js`);
const { MEASUREMENT_SCOPES, mergeMeasurementScopes } = await import(`${T}ai-integration/measurementScopes.js`);
const { compactPlanEvidence, evidenceRotation, mergePlanEvidence, projectDefaultsFromJobSetup } = await import(`${T}ai-integration/planEvidence.js`);
const { reviewAudience } = await import(`${T}ai-integration/reviewSummary.js`);
const { createTakeoffSchedule, createJobSetupPayload } = await import(`${T}takeoffSchedule.js`);
const { analyseTakeoffPage, validateTakeoffAnalysisRequest, DEFAULT_TAKEOFF_MODEL } = await import('../lib/construction-estimation/aiTakeoffAnalysis.js');

const RUN_ID = 'ai-takeoff-v1';
const saved = JSON.parse(fs.readFileSync(args.job, 'utf8'));
const job = saved.job;
const jobSetupRows = saved.inputRows || {};
const assetFiles = fs.readdirSync(args.assets).map((name) => ({ file: path.join(args.assets, name), size: fs.statSync(path.join(args.assets, name)).size }));
const planPages = job.plan.pages.map((page) => {
  const asset = assetFiles.find((item) => item.size === page.dataUrlBytes);
  if (!asset) throw new Error(`No stored image for plan sheet ${page.pageNumber}.`);
  return { pageNumber: page.pageNumber, logicalWidth: page.logicalWidth, logicalHeight: page.logicalHeight, dataUrl: fs.readFileSync(asset.file, 'utf8'), textItems: page.textItems || [], pdfUnits: page.pdfUnits === true };
});

const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((match) => [match[1], match[2].trim()]));
const apiKey = env.OPENAI_API_KEY;
const model = env.OPENAI_TAKEOFF_MODEL || DEFAULT_TAKEOFF_MODEL;
const requests = [];
async function request(name, payload) {
  const file = path.join(args.out, `${name}.json`);
  if (args.replay && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  if (args.offline) throw new Error(`No saved response for ${name}; run without --offline.`);
  const started = Date.now();
  process.stdout.write(`  request ${name} … `);
  const result = await analyseTakeoffPage(validateTakeoffAnalysisRequest(payload), { apiKey, model });
  console.log(`${((Date.now() - started) / 1000).toFixed(0)}s`);
  requests.push({ name, requestId: result.requestId, model: result.model });
  fs.writeFileSync(file, JSON.stringify(result));
  return result;
}

const documentHash = await fingerprintTakeoffDocument(planPages);
const identity = { jobId: String(job.masterJobId || job.jobId || job.takeoffId), takeoffId: String(job.takeoffId), documentHash, runId: RUN_ID };
const prepared = new Map();
const inspections = [];
const cachedInspections = job.scheduleState?.aiInspections || {};
console.log(`Plan set: ${planPages.length} sheets; calibration ${job.pixelsPerMm} px/mm; model ${model}${args.replay ? ' (replaying saved responses)' : ''}`);
for (const page of planPages) {
  prepared.set(page.pageNumber, await prepareAnalysisPage(page));
  if (page.pageNumber === 1) console.log(`  prepared sheet image: ${prepared.get(1).imageWidth} x ${prepared.get(1).imageHeight}, ${(prepared.get(1).imageDataUrl.length * 0.75 / 1024).toFixed(0)} KB`);
  const cached = cachedInspections[`${RUN_ID}:${await fingerprintTakeoffPage(page)}`];
  inspections.push(structuredClone(cached ? cached.analysis : (await request(`inspect-${page.pageNumber}`, { action: 'inspect', ...identity, page: prepared.get(page.pageNumber) })).analysis));
}
const warnings = [];
const relevant = inspections.filter((item) => item.relevant);
const levels = new Set();
for (const item of relevant) {
  if (!item.level || item.level === 'Unassigned') continue;
  if (levels.has(item.level)) { item.relevant = false; warnings.push({ page: item.page, code: 'duplicate-level', message: `Another floor-plan sheet describes ${item.level}. Sheet ${item.page} is supporting evidence only to avoid double-counting; verify which revision should be measured.` }); } else levels.add(item.level);
}
const scale = resolveAnalysisScale({ pages: planPages, inspections, existingPixelsPerMm: job.pixelsPerMm, sheetCalibrations: job.scheduleState?.sheetCalibrations || {} });
if (!scale.pixelsPerMm) throw new Error(`Scale is not established: ${JSON.stringify(scale.conflicts)}`);
const pixelsPerMm = scale.pixelsPerMm;

// Plan-set evidence: every sheet, most informative first, a few per request.
const order = ['window_door_schedule', 'elevation', 'section', 'details', 'floor_plan', 'other', 'roof_plan', 'cover', 'site_plan'];
const evidenceSheets = [];
for (const inspection of inspections.slice().sort((a, b) => order.indexOf(a.drawingType) - order.indexOf(b.drawingType) || a.page - b.page).slice(0, 8)) {
  const rotation = evidenceRotation(inspection, inspections, planPages);
  const page = rotation ? await prepareAnalysisPage(planPages.find((item) => item.pageNumber === inspection.page), rotation) : prepared.get(inspection.page);
  evidenceSheets.push({ ...page, textItems: '', drawingType: inspection.drawingType, level: inspection.level });
}
const bytes = (page) => Math.ceil(page.imageDataUrl.length * 0.75);
const batches = [];
for (const page of evidenceSheets) {
  const last = batches[batches.length - 1];
  if (last && last.length < 4 && last.reduce((sum, item) => sum + bytes(item), 0) + bytes(page) <= 7 * 1024 * 1024) last.push(page); else batches.push([page]);
}
const evidenceResponses = [];
for (const batch of batches) {
  const [primary, ...contextPages] = batch;
  try { evidenceResponses.push((await request(`evidence-${batch.map((page) => page.pageNumber).join('-')}`, { action: 'evidence', ...identity, page: primary, contextPages })).analysis); }
  catch (error) { warnings.push({ page: primary.pageNumber, code: 'evidence-failed', message: `Plan-set evidence could not be read: ${error.message}` }); }
}
const planEvidence = mergePlanEvidence(evidenceResponses);
const projectDefaults = projectDefaultsFromJobSetup(jobSetupRows);
const sharedEvidence = compactPlanEvidence(planEvidence, projectDefaults);

const responses = [];
for (const inspection of inspections.filter((item) => item.relevant || item.drawingType === 'roof_plan')) {
  const page = planPages.find((item) => item.pageNumber === inspection.page);
  const rotation = inspection.rotationToUpright || 0;
  const sheet = rotation ? await prepareAnalysisPage(page, rotation) : prepared.get(inspection.page);
  const contextPages = inspections.filter((item) => item.page !== inspection.page && !item.relevant && /schedule|elevation|section|roof|floor/i.test(item.drawingType)).slice(0, 3)
    .map((item) => { const { textItems, ...supporting } = prepared.get(item.page); return { ...supporting, textItems: '', drawingType: item.drawingType, level: item.level }; });
  const primary = { ...sheet, drawingType: inspection.drawingType, level: inspection.level };
  const scoped = (action, measurementScope, extra = {}) => ({ action, measurementScope, ...identity, page: primary, pixelsPerMm, ...(measurementScope === 'items' ? { contextPages } : {}), planEvidence: sharedEvidence, ...extra });
  try {
    const measured = {};
    for (const scope of MEASUREMENT_SCOPES) measured[scope] = await request(`measure-${inspection.page}-${scope}`, scoped('measure', scope));
    const firstPass = mergeMeasurementScopes(measured.geometry.analysis, measured.items.analysis);
    const refined = { geometry: measured.geometry.analysis, items: measured.items.analysis };
    const geometryPreviewDataUrl = await prepareGeometryReviewImage(sheet, firstPass);
    for (const scope of MEASUREMENT_SCOPES) {
      try { refined[scope] = (await request(`refine-${inspection.page}-${scope}`, scoped('refine', scope, { previousAnalysis: firstPass, geometryPreviewDataUrl }))).analysis; }
      catch (error) { warnings.push({ page: inspection.page, code: 'refinement-failed', message: `Geometry check failed${scope === 'items' ? ' for openings and rooms' : ''}: ${error.message} Valid first-pass detections are retained for review.` }); }
    }
    responses.push({ ...restoreAnalysisCoordinates(mergeMeasurementScopes(refined.geometry, refined.items), rotation), drawingType: inspection.drawingType });
  } catch (error) { warnings.push({ page: inspection.page, code: 'sheet-failed', message: `Sheet analysis failed: ${error.message}` }); }
}

const COLLECTIONS = ['completedWallRuns', 'placedOpenings', 'completedFloorplans', 'completedAreas', 'completedMeasurements', 'completedEaves', 'completedPillars'];
const isAi = (item) => item?.source === 'ai' || String(item?.id || '').startsWith('ai:');
function evaluate(label, existing) {
  const context = { ...identity, pixelsPerMm, pages: planPages.map(({ pageNumber, logicalWidth, logicalHeight }) => ({ pageNumber, logicalWidth, logicalHeight })),
    completedWallRuns: existing.completedWallRuns, placedOpenings: existing.placedOpenings, completedFloorplans: existing.completedFloorplans, completedEaves: existing.completedEaves, sheetLevels: job.sheetLevels || {} };
  const { batch, analysis } = normalizePlanAnalysis({ context, responses, runId: RUN_ID, modelVersion: model, planEvidence, projectDefaults });
  const scaleReview = [...scale.review, ...(scale.notes || [])].map((message) => ({ message, code: 'scale-review' }));
  analysis.review = [...analysis.review, ...scaleReview, ...warnings, ...planEvidence.review.map((message) => ({ message, code: 'plan-evidence' })),
    ...inspections.flatMap((item) => (item.review || []).map((message) => ({ page: item.page, message, code: 'inspection' })))].map((item) => ({ ...item, audience: reviewAudience(item) }));
  analysis.planEvidence = planEvidence; analysis.projectDefaults = projectDefaults;
  const canonical = convertAiTakeoffDetections(batch, context);
  const merged = { ...job, ...Object.fromEntries(COLLECTIONS.map((key) => [key, [...(existing[key] || []), ...(canonical[key] || [])]])) };
  const sheetLevels = { ...(job.sheetLevels || {}) };
  for (const { page, level } of analysis.pages) if (!sheetLevels[page] && level !== 'Unassigned') sheetLevels[page] = level;
  const schedule = createTakeoffSchedule({ ...merged, sheetLevels, totalPages: planPages.length, jobSetupRows, scheduleState: { aiAnalysis: analysis } });
  const payload = createJobSetupPayload(schedule, { sheetLevels });
  const fields = payload.dataInputFields;
  const records = payload.schedule.measurementRecords.map((item) => ({ ...item, level: item.level && item.level !== 'Unassigned' ? item.level : sheetLevels[item.page] || 'Unassigned' }));
  const walls = records.filter((item) => item.kind === 'wall');
  const openings = records.filter((item) => item.kind === 'opening');
  const lm = (items) => Number(items.reduce((sum, item) => sum + (item.quantity || 0), 0).toFixed(2));
  const byLevel = (items, key) => Object.fromEntries([...new Set(items.map((item) => item.level))].sort().map((level) => [level, key(items.filter((item) => item.level === level))]));
  const group = (items, name) => Object.fromEntries([...new Set(items.map(name))].sort().map((value) => [value, lm(items.filter((item) => name(item) === value))]));
  const frame = (item) => Number(item.frameThicknessMm || item.thicknessMm);
  const cls = (name) => openings.filter((item) => item.openingClass === name);
  const sub = (item) => `${item.subType || ''}`.toLowerCase();
  const internalDoors = cls('Internal Door');
  const report = {
    scenario: label,
    aiAdded: Object.fromEntries(COLLECTIONS.map((key) => [key, (canonical[key] || []).length])),
    alreadyInTakeoffNotAddedTwice: analysis.alreadyMeasured.length,
    notAddedBecauseSheetAlreadyMeasured: analysis.notAdded.reduce((counts, item) => ({ ...counts, [item.kind]: (counts[item.kind] || 0) + 1 }), {}),
    reviewItems: payload.review.decisions.length,
    reviewDecisions: payload.review.decisions.map((item) => `${item.title} — ${item.detail}`),
    jobSetupWarnings: payload.warnings,
    diagnostics: payload.review.diagnostics.length,
    checklist: payload.review.checklist.map((item) => item.label),
    floorAreasM2: Object.fromEntries(['lowerFloorAreaM2', 'lowerGarageAreaM2', 'lowerAlfrescoAreaM2', 'lowerPatioAreaM2', 'lowerPorchAreaM2', 'lowerOtherAreaM2', 'upperFloorAreaM2', 'balconyAreaM2', 'upperOtherAreaM2'].filter((key) => fields[key] !== undefined).map((key) => [key, Number(Number(fields[key]).toFixed(2))])),
    scheduleFloorRows: Object.fromEntries(schedule.projectTotals.floorAreas.map((row) => [row.category, row.quantity])),
    documentedAreas: analysis.documentedAreas.map((item) => `${item.level} ${item.type}: ${item.valueM2} m2 printed${item.measured === null ? '' : `, ${item.measured.toFixed(2)} measured`}`),
    externalWallsLm: byLevel(walls.filter((item) => item.category === 'exterior'), (items) => ({ total: lm(items), byType: group(items, (item) => `${item.wallSystemLabel || item.constructionSystem}${item.frameThicknessMm ? ` ${item.frameThicknessMm}mm frame` : ''}`) })),
    internal70mmWallsLm: byLevel(walls.filter((item) => item.category === 'interior' && item.classificationStatus !== 'unclassified' && frame(item) === 70), lm),
    internal90mmWallsLm: byLevel(walls.filter((item) => item.category === 'interior' && item.classificationStatus !== 'unclassified' && frame(item) === 90), lm),
    unclassifiedWallsLm: { external: lm(walls.filter((item) => item.category === 'exterior' && item.classificationStatus === 'unclassified')), internal: lm(walls.filter((item) => item.category === 'interior' && item.classificationStatus === 'unclassified')) },
    windows: cls('Window').length,
    fixedGlazing: cls('Window').filter((item) => /^fg$|fixed/.test(sub(item))).length,
    externalDoors: cls('External Door').length,
    glazedSlidingStackerDoors: cls('Large Glazed/Stacker/Sliding Door').length,
    garageDoors: cls('Garage Door').length,
    internalHingedDoors: internalDoors.filter((item) => !/cavity|robe|wardrobe|barn|sliding|unspecified/.test(sub(item))).length,
    cavitySlidingDoors: internalDoors.filter((item) => /cavity/.test(sub(item))).length,
    robeSlidingDoors: internalDoors.filter((item) => /robe|wardrobe/.test(sub(item))).length,
    otherSlidingDoors: internalDoors.filter((item) => /barn|sliding|unspecified/.test(sub(item)) && !/cavity|robe/.test(sub(item))).length,
    unresolvedOpenings: { noSize: openings.filter((item) => !(item.widthMm > 0) || !(item.heightMm > 0)).length, notOnAWall: payload.review.decisions.find((item) => item.id === 'opening-wall')?.action.targets.length || 0, withheld: analysis.unresolved.filter((item) => item.kind === 'opening').length },
    openEdgesNotCountedAsWalls: analysis.openEdges.map((item) => `${item.level} ${item.area}: ${item.lengthM.toFixed(1)} m`),
    jobSetupFields: Object.fromEntries(Object.entries(fields).filter(([key]) => /^(lower|upper)(Internal(70|90)mmWallsLm|ExternalWallsLm|InternalWallsLm|UnclassifiedExternalLm|UnclassifiedInternalLm|BrickVeneer70mmWallsLm|LightweightCladding70mmWallsLm|RenderedBrickVeneerExternalWallsLm|LightweightCladdingExternalWallsLm|CeilingHeight)$|^(window|door|internalDoor|externalDoor|slidingDoor|garageDoor)OpeningsQty$|^total(CavitySliderCagesEach|UnclassifiedExteriorWallsLm|UnclassifiedInternalLm)$|^eavesWidthM$/.test(key))),
    withheld: analysis.unresolved.map((item) => `${item.kind} ${item.detectionId || item.label || ''}`),
    rooms: analysis.rooms.length, fixtures: analysis.fixtures.reduce((sum, item) => sum + item.quantity, 0),
  };
  fs.writeFileSync(path.join(args.out, `analysis-${label}.json`), JSON.stringify({ analysis, canonical }, null, 1));
  return report;
}
const manual = Object.fromEntries(COLLECTIONS.map((key) => [key, (job[key] || []).filter((item) => !isAi(item))]));
const empty = Object.fromEntries(COLLECTIONS.map((key) => [key, []]));
const reports = { planEvidence: { levels: planEvidence.levels, openingSchedule: planEvidence.openingSchedule.length, windowCodeOrder: planEvidence.windowCodeOrder, standardDoorHeightMm: planEvidence.standardDoorHeightMm, eaveWidthMm: planEvidence.eaveWidthMm, roofPitchDegrees: planEvidence.roofPitchDegrees, conflicts: planEvidence.conflicts, notes: planEvidence.notes }, projectDefaults, requests, warnings,
  onExistingTakeoff: evaluate('on-existing-takeoff', manual), aiOnly: evaluate('ai-only', empty) };
fs.writeFileSync(path.join(args.out, 'report.json'), JSON.stringify(reports, null, 1));
console.log(JSON.stringify(reports, null, 1));
