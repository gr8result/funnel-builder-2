// Scratch: how much of a quarter-circle swing is drawn for hinges near a point.
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const [png, hx, hy, rMin, rMax] = process.argv.slice(2);
const image = await loadImage(fs.readFileSync(png));
const canvas = createCanvas(image.width, image.height); const g = canvas.getContext('2d'); g.drawImage(image, 0, 0);
const data = g.getImageData(0, 0, image.width, image.height).data; const width = image.width;
const ink = (x, y) => { const p = (Math.round(y) * width + Math.round(x)) * 4; return data[p] + data[p + 1] + data[p + 2] < 630; };
const near = (x, y) => { for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (ink(x + dx, y + dy)) return true; return false; };
let best = { share: 0 };
for (let y = Number(hy) - 12; y <= Number(hy) + 12; y += 1) for (let x = Number(hx) - 12; x <= Number(hx) + 12; x += 1) for (let r = Number(rMin); r <= Number(rMax); r += 1) for (const dir of [1, -1]) for (const side of [1, -1]) {
  let drawn = 0; const row = [];
  for (let d = 12; d <= 78; d += 3) { const a = d * Math.PI / 180; const ok = near(x + side * r * Math.sin(a), y + dir * r * Math.cos(a)); row.push(ok ? '#' : '.'); if (ok) drawn += 1; }
  if (drawn / 23 > best.share) best = { share: drawn / 23, x, y, r, dir, side, row: row.join('') };
}
console.log(JSON.stringify(best));
