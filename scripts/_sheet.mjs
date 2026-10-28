// Scratch: run the engine (linework only) on one plan image at a stated scale; list walls, openings and rooms; render the result.
// node scripts/_sheet.mjs <page.png> <raster px per mm> <out.png> [labels.json]
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { detectPlanGeometry, traceOutlinedArea } from '../components/construction-estimation/ai-plan-takeoff/geometry/planGeometry.js';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';
import { detectRoomBoundary } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/roomGeometry.js';
const [png, ppmArg, out, labelsFile] = process.argv.slice(2);
const image = await loadImage(fs.readFileSync(png));
const stored = Number(ppmArg);
// As the app does: bring the sheet to the engine's working resolution.
const ratio = Math.abs(stored / 0.09 - 1) > 0.1 ? Math.max(0.35, Math.min(2.5, 0.09 / stored)) : 1;
const w = Math.round(image.width * ratio), h = Math.round(image.height * ratio);
const canvas = createCanvas(w, h); const g = canvas.getContext('2d');
g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.imageSmoothingQuality = 'high'; g.drawImage(image, 0, 0, w, h);
const raster = g.getImageData(0, 0, w, h); raster.storedPixelsPerMm = stored;
// Logical units = stored image pixels, so pixelsPerMm is the stored scale.
const sheet = { pageNumber: 1, logicalWidth: image.width, logicalHeight: image.height, pixelsPerMm: stored };
const labels = labelsFile ? JSON.parse(fs.readFileSync(labelsFile, 'utf8')) : [];
const started = Date.now();
const fused = fuseSheetLinework({ page: 1, walls: [], openings: [], rooms: labels.map((label) => ({ page: 1, name: label.name, x: label.x / image.width, y: label.y / image.height, basis: 'OBSERVED', confidence: 0.95, evidence: 'Room name read from the sheet by hand for this test.' })) }, raster, sheet);
const r = fused.geometry;
if (!r.walls.length) { console.log('not measured:', fused.response.review.map((item) => item.message).join(' | ')); process.exit(0); }
const lm = (category) => (r.walls.filter((wall) => wall.category === category).reduce((sum, wall) => sum + wall.lengthMm, 0) / 1000).toFixed(1);
console.log(`ratio ${ratio.toFixed(2)} | ${Date.now() - started} ms | walls ${r.walls.length}: external ${lm('exterior')} lm, internal ${lm('interior')} lm | diagnostics ${[...new Set(r.diagnostics.map((item) => item.code))].join(',')}`);
const kinds = {}; for (const opening of r.openings) { const key = `${opening.kind}:${opening.basis}`; kinds[key] = (kinds[key] || 0) + 1; }
console.log('openings by kind:basis', JSON.stringify(kinds), '| emitted from linework', fused.response.openings.length, fused.response.openings.map((item) => `${item.openingClass.split(' ')[0]} ${item.widthMm}`).join(', '));
const span = (room) => { const xs = room.polygon.map((p) => p.x), ys = room.polygon.map((p) => p.y); return `${Math.round((Math.max(...xs) - Math.min(...xs)) / stored)} x ${Math.round((Math.max(...ys) - Math.min(...ys)) / stored)} mm @${Math.round(room.centroid.x)},${Math.round(room.centroid.y)}`; };
console.log('spaces >= 1.5 m2:'); for (const room of r.rooms.filter((item) => item.netAreaM2 >= 1.5 && !item.dividedInto)) console.log(`   ${room.netAreaM2.toFixed(2).padStart(7)} m2 ${room.verified ? 'enclosed ' : 'proposed '} ${span(room)}`);
if (labels.length) { console.log('named rooms:'); for (const room of fused.response.rooms.map((item, index) => detectRoomBoundary(item, { page: 1, level: 'Ground Floor', width: image.width, height: image.height, pixelsPerMm: stored, walls: [], openings: [], raster: null }, index))) console.log(`   ${String(room.name).padEnd(12)} ${room.areaM2 === null ? '   -   ' : room.areaM2.toFixed(2).padStart(7)} m2 ${room.polygon?.length ? room.detectionMethod : 'no boundary'}${room.openPlanWith ? ' open plan with ' + room.openPlanWith.join(', ') : ''}${room.openPlanIn ? ' (in ' + room.openPlanIn + ')' : ''}${room.robeOf ? ' robe of ' + room.robeOf : ''}`); }
const d = r.debug, s = d.width / image.width;
const overlay = g.getImageData(0, 0, w, h);
const tint = (p, cr, cg, cb, a) => { const q = p * 4; overlay.data[q] = overlay.data[q] * (1 - a) + cr * a; overlay.data[q + 1] = overlay.data[q + 1] * (1 - a) + cg * a; overlay.data[q + 2] = overlay.data[q + 2] * (1 - a) + cb * a; };
for (let p = 0; p < d.wall.length; p += 1) { if (d.outside[p]) tint(p, 120, 190, 255, 0.3); if (d.diagonal[p]) tint(p, 0, 160, 60, 0.75); else if (d.wall[p]) tint(p, 220, 40, 40, 0.6); else if (d.closed[p]) tint(p, 200, 0, 200, 0.6); else if (d.bridge[p]) tint(p, 255, 150, 0, 0.6); }
g.putImageData(overlay, 0, 0); g.lineWidth = 3;
for (const room of r.rooms.filter((item) => !item.dividedInto)) { g.strokeStyle = room.verified ? '#1d4ed8' : '#0e9f6e'; g.beginPath(); room.polygon.forEach((p, i) => (i ? g.lineTo(p.x * s, p.y * s) : g.moveTo(p.x * s, p.y * s))); g.closePath(); g.stroke(); }
if (process.env.CROP) { const [cx, cy, cw, ch] = process.env.CROP.split(',').map(Number); const z = 2; const crop = createCanvas(cw * z, ch * z); const cg = crop.getContext('2d'); cg.imageSmoothingEnabled = false; cg.drawImage(canvas, cx * s, cy * s, cw * s, ch * s, 0, 0, cw * z, ch * z); fs.writeFileSync(out, crop.toBuffer('image/png')); process.exit(0); }
const b = d.bounds; const cw = b.x1 - b.x0, ch = b.y1 - b.y0, zoom = Math.min(1, 1900 / Math.max(cw, ch));
const crop = createCanvas(Math.round(cw * zoom), Math.round(ch * zoom)); crop.getContext('2d').drawImage(canvas, b.x0, b.y0, cw, ch, 0, 0, crop.width, crop.height);
fs.writeFileSync(out, crop.toBuffer('image/png'));
