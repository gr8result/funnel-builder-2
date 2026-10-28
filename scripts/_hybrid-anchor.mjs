// Scratch: map the hybrid run's crop-relative wall paths back to the sheet, merge the overlaps, and measure
// each traced wall against the engine's measured wall linework (no forcing: a traced wall with no parallel
// linework within reach stays unmatched).
// node scripts/_hybrid-anchor.mjs <responses dir> <tiles.json> <engine export.json> <out.json>
import fs from 'node:fs';
const [dir, tilesFile, exportFile, out] = process.argv.slice(2);
const { tiles } = JSON.parse(fs.readFileSync(tilesFile, 'utf8'));
const engine = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
const k = engine.pixelsPerMm;
const toSheet = (tile, p) => ({ x: tile.sheet.x + p.x * tile.sheet.width, y: tile.sheet.y + p.y * tile.sheet.height });
const segments = [], openings = [], notWalls = [];
for (const tile of tiles) {
  const file = `${dir}/${tile.id}.json`;
  if (!fs.existsSync(file)) continue;
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!saved.result) continue;
  // Points the model put on the crop's own edge are where the crop cut the wall, not where it ends.
  for (const wall of saved.result.walls) for (let i = 0; i + 1 < wall.path.length; i += 1) {
    const a = toSheet(tile, wall.path[i]), b = toSheet(tile, wall.path[i + 1]);
    if (Math.hypot(b.x - a.x, b.y - a.y) / k < 150) continue;
    segments.push({ tile: tile.id, wallId: wall.id, kind: wall.kind, uncertain: wall.uncertain, thickness: wall.thickness, note: wall.note, a, b });
  }
  for (const opening of saved.result.openings) openings.push({ tile: tile.id, kind: opening.kind, uncertain: opening.uncertain, a: toSheet(tile, opening.start), b: toSheet(tile, opening.end) });
  for (const item of saved.result.notWalls) notWalls.push({ tile: tile.id, kind: item.kind, note: item.note, at: toSheet(tile, item.at) });
}
// Orientation: near-level, near-plumb or angled.
const orient = (s) => { const dx = Math.abs(s.b.x - s.a.x), dy = Math.abs(s.b.y - s.a.y); return dy <= dx * 0.08 ? 'h' : dx <= dy * 0.08 ? 'v' : 'd'; };
const span = (s, axis) => (axis === 'h' ? [Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x), (s.a.y + s.b.y) / 2] : [Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y), (s.a.x + s.b.x) / 2]);
// One wall traced in two overlapping crops is one wall: merge parallel traces on one line that overlap.
const merged = [];
for (const s of segments) {
  const axis = orient(s);
  if (axis === 'd') { merged.push({ ...s, axis, tiles: [s.tile] }); continue; }
  const [s0, s1, c] = span(s, axis);
  const twin = merged.find((m) => m.axis === axis && m.kind === s.kind && Math.abs(m.c - c) <= 150 * k && Math.min(m.s1, s1) - Math.max(m.s0, s0) > -100 * k);
  if (twin) { twin.s0 = Math.min(twin.s0, s0); twin.s1 = Math.max(twin.s1, s1); twin.c = (twin.c + c) / 2; twin.tiles.push(s.tile); twin.uncertain = twin.uncertain && s.uncertain; continue; }
  merged.push({ ...s, axis, s0, s1, c, tiles: [s.tile] });
}
for (const m of merged) if (m.axis !== 'd') { m.a = m.axis === 'h' ? { x: m.s0, y: m.c } : { x: m.c, y: m.s0 }; m.b = m.axis === 'h' ? { x: m.s1, y: m.c } : { x: m.c, y: m.s1 }; }
// Anchor each traced wall to the engine's measured linework: parallel segments whose centreline is within
// reach, overlapping along it. The offset is how far the trace lies from the drawn wall.
const REACH = 400 * k;
const engineSegs = engine.segments.map((s, index) => ({ ...s, index, axis: orient(s) }));
const usedEngine = new Map();
for (const m of merged) {
  m.lengthMm = Math.round(Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y) / k);
  if (m.axis === 'd') { m.match = null; continue; }
  let covered = 0, weighted = 0;
  for (const e of engineSegs) {
    if (e.axis !== m.axis) continue;
    const [e0, e1, ec] = span(e, m.axis);
    if (Math.abs(ec - m.c) > REACH) continue;
    const overlap = Math.min(e1, m.s1) - Math.max(e0, m.s0);
    if (overlap <= 0) continue;
    covered += overlap; weighted += overlap * (ec - m.c);
    usedEngine.set(e.index, (usedEngine.get(e.index) || 0) + overlap);
  }
  const share = covered / Math.max(1, m.s1 - m.s0);
  m.match = covered ? { share: +Math.min(1, share).toFixed(2), offsetMm: Math.round(Math.abs(weighted / covered) / k), snappedC: m.c + weighted / covered } : null;
}
const engineOut = engineSegs.map((e) => { const [e0, e1] = e.axis === 'd' ? [0, 1] : span(e, e.axis); return { ...e, tracedShare: e.axis === 'd' ? 0 : +Math.min(1, (usedEngine.get(e.index) || 0) / Math.max(1, e1 - e0)).toFixed(2), lengthMm: Math.round(Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) / k) }; });
const sum = (list) => Math.round(list.reduce((s, x) => s + x.lengthMm, 0) / 100) / 10;
const walls = merged.filter((m) => m.kind !== 'retaining');
const offsets = walls.filter((m) => m.match && m.match.share >= 0.5).map((m) => m.match.offsetMm).sort((a, b) => a - b);
const stats = {
  responses: tiles.filter((t) => fs.existsSync(`${dir}/${t.id}.json`)).length,
  tracedWalls: walls.length, tracedLm: sum(walls), retainingTraced: merged.filter((m) => m.kind === 'retaining').length,
  tracedOnLinework: walls.filter((m) => m.match && m.match.share >= 0.5).length, tracedOnLineworkLm: sum(walls.filter((m) => m.match && m.match.share >= 0.5)),
  tracedWithoutLinework: walls.filter((m) => !m.match || m.match.share < 0.5).length, tracedWithoutLineworkLm: sum(walls.filter((m) => !m.match || m.match.share < 0.5)),
  medianOffsetMm: offsets.length ? offsets[offsets.length >> 1] : null, within100mm: offsets.filter((o) => o <= 100).length, within200mm: offsets.filter((o) => o <= 200).length,
  engineWalls: engineOut.length, engineLm: sum(engineOut), engineNotTraced: engineOut.filter((e) => e.tracedShare < 0.3).length, engineNotTracedLm: sum(engineOut.filter((e) => e.tracedShare < 0.3)),
  openings: openings.length, notWalls: notWalls.length,
};
fs.writeFileSync(out, JSON.stringify({ stats, traced: merged, engine: engineOut, openings, notWalls }));
console.log(JSON.stringify(stats));
