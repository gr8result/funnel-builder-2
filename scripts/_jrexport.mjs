// Scratch: run the engine (linework + fusion) on one plan image and export walls/openings/rooms in image pixels, plus a JPEG of the sheet.
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';
const [png, ppmArg, labelsFile, out] = process.argv.slice(2);
const image = await loadImage(fs.readFileSync(png)); const stored = Number(ppmArg);
const canvas = createCanvas(image.width, image.height); const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, image.width, image.height); g.drawImage(image, 0, 0);
const raster = g.getImageData(0, 0, image.width, image.height); raster.storedPixelsPerMm = stored;
const sheet = { pageNumber: 1, logicalWidth: image.width, logicalHeight: image.height, pixelsPerMm: stored };
const labels = JSON.parse(fs.readFileSync(labelsFile, 'utf8'));
const fused = fuseSheetLinework({ page: 1, walls: [], openings: [], rooms: labels.map((l) => ({ page: 1, name: l.name, x: l.x / image.width, y: l.y / image.height, basis: 'OBSERVED', confidence: 0.95, evidence: 'Room name from the PDF text layer.' })) }, raster, sheet);
const r = fused.geometry; const round = (v) => Math.round(v * 10) / 10;
const data = {
  width: image.width, height: image.height, pixelsPerMm: stored, engine: r.engine,
  walls: r.walls.map((w) => ({ id: w.id, category: w.category || 'unclassified', axis: w.axis, a: { x: round(w.nodes[0].x), y: round(w.nodes[0].y) }, b: { x: round(w.nodes[1].x), y: round(w.nodes[1].y) }, lengthMm: Math.round(w.lengthMm), thicknessMm: Math.round(w.thicknessMm || 0), confirmed: !w.reviewRequired, reason: w.reviewReason || '' })),
  openings: r.openings.map((o) => ({ kind: o.kind, basis: o.basis, confirmed: Boolean(o.confirmed), x: round(o.x), y: round(o.y), axis: o.axis, widthMm: o.widthMm })),
  rooms: fused.response.rooms.filter((rm) => Array.isArray(rm.polygon) && rm.polygon.length >= 3).map((rm) => ({ name: rm.name, areaM2: rm.lineworkAreaM2 ?? null, verified: Boolean(rm.lineworkVerified), polygon: rm.polygon.map((p) => ({ x: round(p.x * image.width), y: round(p.y * image.height) })) })),
  unbounded: fused.response.rooms.filter((rm) => !(Array.isArray(rm.polygon) && rm.polygon.length >= 3)).map((rm) => rm.name),
};
fs.writeFileSync(out + '.json', JSON.stringify(data));
fs.writeFileSync(out + '.jpg', canvas.toBuffer('image/jpeg', 82));
console.log(out, 'walls', data.walls.length, 'unconfirmed walls', data.walls.filter((w) => !w.confirmed).length, 'cats', JSON.stringify(data.walls.reduce((m, w) => (m[w.category] = (m[w.category] || 0) + 1, m), {})), 'openings', data.openings.length, 'rooms', data.rooms.length, 'jpg', fs.statSync(out + '.jpg').size);
