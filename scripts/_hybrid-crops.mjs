// Scratch: overlapping enlarged crops of a sheet's building region, with crop-to-sheet transforms.
// node scripts/_hybrid-crops.mjs <page.png> <paths export.json> <sheet name> <out dir>
import fs from 'node:fs'; import { createCanvas, loadImage } from '@napi-rs/canvas';
const [png, exportFile, name, outDir, boxArg] = process.argv.slice(2);
const image = await loadImage(fs.readFileSync(png)); const data = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
const xs = data.segments.flatMap((s) => [s.a.x, s.b.x]), ys = data.segments.flatMap((s) => [s.a.y, s.b.y]);
const margin = 1500 * data.pixelsPerMm;
const box = boxArg ? Object.fromEntries(boxArg.split(',').map(Number).map((v, i) => [['x0', 'y0', 'x1', 'y1'][i], v])) : { x0: Math.max(0, Math.min(...xs) - margin), y0: Math.max(0, Math.min(...ys) - margin), x1: Math.min(image.width, Math.max(...xs) + margin), y1: Math.min(image.height, Math.max(...ys) + margin) };
const w = box.x1 - box.x0, h = box.y1 - box.y0, overlap = 0.15;
const tiles = [];
for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
  const tw = w * (0.5 + overlap / 2), th = h * (0.5 + overlap / 2);
  const x = box.x0 + cx * (w - tw), y = box.y0 + cy * (h - th);
  const scale = 2000 / Math.max(tw, th);
  const canvas = createCanvas(Math.round(tw * scale), Math.round(th * scale)); const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height); g.imageSmoothingQuality = 'high'; g.drawImage(image, x, y, tw, th, 0, 0, canvas.width, canvas.height);
  const file = `${outDir}/${name}-${cx}${cy}.png`; fs.writeFileSync(file, canvas.toBuffer('image/png'));
  // Crop fraction (u, v) in 0..1 maps to sheet pixel (x + u * tw, y + v * th).
  tiles.push({ id: `${name}-${cx}${cy}`, file, sheet: { x, y, width: tw, height: th }, image: { width: canvas.width, height: canvas.height }, mmPerCropPixel: 1 / (data.pixelsPerMm * scale), bytes: fs.statSync(file).size });
}
fs.writeFileSync(`${outDir}/${name}-tiles.json`, JSON.stringify({ sheet: png, pixelsPerMm: data.pixelsPerMm, building: box, tiles }, null, 1));
console.log(name, 'building', Math.round(w / data.pixelsPerMm), 'x', Math.round(h / data.pixelsPerMm), 'mm;', tiles.map((t) => `${t.id} ${t.image.width}x${t.image.height} ${(t.bytes / 1e6).toFixed(1)}MB ${t.mmPerCropPixel.toFixed(1)}mm/px`).join(' | '));
