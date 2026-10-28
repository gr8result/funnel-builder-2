// Scratch: engine + fusion + wall paths for one sheet; exports paths, traced walls, rooms and a JPEG.
// node scripts/_paths.mjs <page.png | stored-page.txt> <stored px/mm> <labels.json|-> <saved response.json|-> <page number> <out prefix>
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';
import { buildWallPaths } from '../components/construction-estimation/ai-plan-takeoff/geometry/wallPaths.js';
const [source, ppmArg, labelsFile, responseFile, pageArg, out] = process.argv.slice(2);
const bytes = source.endsWith('.txt') ? (() => { const text = fs.readFileSync(source, 'utf8').trim(); return Buffer.from(text.slice(text.indexOf(',') + 1), 'base64'); })() : fs.readFileSync(source);
const image = await loadImage(bytes); const stored = Number(ppmArg);
const ratio = Math.abs(stored / 0.09 - 1) > 0.1 ? Math.max(0.35, Math.min(2.5, 0.09 / stored)) : 1;
const w = Math.round(image.width * ratio), h = Math.round(image.height * ratio);
const canvas = createCanvas(w, h); const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.imageSmoothingQuality = 'high'; g.drawImage(image, 0, 0, w, h);
const raster = g.getImageData(0, 0, w, h); raster.storedPixelsPerMm = stored;
const sheet = { pageNumber: Number(pageArg), logicalWidth: image.width, logicalHeight: image.height, pixelsPerMm: stored };
let response = { page: Number(pageArg), walls: [], openings: [], rooms: [] };
if (responseFile !== '-') { const find = (o, d = 0) => { if (!o || typeof o !== 'object' || d > 5) return null; if (Array.isArray(o.walls) && (o.openings || o.rooms)) return o; for (const v of Object.values(o)) { const f = find(v, d + 1); if (f) return f; } return null; }; const found = find(JSON.parse(fs.readFileSync(responseFile, 'utf8'))); response = { page: Number(pageArg), walls: found.walls || [], openings: found.openings || [], rooms: found.rooms || [] }; }
if (labelsFile !== '-') response.rooms = [...response.rooms, ...JSON.parse(fs.readFileSync(labelsFile, 'utf8')).map((l) => ({ page: Number(pageArg), name: l.name, x: l.x / image.width, y: l.y / image.height, basis: 'OBSERVED', confidence: 0.95, evidence: 'Room name from the PDF text layer.' }))];
const fused = fuseSheetLinework(response, raster, sheet);
const r = fused.geometry;
const reading = (response.walls || []).map((wall) => ({ ...wall, nodes: (wall.nodes || []).map((p) => ({ x: p.x * image.width, y: p.y * image.height })) }));
const { paths, traced } = buildWallPaths({ walls: r.walls, openings: r.openings, pixelsPerMm: stored, reading });
const round = (v) => Math.round(v * 10) / 10; const pt = (p) => ({ x: round(p.x), y: round(p.y) });
const data = { width: image.width, height: image.height, pixelsPerMm: stored,
  segments: r.walls.map((wall) => ({ category: wall.category, a: pt(wall.nodes[0]), b: pt(wall.nodes[1]), thicknessMm: Math.round(wall.thicknessMm || 90) })),
  paths: paths.map((path) => ({ ...path, nodes: path.nodes.map(pt), openings: path.openings.map((o) => ({ ...o, x: round(o.x), y: round(o.y) })) })),
  traced: traced.map((item) => ({ ...item, nodes: item.nodes.map(pt) })),
  rooms: fused.response.rooms.filter((room) => room.polygon?.length >= 3).map((room) => ({ name: room.name, areaM2: room.lineworkAreaM2 ?? null, verified: Boolean(room.lineworkVerified), polygon: room.polygon.map((p) => pt({ x: p.x * image.width, y: p.y * image.height })) })),
  unbounded: fused.response.rooms.filter((room) => !(room.polygon?.length >= 3)).map((room) => room.name) };
fs.writeFileSync(out + '.json', JSON.stringify(data));
const view = createCanvas(image.width, image.height); const vg = view.getContext('2d'); vg.fillStyle = '#fff'; vg.fillRect(0, 0, image.width, image.height); vg.drawImage(image, 0, 0);
fs.writeFileSync(out + '.jpg', view.toBuffer('image/jpeg', 82));
const lm = (list, cat) => (list.filter((p) => p.category === cat && !p.isolated).reduce((s, p) => s + p.lengthMm, 0) / 1000).toFixed(1);
console.log(out.split('/').pop(), `segments ${r.walls.length} -> paths ${paths.filter((p) => !p.isolated).length} (+${paths.filter((p) => p.isolated).length} set aside) | ext ${lm(paths, 'exterior')} m int ${lm(paths, 'interior')} m | openings in paths ${paths.reduce((s, p) => s + p.openings.length, 0)} | traced ${traced.length}, supported >=70% ${traced.filter((t) => t.supportedShare >= 0.7).length}`);
