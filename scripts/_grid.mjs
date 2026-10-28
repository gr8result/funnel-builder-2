// Scratch: a crop of a plan page with a logical-coordinate grid, for tracing reference polygons by eye.
// node scripts/_grid.mjs <plan.png> <out.png> <x,y,w,h logical> [zoom] [polygons.json page]
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const [png, out, cropArg, zoomArg = '4', polygonsFile, pageArg] = process.argv.slice(2);
const image = await loadImage(fs.readFileSync(png));
const s = image.width / 595;
const [x, y, w, h] = cropArg.split(',').map(Number);
const zoom = Number(zoomArg);
const canvas = createCanvas(Math.round(w * s * zoom), Math.round(h * s * zoom)); const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;
g.drawImage(image, x * s, y * s, w * s, h * s, 0, 0, canvas.width, canvas.height);
const px = (lx) => (lx - x) * s * zoom, py = (ly) => (ly - y) * s * zoom;
g.font = '13px sans-serif';
for (let gx = Math.ceil(x / 5) * 5; gx <= x + w; gx += 5) { const major = gx % 10 === 0; g.strokeStyle = major ? 'rgba(220,0,0,0.45)' : 'rgba(220,0,0,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px(gx), 0); g.lineTo(px(gx), canvas.height); g.stroke(); if (major) { g.fillStyle = '#c00'; g.fillText(String(gx), px(gx) + 2, 12); g.fillText(String(gx), px(gx) + 2, canvas.height - 4); } }
for (let gy = Math.ceil(y / 5) * 5; gy <= y + h; gy += 5) { const major = gy % 10 === 0; g.strokeStyle = major ? 'rgba(0,0,220,0.45)' : 'rgba(0,0,220,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, py(gy)); g.lineTo(canvas.width, py(gy)); g.stroke(); if (major) { g.fillStyle = '#00c'; g.fillText(String(gy), 2, py(gy) - 2); g.fillText(String(gy), canvas.width - 30, py(gy) - 2); } }
if (polygonsFile) {
  const set = JSON.parse(fs.readFileSync(polygonsFile, 'utf8'));
  g.lineWidth = 3;
  for (const room of set.rooms.filter((item) => Number(item.page) === Number(pageArg))) { g.strokeStyle = '#0a0'; g.beginPath(); room.polygon.forEach((p, i) => (i ? g.lineTo(px(p.x), py(p.y)) : g.moveTo(px(p.x), py(p.y)))); g.closePath(); g.stroke(); g.fillStyle = '#060'; g.fillText(room.name, px(room.polygon[0].x) + 6, py(room.polygon[0].y) + 16); }
}
fs.writeFileSync(out, canvas.toBuffer('image/png'));
console.log(canvas.width, canvas.height);
