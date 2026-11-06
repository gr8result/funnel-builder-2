// Deterministic checks run on calibrated canvas geometry, before any AI batch is admitted.
// These checks establish consistency, not visual correctness: a trace still needs review.
const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
export const segments = (nodes, closed = false) => nodes.slice(closed ? 0 : 1).map((p, i) => closed
  ? [p, nodes[(i + 1) % nodes.length]] : [nodes[i], p]);
export function distanceToLine(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export function polygonIssue(nodes) {
  if (!Array.isArray(nodes) || nodes.length < 3 || !nodes.every(finitePoint)) return 'A closed polygon needs at least three finite vertices.';
  const edges = segments(nodes, true);
  let area = 0;
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-8) return 'Polygon has a repeated vertex or zero-length edge.';
    area += a.x * b.y - b.x * a.y;
    for (let j = i + 1; j < edges.length; j++) {
      if (j === i + 1 || (i === 0 && j === edges.length - 1)) continue;
      const [c, d] = edges[j];
      const proper = cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
      if (proper || distanceToLine(c, a, b) < 1e-8 || distanceToLine(d, a, b) < 1e-8
        || distanceToLine(a, c, d) < 1e-8 || distanceToLine(b, c, d) < 1e-8) return 'Polygon crosses or touches itself.';
    }
  }
  return Math.abs(area) < 1e-8 ? 'Polygon has no area.' : null;
}
export function insideOrOn(p, nodes, tolerance = 1e-8) {
  if (segments(nodes, true).some(([a, b]) => distanceToLine(p, a, b) <= tolerance)) return true;
  let inside = false;
  for (const [a, b] of segments(nodes, true)) if ((a.y > p.y) !== (b.y > p.y)
    && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  return inside;
}
export function polygonArea(nodes, scale) {
  return Math.abs(segments(nodes, true).reduce((s, [a, b]) => s + a.x * b.y - b.x * a.y, 0)) / 2 / scale ** 2 / 1e6;
}
export function polygonPerimeter(nodes, scale) {
  return segments(nodes, true).reduce((s, [a, b]) => s + Math.hypot(a.x - b.x, a.y - b.y), 0) / scale / 1000;
}
const samples = (a, b) => [0, 0.25, 0.5, 0.75, 1].map((t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }));
export function validateGeometryModel({ canonical, context, analysis }) {
  const blockers = [];
  const add = (code, message, page) => blockers.push({ code, message, ...(page ? { page } : {}) });
  const scale = context.pixelsPerMm;
  const walls = [...(context.completedWallRuns || []), ...canonical.completedWallRuns];
  const floors = [...(context.completedFloorplans || []), ...canonical.completedFloorplans];
  const openings = [...(context.placedOpenings || []), ...canonical.placedOpenings];
  for (const p of analysis.pages.filter((p) => /floor[-_]plan/.test(p.drawingType))) {
    const page = p.page;
    const ownWalls = walls.filter((w) => Number(w.page || w.pageId || 1) === page);
    const footprints = floors.filter((a) => Number(a.page || a.pageId || 1) === page && a.type === 'Footprint');
    if (!footprints.length) add('missing-envelope', `Sheet ${page}: no closed building footprint was reconstructed.`, page);
    if (!ownWalls.some((w) => w.category === 'exterior')) add('missing-exterior', `Sheet ${page}: external walls are missing.`, page);
    if (!ownWalls.some((w) => w.category === 'interior')) add('missing-interior', `Sheet ${page}: internal partitions are missing.`, page);
    for (const a of floors.filter((a) => Number(a.page || a.pageId || 1) === page)) {
      const issue = polygonIssue(a.nodes);
      if (issue) { add('invalid-polygon', `${a.label || a.type}: ${issue}`, page); continue; }
      if (a.type !== 'Footprint' && footprints.length && !segments(a.nodes, true).every(([a, b]) =>
        samples(a, b).every((point) => footprints.some((f) => insideOrOn(point, f.nodes, 100 * scale))))) {
        add('area-outside-envelope', `${a.label || a.type} extends outside the building footprint.`, page);
      }
    }
    for (const w of ownWalls) {
      if (footprints.length && segments(w.nodes).some(([a, b]) => samples(a, b).some((point) =>
        !footprints.some((f) => insideOrOn(point, f.nodes, 150 * scale))))) add('wall-outside-envelope', `Wall ${w.ai?.detectionId || w.id} runs outside the footprint.`, page);
      if (w.category !== 'exterior') continue;
      for (const end of [w.nodes[0], w.nodes.at(-1)]) {
        const connected = ownWalls.some((other) => other !== w && segments(other.nodes).some(([a, b]) => distanceToLine(end, a, b) <= 150 * scale));
        const closesItself = w.nodes.length > 2 && Math.hypot(w.nodes[0].x - w.nodes.at(-1).x, w.nodes[0].y - w.nodes.at(-1).y) <= 150 * scale;
        if (!connected && !closesItself) add('disconnected-exterior', `External wall ${w.ai?.detectionId || w.id} has an unconnected endpoint.`, page);
      }
    }
  }
  for (const o of openings) {
    const hostId = o.hostWallId ?? o.wallId;
    const host = walls.find((w) => String(w.id) === String(hostId) && Number(w.page || w.pageId || 1) === Number(o.page || o.pageId || 1));
    if (!host || !segments(host.nodes).some(([a, b]) => distanceToLine(o, a, b) <= 150 * scale)) add('unhosted-opening', `Opening ${o.itemTag || o.ai?.detectionId || o.id} is not attached to a wall on its sheet.`, o.page);
  }
  for (const b of analysis.benchmarks || []) if (b.measured === null && /m[²2]|sqm/i.test(b.unit)) {
    add('missing-benchmark-area', `${b.label}: no measured polygon could be reconciled with the drawing's ${b.value} ${b.unit}.`, b.page);
  }
  const structuralCodes = new Set(['benchmark-discrepancy', 'withheld', 'not-added', 'possible-missing-walls', 'possible-missing-openings', 'host-ambiguous', 'unhosted', 'sheet-failed', 'inspection-failed', 'refinement-failed', 'duplicate-level', 'unassigned-level', 'evidence-conflict']);
  for (const r of analysis.review || []) if (structuralCodes.has(r.code)) add(r.code, r.message, r.page);
  if (!analysis.pages.some((p) => /floor[-_]plan/.test(p.drawingType))) add('missing-floor-plan', 'No measured plan pages are available.');
  const unique = [...new Map(blockers.map((b) => [`${b.page}|${b.code}|${b.message}`, b])).values()];
  return { version: 1, passed: unique.length === 0, blockers: unique };
}

