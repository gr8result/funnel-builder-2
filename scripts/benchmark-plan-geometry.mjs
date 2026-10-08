// Real-plan benchmark for the geometry engine: runs it on a saved takeoff's own floor-plan sheets
// and compares the result with what the estimator traced by hand on those sheets. No provider is
// called. Room names come only from label positions already saved with the takeoff.
//
//   node scripts/benchmark-plan-geometry.mjs --job <decoded-takeoff.json> --assets <plan-pages dir> --out <dir>
//
// --job     JSON holding { job: <ai-plan-takeoff job> } (same file run-ai-takeoff-plan-set.mjs reads)
// --assets  the plan page images saved as data-URL text files (matched by byte size)
// --out     directory for report.json, geometry-<sheet>.json and overlay-<sheet>.png
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { detectPlanGeometry, pointInPolygon } from '../components/construction-estimation/ai-plan-takeoff/geometry/planGeometry.js';

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => (arg.startsWith('--') ? [arg.slice(2), all[index + 1]] : null)).filter(Boolean));
if (!args.job || !args.assets || !args.out) { console.error('Usage: --job <json> --assets <dir> --out <dir>'); process.exit(2); }
const { job: jobPath, assets: assetsDir, out: outDir } = args;
fs.mkdirSync(outDir, { recursive: true });
const job = JSON.parse(fs.readFileSync(jobPath, 'utf8')).job;
const assets = fs.readdirSync(assetsDir).map((name) => ({ file: path.join(assetsDir, name), size: fs.statSync(path.join(assetsDir, name)).size }));
const isAi = (item) => item?.source === 'ai' || String(item?.id || '').startsWith('ai:');
const ppm = job.pixelsPerMm;
const report = { job: job.jobName, pixelsPerMm: ppm, sheets: [] };

