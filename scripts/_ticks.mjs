// Scratch: columns with long vertical ink runs in a horizontal strip (dimension ticks). node scripts/_ticks.mjs <png> y0 y1 x0 x1 minRun
import fs from 'node:fs'; import { createCanvas, loadImage } from '@napi-rs/canvas';
const [png, y0, y1, x0, x1, minRun] = process.argv.slice(2).map((v, i) => (i ? Number(v) : v));
const image = await loadImage(fs.readFileSync(png)); const c = createCanvas(image.width, image.height); const g = c.getContext('2d'); g.drawImage(image, 0, 0);
const d = g.getImageData(0, 0, image.width, image.height).data; const dark = (x, y) => d[(y * image.width + x) * 4] < 128;
const cols = []; for (let x = x0; x <= x1; x += 1) { let run = 0, best = 0; for (let y = y0; y <= y1; y += 1) { run = dark(x, y) ? run + 1 : 0; best = Math.max(best, run); } if (best >= minRun) cols.push(x); }
const groups = []; for (const x of cols) { if (groups.length && x - groups.at(-1).at(-1) <= 2) groups.at(-1).push(x); else groups.push([x]); }
console.log(groups.map((g) => ((g[0] + g.at(-1)) / 2).toFixed(1)).join(' '));
