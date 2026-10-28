// Scratch: fuse one stored sheet image (data URL text file) with the saved plan reading, as the app does.
// node scripts/_fuse.mjs <decoded job json> <responses dir> <page> <stored-page.txt> <out.png> [crop x,y,w,h logical]
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';
import { restoreAnalysisCoordinates } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisPages.js';
import { mergeMeasurementScopes } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/measurementScopes.js';
const [jobFile, responses, pageArg, imageFile, out, cropArg] = process.argv.slice(2);
const job = JSON.parse(fs.readFileSync(jobFile, 'utf8')).job; const pageNumber = Number(pageArg);
const sheetPage = job.plan.pages.find((item) => item.pageNumber === pageNumber);
const read = (name) => JSON.parse(fs.readFileSync(`${responses}/${name}`, 'utf8')).analysis;
const rotation = Object.values(job.scheduleState.aiInspections).map((entry) => entry.analysis).find((item) => item.page === pageNumber)?.rotationToUpright || 0;
const response = { ...restoreAnalysisCoordinates(mergeMeasurementScopes(read(`refine-${pageNumber}-geometry.json`), read(`refine-${pageNumber}-items.json`)), rotation), drawingType: 'floor_plan' };
const text = fs.readFileSync(imageFile, 'utf8');
const image = await loadImage(Buffer.from(text.slice(text.indexOf(',') + 1), 'base64'));
const stored = job.pixelsPerMm * image.width / sheetPage.logicalWidth;
const ratio = Number(process.env.RATIO) || (Math.abs(stored / 0.09 - 1) > 0.1 ? Math.max(0.35, Math.min(2.5, 0.09 / stored)) : 1);
const w = Math.round(image.width * ratio), h = Math.round(image.height * ratio);
const canvas = createCanvas(w, h); const g = canvas.getContext('2d');
g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.imageSmoothingQuality = 'high'; g.drawImage(image, 0, 0, w, h);
const raster = g.getImageData(0, 0, w, h);
const fused = fuseSheetLinework(response, raster, { pageNumber, logicalWidth: sheetPage.logicalWidth, logicalHeight: sheetPage.logicalHeight, pixelsPerMm: job.pixelsPerMm });
console.log('image', image.width, 'x', image.height, 'ratio', ratio.toFixed(3), 'walls', fused.geometry.walls.length, 'diag', fused.geometry.walls.filter((wall) => wall.axis === 'd').length, JSON.stringify(fused.report.rooms));
console.log('spaces', fused.geometry.rooms.filter((room) => room.netAreaM2 > 2).map((room) => `${room.netAreaM2.toFixed(1)}${room.verified ? 'v' : 'p'}${room.dividedInto ? '[whole]' : ''}${room.partOf ? '[part]' : ''}`).join(' '));
console.log('rooms', fused.response.rooms.filter((room) => room.lineworkRoomId).map((room) => `${room.name}=${room.lineworkAreaM2}`).join('; '));
const d = fused.geometry.debug, s = d.width / sheetPage.logicalWidth;
const overlay = g.getImageData(0, 0, w, h);
const tint = (p, cr, cg, cb, a) => { const q = p * 4; overlay.data[q] = overlay.data[q] * (1 - a) + cr * a; overlay.data[q + 1] = overlay.data[q + 1] * (1 - a) + cg * a; overlay.data[q + 2] = overlay.data[q + 2] * (1 - a) + cb * a; };
for (let p = 0; p < d.wall.length; p += 1) { if (d.outside[p]) tint(p, 120, 190, 255, 0.35); if (d.diagonal[p]) tint(p, 0, 160, 60, 0.75); else if (d.wall[p]) tint(p, 220, 40, 40, 0.6); else if (d.closed[p]) tint(p, 200, 0, 200, 0.6); else if (d.bridge[p]) tint(p, 255, 150, 0, 0.6); }
g.putImageData(overlay, 0, 0);
g.lineWidth = 3;
for (const room of fused.geometry.rooms) { g.strokeStyle = room.verified ? '#1d4ed8' : '#0e9f6e'; g.beginPath(); room.polygon.forEach((p, i) => (i ? g.lineTo(p.x * s, p.y * s) : g.moveTo(p.x * s, p.y * s))); g.closePath(); g.stroke(); }
const b = d.bounds; let [x, y, cw, ch] = [b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0];
if (cropArg) { const c = cropArg.split(',').map(Number); [x, y, cw, ch] = [c[0] * s, c[1] * s, c[2] * s, c[3] * s]; }
const zoom = cropArg ? Math.min(4, 1800 / cw) : 1;
const crop = createCanvas(Math.round(cw * zoom), Math.round(ch * zoom)); const cg = crop.getContext('2d'); cg.imageSmoothingEnabled = false;
cg.drawImage(canvas, x, y, cw, ch, 0, 0, cw * zoom, ch * zoom);
fs.writeFileSync(out, crop.toBuffer('image/png'));