for (const [pageKey, level] of Object.entries(job.sheetLevels || {})) {
  const pageNumber = Number(pageKey);
  const page = job.plan.pages.find((item) => item.pageNumber === pageNumber);
  const text = fs.readFileSync(assets.find((item) => item.size === page.dataUrlBytes).file, 'utf8');
  const image = await loadImage(Buffer.from(text.slice(text.indexOf(',') + 1), 'base64'));
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff'; context.fillRect(0, 0, image.width, image.height); context.drawImage(image, 0, 0);
  const raster = context.getImageData(0, 0, image.width, image.height);
  const started = Date.now();
  const result = detectPlanGeometry(raster, { pixelsPerMm: ppm, logicalWidth: page.logicalWidth, logicalHeight: page.logicalHeight });
  const ms = Date.now() - started;
  const { wall, bridge, width, height } = result.debug;
  const s = width / page.logicalWidth;
  const k = result.rasterPixelsPerMm;

  // Coverage of the estimator's wall traces by detected wall fabric (within 200 mm).
  const tolerance = Math.round(200 * k);
  const nearWall = (x, y) => {
    for (let dy = -tolerance; dy <= tolerance; dy += 2) for (let dx = -tolerance; dx <= tolerance; dx += 2) {
      const qx = Math.round(x * s) + dx, qy = Math.round(y * s) + dy;
      if (qx >= 0 && qy >= 0 && qx < width && qy < height && wall[qy * width + qx]) return true;
    }
    return false;
  };
  const manualWalls = (job.completedWallRuns || []).filter((item) => !isAi(item) && Number(item.page) === pageNumber);
  const coverage = {};
  const missed = [];
  for (const item of manualWalls) {
    const bucket = coverage[item.category] ||= { tracedLm: 0, coveredLm: 0 };
    for (let i = 1; i < item.nodes.length; i += 1) {
      const a = item.nodes[i - 1], b = item.nodes[i];
      const lengthMm = Math.hypot(b.x - a.x, b.y - a.y) / ppm;
      const parts = Math.max(1, Math.round(lengthMm / 100));
      let hit = 0;
      for (let part = 0; part <= parts; part += 1) if (nearWall(a.x + (b.x - a.x) * part / parts, a.y + (b.y - a.y) * part / parts)) hit += 1;
      const share = hit / (parts + 1);
      bucket.tracedLm += lengthMm / 1000; bucket.coveredLm += lengthMm / 1000 * share;
      if (share < 0.6 && lengthMm > 300) missed.push({ category: item.category, lengthM: +(lengthMm / 1000).toFixed(2), covered: +share.toFixed(2), from: a, to: b });
    }
  }
  for (const bucket of Object.values(coverage)) { bucket.share = +(bucket.coveredLm / bucket.tracedLm).toFixed(3); bucket.tracedLm = +bucket.tracedLm.toFixed(1); bucket.coveredLm = +bucket.coveredLm.toFixed(1); }

  // Each detected room named by the takeoff's own evidence: the saved AI room labels (position
  // only) and the estimator's floorplan polygons.
  const labels = (job.scheduleState?.aiAnalysis?.rooms || []).filter((room) => Number(room.page) === pageNumber && Number.isFinite(room.x));
  const rooms = result.rooms.map((room) => ({
    id: room.id, areaM2: +room.areaM2.toFixed(2), netAreaM2: +room.netAreaM2.toFixed(2), perimeterM: +room.perimeterM.toFixed(2), vertices: room.polygon.length,
    labels: labels.filter((label) => pointInPolygon({ x: label.x * page.logicalWidth, y: label.y * page.logicalHeight }, room.polygon)).map((label) => label.name),
    ...(room.reviewRequired ? { review: room.reviewReason } : {}),
  }));
  const manualAreas = (job.completedFloorplans || []).filter((item) => Number(item.page) === pageNumber).map((item) => ({
    type: item.type, label: item.label,
    areaM2: +(Math.abs(item.nodes.reduce((sum, p, i) => { const q = item.nodes[(i + 1) % item.nodes.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2 / ppm / ppm / 1e6).toFixed(2),
  }));
  const manualOpenings = (job.placedOpenings || []).filter((item) => !isAi(item) && Number(item.page) === pageNumber);
  const doorMatches = manualOpenings.filter((item) => /door/i.test(item.type)).map((item) => {
    const match = result.openings.map((gap) => ({ gap, d: Math.hypot(gap.x - item.x, gap.y - item.y) / ppm })).sort((a, b) => a.d - b.d)[0];
    return { tag: item.itemTag, widthMm: item.widthMm, found: match && match.d < 700 ? match.gap.widthMm : null };
  });
  report.sheets.push({
    page: pageNumber, level, ms, diagnostics: result.diagnostics,
    walls: { detected: result.walls.length, detectedLm: +(result.walls.reduce((sum, item) => sum + item.lengthMm, 0) / 1000).toFixed(1), byThickness: result.walls.reduce((map, item) => ({ ...map, [item.thicknessMm]: +((map[item.thicknessMm] || 0) + item.lengthMm / 1000).toFixed(1) }), {}), flagged: result.walls.filter((item) => item.reviewRequired).length },
    manualWallCoverage: coverage, missedManualSegments: missed.length, missed: missed.slice(0, 12),
    rooms: { detected: rooms.length, labelled: rooms.filter((room) => room.labels.length).length, unlabelledLabels: labels.filter((label) => !result.rooms.some((room) => pointInPolygon({ x: label.x * page.logicalWidth, y: label.y * page.logicalHeight }, room.polygon))).map((label) => label.name), list: rooms },
    sumRoomAreaM2: +rooms.reduce((sum, room) => sum + room.areaM2, 0).toFixed(2), manualAreas,
    doors: { manual: doorMatches.length, gapsDetected: result.openings.length, matched: doorMatches.filter((item) => item.found).length, widthWithin100mm: doorMatches.filter((item) => item.found && Math.abs(item.found - item.widthMm) <= 100).length, list: doorMatches },
  });

  // Overlay for visual checking: wall fabric red, closed openings green, rooms tinted.
  const overlay = context.getImageData(0, 0, width, height);
  const roomIds = new Map(result.rooms.map((room, index) => [room.id, index]));
  const tint = [[66, 133, 244], [251, 188, 5], [52, 168, 83], [171, 71, 188], [0, 172, 193], [255, 112, 67]];
  const labelsMap = result.debug.labels;
  const roomOfLabel = new Map();
  for (const room of result.rooms) {
    const cx = Math.round(room.centroid.x * s), cy = Math.round(room.centroid.y * s);
    // find the label id at any pixel of the polygon's centroid neighbourhood
    for (let r = 0; r < 200 && !roomOfLabel.has(room.id); r += 3) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const id = labelsMap[(cy + dy) * width + cx + dx];
      if (id && !wall[(cy + dy) * width + cx + dx] && pointInPolygon({ x: (cx + dx) / s, y: (cy + dy) / s }, room.polygon)) { roomOfLabel.set(room.id, id); break; }
    }
  }
  const colourOf = new Map([...roomOfLabel].map(([roomId, id]) => [id, tint[roomIds.get(roomId) % tint.length]]));
  for (let p = 0; p < width * height; p += 1) {
    const colour = wall[p] ? [220, 38, 38] : bridge[p] ? [22, 163, 74] : colourOf.get(labelsMap[p]);
    if (!colour) continue;
    const alpha = wall[p] || bridge[p] ? 0.55 : 0.28;
    for (let c = 0; c < 3; c += 1) overlay.data[p * 4 + c] = Math.round(overlay.data[p * 4 + c] * (1 - alpha) + colour[c] * alpha);
  }
  context.putImageData(overlay, 0, 0);
  context.strokeStyle = '#1d4ed8'; context.lineWidth = 3;
  for (const room of result.rooms) { context.beginPath(); room.polygon.forEach((p, i) => (i ? context.lineTo(p.x * s, p.y * s) : context.moveTo(p.x * s, p.y * s))); context.closePath(); context.stroke(); }
  const b = result.debug.bounds;
  const crop = createCanvas(b.x1 - b.x0, b.y1 - b.y0);
  crop.getContext('2d').drawImage(canvas, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 0, 0, b.x1 - b.x0, b.y1 - b.y0);
  fs.writeFileSync(path.join(outDir, `overlay-${pageNumber}.png`), crop.toBuffer('image/png'));
  const { debug, ...saved } = result;
  fs.writeFileSync(path.join(outDir, `geometry-${pageNumber}.json`), JSON.stringify(saved));
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
for (const sheet of report.sheets) {
  console.log(`\nSheet ${sheet.page} (${sheet.level}) ${sheet.ms} ms`);
  console.log(' walls', JSON.stringify(sheet.walls));
  console.log(' manual wall coverage', JSON.stringify(sheet.manualWallCoverage), 'missed segments', sheet.missedManualSegments);
  console.log(' rooms', sheet.rooms.detected, 'labelled', sheet.rooms.labelled, 'labels outside any room:', sheet.rooms.unlabelledLabels.join(', '));
  for (const room of sheet.rooms.list) console.log(`   ${room.areaM2.toFixed(2).padStart(7)} m²  ${String(room.vertices).padStart(3)}v  ${room.labels.join(' + ') || '-'}${room.review ? `  [${room.review}]` : ''}`);
  console.log(' sum rooms', sheet.sumRoomAreaM2, 'manual areas', JSON.stringify(sheet.manualAreas));
  console.log(' doors', JSON.stringify({ ...sheet.doors, list: undefined }));
}
