import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { detectPlanGeometry } from '../components/construction-estimation/ai-plan-takeoff/geometry/planGeometry.js';
const [png, jobLite, page] = process.argv.slice(2);
const job = JSON.parse(fs.readFileSync(jobLite, 'utf8'));
const image = await loadImage(fs.readFileSync(png));
const canvas = createCanvas(image.width, image.height); const g = canvas.getContext('2d');
g.fillStyle = '#fff'; g.fillRect(0, 0, image.width, image.height); g.drawImage(image, 0, 0);
const raster = g.getImageData(0, 0, image.width, image.height);
const ev = job.placedOpenings.filter((o) => Number(o.page) === Number(page)).map((o) => ({ x: o.x, y: o.y, ref: String(o.id) }));
globalThis.GEOM_DEBUG = true; const t = Date.now();
const r = detectPlanGeometry(raster, { pixelsPerMm: job.pixelsPerMm, logicalWidth: 595, logicalHeight: 842, openingEvidence: ev }, process.env.OVR ? JSON.parse(process.env.OVR) : {});
console.log('ms', Date.now() - t, 'walls', r.walls.length, 'openings', r.openings.length, 'rooms', r.rooms.length);
if (process.argv[5]) { const [x0, y0, w, h] = process.argv[5].split(',').map(Number); const d = r.debug;
  for (const name of ['bandH', 'bandV', 'wall', 'bridge', 'closed']) { console.log(name); for (let y = y0; y < y0 + h; y += 1) { let line = ''; for (let x = x0; x < x0 + w; x += 1) line += d[name][y * d.width + x] || '.'; console.log(line); } }
  console.log('ink'); for (let y = y0; y < y0 + h; y += 1) { let line = ''; for (let x = x0; x < x0 + w; x += 1) { const p = (y * d.width + x) * 4; line += raster.data[p] + raster.data[p + 1] + raster.data[p + 2] < 630 ? '#' : '.'; } console.log(line); } }
