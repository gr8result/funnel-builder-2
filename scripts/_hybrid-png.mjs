import fs from 'node:fs'; import { createCanvas, loadImage } from '@napi-rs/canvas';
const [png, anchorFile, tilesFile, out] = process.argv.slice(2);
const image = await loadImage(fs.readFileSync(png)); const a = JSON.parse(fs.readFileSync(anchorFile, 'utf8')); const b = JSON.parse(fs.readFileSync(tilesFile, 'utf8')).building;
const z = 0.75, c = createCanvas(Math.round((b.x1 - b.x0) * z), Math.round((b.y1 - b.y0) * z)), g = c.getContext('2d');
g.setTransform(z, 0, 0, z, -b.x0 * z, -b.y0 * z); g.drawImage(image, 0, 0); g.lineCap = 'butt';
const col = (k) => (k === 'external' || k === 'exterior' ? '210,31,31' : k === 'retaining' ? '142,68,173' : k === 'unsure' ? '107,114,128' : '31,91,210');
for (const e of a.engine) { g.strokeStyle = `rgba(${col(e.category)},0.28)`; g.lineWidth = 12; g.beginPath(); g.moveTo(e.a.x, e.a.y); g.lineTo(e.b.x, e.b.y); g.stroke(); }
for (const t of a.traced) { g.strokeStyle = `rgb(${col(t.kind)})`; g.lineWidth = 2.5; g.setLineDash(t.uncertain ? [8, 5] : []); g.beginPath(); g.moveTo(t.a.x, t.a.y); g.lineTo(t.b.x, t.b.y); g.stroke(); }
fs.writeFileSync(out, c.toBuffer('image/png'));
