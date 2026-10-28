// Scratch: render the engine's masks for one sheet. node scripts/_view.mjs <job.gr8job> <page> <out.png> [none|manual] [x,y,w,h logical crop]
import fs from 'node:fs';
import JSZip from 'jszip';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { detectPlanGeometry } from '../components/construction-estimation/ai-plan-takeoff/geometry/planGeometry.js';
const [jobPath, pageArg, out, mode = 'none', cropArg] = process.argv.slice(2);
const archive = await JSZip.loadAsync(fs.readFileSync(jobPath));
const takeoff = JSON.parse(await archive.file('takeoff.json').async('text'));
const job = takeoff.aiPlanTakeoffJob || takeoff.takeoff?.aiPlanTakeoffJob;
const page = job.plan.pages.find((item) => item.pageNumber === Number(pageArg));
const image = await loadImage(Buffer.from(page.dataUrl.slice(page.dataUrl.indexOf(',') + 1), 'base64'));
const canvas = createCanvas(image.width, image.height); const g = canvas.getContext('2d');
g.fillStyle = '#fff'; g.fillRect(0, 0, image.width, image.height); g.drawImage(image, 0, 0);
const raster = g.getImageData(0, 0, image.width, image.height);
const isAi = (item) => item?.source === 'ai' || String(item?.id || '').startsWith('ai:');
const evidence = mode === 'manual' ? job.placedOpenings.filter((o) => !isAi(o) && Number(o.page) === Number(pageArg)).map((o) => ({ x: o.x, y: o.y, ref: String(o.id) })) : [];
const r = detectPlanGeometry(raster, { pixelsPerMm: job.pixelsPerMm, logicalWidth: page.logicalWidth, logicalHeight: page.logicalHeight, openingEvidence: evidence });
const d = r.debug, s = d.width / page.logicalWidth;
const overlay = g.getImageData(0, 0, image.width, image.height);
const tint = (p, cr, cg, cb, a) => { const q = p * 4; overlay.data[q] = overlay.data[q] * (1 - a) + cr * a; overlay.data[q + 1] = overlay.data[q + 1] * (1 - a) + cg * a; overlay.data[q + 2] = overlay.data[q + 2] * (1 - a) + cb * a; };
for (let p = 0; p < d.wall.length; p += 1) {
  if (d.outside?.[p]) tint(p, 120, 190, 255, 0.35);
  if (d.diagonal?.[p]) tint(p, 0, 160, 60, 0.75);
  else if (d.wall[p]) tint(p, 220, 40, 40, 0.6);
  else if (d.closed[p]) tint(p, 200, 0, 200, 0.6);
  else if (d.bridge[p]) tint(p, 255, 150, 0, 0.6);
}
g.putImageData(overlay, 0, 0);
g.lineWidth = 3;
for (const room of r.rooms) { g.strokeStyle = room.verified ? '#1d4ed8' : '#0e9f6e'; g.beginPath(); room.polygon.forEach((p, i) => (i ? g.lineTo(p.x * s, p.y * s) : g.moveTo(p.x * s, p.y * s))); g.closePath(); g.stroke(); }
g.font = '22px sans-serif';
for (const wall of r.walls) { g.fillStyle = wall.category === 'exterior' ? '#000' : '#7c3aed'; const m = { x: (wall.nodes[0].x + wall.nodes[1].x) / 2 * s, y: (wall.nodes[0].y + wall.nodes[1].y) / 2 * s }; g.fillText(wall.category === 'exterior' ? 'E' : 'i', m.x, m.y); }
const b = d.bounds; let [x, y, w, h] = [b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0];
if (cropArg) { const c = cropArg.split(',').map(Number); [x, y, w, h] = [c[0] * s, c[1] * s, c[2] * s, c[3] * s]; }
const zoom = cropArg ? Math.min(4, 1800 / w) : 1;
const crop = createCanvas(Math.round(w * zoom), Math.round(h * zoom)); const cg = crop.getContext('2d'); cg.imageSmoothingEnabled = false;
cg.drawImage(canvas, x, y, w, h, 0, 0, w * zoom, h * zoom);
fs.writeFileSync(out, crop.toBuffer('image/png'));
console.log('walls', r.walls.length, 'ext', r.walls.filter((wall) => wall.category === 'exterior').length, 'rooms', r.rooms.length, crop.width, crop.height);
if (process.env.PROBE) for (const pair of process.env.PROBE.split(';')) { const [cx, cy] = pair.split(',').map(Number); const X = b.x0 + cx, Y = b.y0 + cy; const p = Y * d.width + X;
  const scan = (dx, dy) => { for (let g2 = 1; g2 < 3000; g2 += 1) { const q = (Y + dy * g2) * d.width + X + dx * g2; if (X + dx * g2 < b.x0 || X + dx * g2 > b.x1 || Y + dy * g2 < b.y0 || Y + dy * g2 > b.y1) return 'edge@' + g2; if (d.wall[q]) return 'wall@' + g2; if (d.bridge[q]) return 'bridge@' + g2; if (d.closed[q]) return 'closed@' + g2; } };
  console.log('probe', pair, 'outside', d.outside[p], 'wall', d.wall[p], 'bridge', d.bridge[p], 'L', scan(-1, 0), 'R', scan(1, 0), 'U', scan(0, -1), 'D', scan(0, 1)); }
