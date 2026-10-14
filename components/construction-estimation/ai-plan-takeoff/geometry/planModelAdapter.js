// Linework engine output -> plan model level.
//
// The engine measures walls between their own ends, so a doorway is a gap: two wall pieces on one
// line with nothing between them. In the plan model a wall runs through its doors and windows (they
// are hosted on it), so a gap the drawing confirms as an opening (a door swing, a door line, glazing)
// is bridged with wall of the host's thickness and the opening is placed on it. A gap nothing confirms
// is left open: it may be a passage, and closing it would invent a room boundary.
// Coordinates: the engine's logical plan pixels in, millimetres (pixels / pixelsPerMm) out.
import { createLevel, mergeDetections } from './planModel.js';

const toMm = (point, pixelsPerMm) => ({ x: point.x / pixelsPerMm, y: point.y / pixelsPerMm });

// Door types the vector detector names; all are doors for quantities, the type is kept as an attribute.
const DOOR_TYPES = new Set(['door', 'cavity-slider', 'sliding-door', 'garage-door', 'barn-door']);

// What a measured opening is.
export function openingKindOf(found) {
  if (found.kind === 'window') return 'window';
  if (DOOR_TYPES.has(found.kind)) return 'door';
  if (found.kind === 'opening') return 'opening';
  if (found.kind === 'wall-symbol') return 'window';
  if (/glaz/i.test(String(found.basis || '')) || found.glazed) return 'window';
  return found.confirmed === false ? 'opening' : 'door';
}

/**
 * @param geometry engine/fusion geometry ({ walls:[{id,nodes,measuredThicknessMm,category}], openings:[{id,x,y,axis,widthMm,hostThicknessMm,kind,confirmed}] })
 * @param spec     { id, name, page, pixelsPerMm } the level (pixelsPerMm is the sheet's logical px per mm)
 * @param options  { level } an existing level to merge into (estimator edits and rejections are kept); { labels } room names [{x,y,name}] in logical px;
 *                 { bridgeUnconfirmedMaxMm } also bridge gaps nothing confirms, up to this width (0 = never): the wall line
 *                 continues across them and the opening is listed as an unconfirmed 'opening' for review
 * @returns {{ level, report }}
 */
export function levelFromLinework(geometry, spec, { level = null, labels = [], bridgeUnconfirmedMaxMm = 0 } = {}) {
  const ppm = spec.pixelsPerMm;
  if (!(ppm > 0)) throw new Error('A sheet scale (pixelsPerMm) is needed to build the plan model.');
  const walls = (geometry.walls || []).filter((wall) => Array.isArray(wall.nodes) && wall.nodes.length >= 2).map((wall) => ({
    a: toMm(wall.nodes[0], ppm), b: toMm(wall.nodes[wall.nodes.length - 1], ppm),
    thicknessMm: Math.round(wall.measuredThicknessMm || wall.thicknessMm || 90), category: wall.category === 'exterior' ? 'exterior' : wall.category === 'interior' ? 'interior' : null,
    detectionKey: `linework:${wall.id}`,
  }));
  const bridges = [], openings = [];
  for (const found of geometry.openings || []) {
    if (!Number.isFinite(found.x) || !Number.isFinite(found.y)) continue;
    const centre = toMm(found, ppm);
    const kind = openingKindOf(found);
    const bridge = found.confirmed !== false || (bridgeUnconfirmedMaxMm > 0 && found.widthMm <= bridgeUnconfirmedMaxMm);
    const direction = found.direction || (found.axis === 'h' ? { x: 1, y: 0 } : found.axis === 'v' ? { x: 0, y: 1 } : null);
    if (bridge && direction && found.widthMm > 0 && !found.inWall) {
      const half = found.widthMm / 2 + 30;
      const a = { x: centre.x - direction.x * half, y: centre.y - direction.y * half };
      const b = { x: centre.x + direction.x * half, y: centre.y + direction.y * half };
      bridges.push({ a, b, thicknessMm: Math.round(found.hostThicknessMm || 90), detectionKey: `linework-bridge:${found.id}`, attributes: { spansOpening: true } });
    }
    if (!bridge || found.bridgeOnly) continue;
    openings.push({ ...centre, widthMm: Math.round(found.leafMm || found.widthMm || 0), kind, detectionKey: `linework-opening:${found.id}`,
      attributes: { ...(found.confirmed === false ? { unconfirmed: true } : {}), ...(found.kind && found.kind !== kind ? { type: found.kind } : {}), ...(found.evidence ? { evidence: found.evidence } : {}) } });
  }
  const base = level || createLevel(spec);
  const merged = mergeDetections(base, { walls: [...walls, ...bridges], openings, rooms: labels.map((label) => ({ ...toMm(label, ppm), name: label.name })) });
  return { level: merged.level, report: { ...merged.report, bridges: bridges.length, measuredWalls: walls.length } };
}
