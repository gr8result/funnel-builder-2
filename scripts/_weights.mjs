// Scratch: face-line weights of wall-band strips (are joinery lines lighter than wall lines?).
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { detectPlanGeometry } from '../components/construction-estimation/ai-plan-takeoff/geometry/planGeometry.js';
const [png, ppmArg, lw = '595'] = process.argv.slice(2);
const image = await loadImage(fs.readFileSync(png));
const canvas = createCanvas(image.width, image.height); const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, image.width, image.height); g.drawImage(image, 0, 0);
const raster = g.getImageData(0, 0, image.width, image.height);
const logicalWidth = Number(lw), logicalHeight = logicalWidth * image.height / image.width;
const r = detectPlanGeometry(raster, { pixelsPerMm: Number(ppmArg), logicalWidth, logicalHeight });
const { width, bandH, bandV, bounds } = r.debug; const k = r.rasterPixelsPerMm;
const ink = (x, y) => { const p = (y * width + x) * 4; return raster.data[p] + raster.data[p + 1] + raster.data[p + 2] < 630; };
const rows = [];
for (const [band, vertical] of [[bandH, false], [bandV, true]]) {
  const seen = new Uint8Array(band.length);
  for (let y = bounds.y0; y <= bounds.y1; y += 1) for (let x = bounds.x0; x <= bounds.x1; x += 1) {
    const p = y * width + x; if (!band[p] || seen[p]) continue;
    const stack = [p]; seen[p] = 1; let minX = x, maxX = x, minY = y, maxY = y, area = 0;
    while (stack.length) { const q = stack.pop(); area += 1; const qx = q % width, qy = (q - qx) / width; if (qx < minX) minX = qx; if (qx > maxX) maxX = qx; if (qy < minY) minY = qy; if (qy > maxY) maxY = qy;
      for (const n of [q - 1, q + 1, q - width, q + width]) if (band[n] && !seen[n]) { seen[n] = 1; stack.push(n); } }
    const along = vertical ? maxY - minY + 1 : maxX - minX + 1;
    // Weight of each face: ink run length across the band edge, averaged along the strip.
    let low = 0, high = 0, n = 0;
    for (let s = 0; s < along; s += 2) {
      const a = (vertical ? minY : minX) + s;
      const run = (start, dir) => { let c = start, count = 0; while (count < 12 && ink(vertical ? c : a, vertical ? a : c)) { count += 1; c += dir; } return count; };
      // faces lie at the band's low and high edges; walk inward a little to find ink then measure the run outward+inward
      const lowEdge = vertical ? minX : minY, highEdge = vertical ? maxX : maxY;
      const lw2 = run(lowEdge, 1) + run(lowEdge - 1, -1), hw = run(highEdge, -1) + run(highEdge + 1, 1);
      if (lw2 && hw) { low += lw2; high += hw; n += 1; }
    }
    if (n) rows.push({ vertical, lengthMm: Math.round(along / k), thick: +(area / along).toFixed(1), low: +(low / n).toFixed(1), high: +(high / n).toFixed(1), x: Math.round(minX / (width / logicalWidth)), y: Math.round(minY / (width / logicalWidth)) });
  }
}
const long = rows.filter((row) => row.lengthMm >= 2000);
const hist = (list) => list.reduce((m, row) => { const key = Math.min(row.low, row.high).toFixed(0); m[key] = (m[key] || 0) + 1; return m; }, {});
console.log('long strips (>=2 m): lighter-face weight histogram', JSON.stringify(hist(long)));
console.log('short strips (<1.2 m): lighter-face weight histogram', JSON.stringify(hist(rows.filter((row) => row.lengthMm < 1200))));
console.log(rows.filter((row) => row.lengthMm < 1200 && Math.min(row.low, row.high) < 2).map((row) => `${row.vertical ? 'v' : 'h'} L${row.lengthMm} t${row.thick} w${row.low}/${row.high} @${row.x},${row.y}`).join(' | '));
