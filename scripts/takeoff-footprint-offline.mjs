// Offline footprint check on a saved raster plan run: no provider call, no browser.
// Rebuilds each sheet's linework raster the way the app does (planRaster.js: 0.09 px/mm), runs the
// app's own linework fusion on the saved plan-reading responses, and prints every building area the
// fused response carries next to the plan's printed schedule and the estimator's hand trace.
//
//   node scripts/takeoff-footprint-offline.mjs [--recovery <dir>] [--pages 2,3] [--json <out.json>]
//
// <dir> holds takeoff-with-ai-run.decoded.json, plan-pages/page-asset-<n>.txt (data URLs) and
// rerun/refine-<n>-geometry.json + refine-<n>-items.json (default: recovery/ai-takeoff-run-2026-10-06).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';
import { mergeMeasurementScopes } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/measurementScopes.js';
import { restoreAnalysisCoordinates } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisPages.js';
import { LINEWORK_PIXELS_PER_MM, LINEWORK_RASTER_MAX_SIDE } from '../components/construction-estimation/ai-plan-takeoff/geometry/planRaster.js';

const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const args = Object.fromEntries(process.argv.slice(2).map((arg, i, all) => (arg.startsWith('--') ? [arg.slice(2), all[i + 1]] : null)).filter(Boolean));
const dir = path.resolve(args.recovery || 'recovery/ai-takeoff-run-2026-10-06');
const job = JSON.parse(fs.readFileSync(path.join(dir, 'takeoff-with-ai-run.decoded.json'), 'utf8')).job;
const pages = (args.pages || '2,3').split(',').map(Number);
const ppm = job.pixelsPerMm;

const areaM2 = (nodes) => { let a = 0; for (let i = 0; i < nodes.length; i += 1) { const j = (i + 1) % nodes.length; a += nodes[i].x * nodes[j].y - nodes[j].x * nodes[i].y; } return Math.abs(a / 2) / (ppm * ppm) / 1e6; };

// Same steps as readPlanRaster, with @napi-rs/canvas in place of the DOM.
async function planRaster(dataUrl, sheet) {
  const image = await loadImage(dataUrl);
  const limit = LINEWORK_RASTER_MAX_SIDE / Math.max(image.width, image.height);
  const stored = sheet.pixelsPerMm * image.width / sheet.logicalWidth;
  const wanted = Math.abs(stored / LINEWORK_PIXELS_PER_MM - 1) > 0.1 ? Math.max(0.35, Math.min(2.5, LINEWORK_PIXELS_PER_MM / stored)) : 1;
  const ratio = Math.min(wanted, limit);
  const canvas = createCanvas(Math.max(1, Math.round(image.width * ratio)), Math.max(1, Math.round(image.height * ratio)));
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(image, 0, 0, canvas.width, canvas.height);
  const raster = g.getImageData(0, 0, canvas.width, canvas.height);
  raster.storedPixelsPerMm = stored;
  return raster;
}

// The page image files are numbered by storage asset, not by sheet: match them on their content hash.
const imageByAsset = new Map(fs.readdirSync(path.join(dir, 'plan-pages')).map((name) => {
  const dataUrl = fs.readFileSync(path.join(dir, 'plan-pages', name), 'utf8').trim();
  return [crypto.createHash('sha256').update(dataUrl).digest('hex'), dataUrl];
}));
const out = { pages: {} };
for (const pageNumber of pages) {
  const planPage = job.plan.pages.find((p) => p.pageNumber === pageNumber);
  const sheet = { pageNumber, logicalWidth: planPage.logicalWidth, logicalHeight: planPage.logicalHeight, pixelsPerMm: ppm };
  const geometryPass = JSON.parse(fs.readFileSync(path.join(dir, 'rerun', `refine-${pageNumber}-geometry.json`), 'utf8')).analysis;
  const itemsPass = JSON.parse(fs.readFileSync(path.join(dir, 'rerun', `refine-${pageNumber}-items.json`), 'utf8')).analysis;
  // As the app does: merge the two halves, then turn the reading (made on the upright sheet) back to the sheet.
  const rotation = Object.values(job.scheduleState?.aiInspections || {}).find((entry) => entry.analysis?.page === pageNumber)?.analysis?.rotationToUpright || 0;
  const response = restoreAnalysisCoordinates(mergeMeasurementScopes({ ...geometryPass }, { ...itemsPass }), rotation);
  const dataUrl = imageByAsset.get(planPage.dataUrlAssetId);
  if (!dataUrl) throw new Error(`No stored image for sheet ${pageNumber} (asset ${planPage.dataUrlAssetId}).`);
  const raster = await planRaster(dataUrl, sheet);
  const fused = fuseSheetLinework(response, raster, sheet, { placedOpenings: [], completedFloorplans: [], vectorLinework: [] });
  const toPx = (p) => ({ x: p.x * sheet.logicalWidth, y: p.y * sheet.logicalHeight });
  const exteriorLm = fused.response.walls.filter((w) => w.category === 'exterior').reduce((sum, w) => sum + w.nodes.slice(1).reduce((s, p, i) => s + Math.hypot((p.x - w.nodes[i].x) * sheet.logicalWidth, (p.y - w.nodes[i].y) * sheet.logicalHeight), 0), 0) / ppm / 1000;
  const areas = (fused.response.buildingAreas || []).map((area) => ({
    id: area.detectionId, type: area.type,
    beforeM2: Math.round(areaM2((response.buildingAreas.find((a) => a.detectionId === area.detectionId)?.nodes || []).map(toPx)) * 100) / 100,
    afterM2: Math.round(areaM2(area.nodes.map(toPx)) * 100) / 100,
    constraint: area.wallConstraint || null,
  }));
  const handTrace = (job.completedFloorplans || []).filter((f) => Number(f.page) === pageNumber).map((f) => ({ type: f.type, m2: Math.round(areaM2(f.nodes) * 100) / 100 }));
  out.pages[pageNumber] = { engine: fused.report.engine, measuredWalls: fused.report.measuredWalls, exteriorWallLm: Math.round(exteriorLm * 100) / 100, areas, handTrace };
  console.log(`\nSheet ${pageNumber}: ${fused.report.measuredWalls} measured walls, ${out.pages[pageNumber].exteriorWallLm} m external`);
  for (const a of areas) console.log(`  ${a.type.padEnd(10)} ${a.id.padEnd(22)} before ${a.beforeM2.toFixed(2).padStart(7)}  after ${a.afterM2.toFixed(2).padStart(7)}${a.constraint ? `  [${a.constraint.status}${a.constraint.movedEdges !== undefined ? `, ${a.constraint.movedEdges}/${a.constraint.edges} edges on walls` : ''}]` : ''}`);
  console.log(`  hand trace: ${handTrace.map((h) => `${h.type} ${h.m2}`).join(', ')}`);
}
console.log('\nPrinted schedule (FLOOR AREAS table, sheet 2): Ground total 225.31 = living 148.02 + garage 40.23 + alfresco 19.00 + patio 18.06; 1st floor living 136.49 + balcony 16.37 = 152.86.');
if (args.json) fs.writeFileSync(args.json, JSON.stringify(out, null, 2));