export function geometrySignature(collections, scale) {
  const keys = ['completedWallRuns', 'placedOpenings', 'completedFloorplans', 'completedAreas', 'completedEaves', 'completedPillars'];
  const fields = ['x', 'y', 'widthMm', 'heightMm', 'hostWallId', 'thicknessMm', 'wallHeightM', 'widthMm', 'coreWidthMm', 'coreDepthMm', 'heightMm', 'quantity'];
  return JSON.stringify([scale, ...keys.map((key) => (collections[key] || []).filter((item) => !item.ai?.scopeDerived).map((item) => ({
    id: String(item.id ?? ''), page: Number(item.page || item.pageId || 1), nodes: item.nodes || null,
    type: key === 'completedFloorplans' ? item.type : null,
    ...Object.fromEntries([...new Set(fields)].map((field) => [field, field === 'quantity' ? (['placedOpenings', 'completedPillars'].includes(key) ? Number(item.quantity ?? item.qty ?? 1) : null) : item[field] ?? null])),
  })).sort((a, b) => a.id.localeCompare(b.id)))]);
}

export function signatureFromSchedule(schedule) {
  const collections = { completedWallRuns: [], placedOpenings: [], completedFloorplans: [], completedAreas: [], completedEaves: [], completedPillars: [] };
  const kinds = { wall: 'completedWallRuns', opening: 'placedOpenings', floorArea: 'completedFloorplans', floorFinish: 'completedAreas', roofArea: 'completedAreas', eave: 'completedEaves', pillar: 'completedPillars' };
  for (const item of schedule.measurementRecords || []) if (kinds[item.kind]) {
    const copy = { ...item };
    // Measurement records add derived quantities; these are not saved object quantities.
    if (!['opening', 'pillar'].includes(item.kind)) delete copy.quantity;
    collections[kinds[item.kind]].push(copy);
  }
  return geometrySignature(collections, schedule.project?.calibratedScaleBySheet?.[0]?.pixelsPerMm);
}

export function assertTakeoffImportable(analysis, currentSignature = null) {
  if (!analysis || analysis.status === 'rooms') return;
  if (!analysis.geometryValidation?.passed) throw new Error('AI geometry has not passed validation. Correct the plan reconstruction and rerun AI Takeoff before importing quantities.');
  if (currentSignature && analysis.geometrySignature !== currentSignature) throw new Error('Takeoff geometry or calibration changed after validation. Rerun AI Takeoff before importing quantities.');
  if (!analysis.scopeResult?.complete) throw new Error('AI Takeoff scope is incomplete. Resolve the required roof, eaves and room finish items before importing quantities.');
}
