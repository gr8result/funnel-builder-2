import { polygonIssue, polygonArea, polygonPerimeter, insideOrOn, segments, distanceToLine } from './geometryValidation.js';

export const INCLUSION_SCHEDULES = ['Classic', 'Premier', 'Premium'];
export const ROOM_GROUPS = ['Bedrooms', 'Wet areas', 'Living areas', 'Outdoor areas', 'Garage / storage'];
export const ROOF_CATEGORIES = ['Eaves / soffits', 'Fascia', 'Gutters', 'Downpipes', 'Ridges', 'Hips', 'Valleys'];
export const FLOOR_FINISHES = ['Tiles', 'Hybrid', 'Carpets', 'Polished Concrete', 'exposed Agg', 'None'];
const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const roomScopeKey = (room) => `${room.page}:${room.x}:${room.y}:${key(room.name)}`;
export function roomGroup(name) {
  const n = key(name);
  if (/\b(bed|bedroom|master|wir|walk in robe|robe)\b/.test(n)) return 'Bedrooms';
  if (/\b(bath|bathroom|ens|ensuite|wc|powder|laundry|ldry)\b/.test(n)) return 'Wet areas';
  if (/\b(alfresco|patio|porch|balcony|deck|verandah)\b/.test(n)) return 'Outdoor areas';
  if (/\b(garage|workshop|store|storage|carport)\b/.test(n)) return 'Garage / storage';
  return 'Living areas';
}
// Schedule names carry no universal specification. The builder must supply the actual rules.
export function emptyScopeProfile(schedule = '') {
  return { version: 1, schedule, rules: ROOM_GROUPS.map((group) => ({ group, floorFinish: '', wallTiling: '', wallTileHeightMm: null, showerTileHeightMm: null, splashback: '' })), overrides: [], roofNotApplicable: [] };
}
export function sanitizeScopeProfile(value) {
  if (!value || !INCLUSION_SCHEDULES.includes(value.schedule)) return emptyScopeProfile();
  const clean = (r) => ({ group: ROOM_GROUPS.includes(r.group) ? r.group : '', roomName: String(r.roomName || '').slice(0, 120), roomKey: String(r.roomKey || '').slice(0, 200),
    floorFinish: FLOOR_FINISHES.includes(r.floorFinish) ? r.floorFinish : '',
    wallTiling: ['none', 'standard', 'perimeter', 'full-height'].includes(r.wallTiling) ? r.wallTiling : '',
    wallTileHeightMm: Number(r.wallTileHeightMm) > 0 && Number(r.wallTileHeightMm) <= 6000 ? Number(r.wallTileHeightMm) : null,
    showerTileHeightMm: Number(r.showerTileHeightMm) > 0 && Number(r.showerTileHeightMm) <= 6000 ? Number(r.showerTileHeightMm) : null,
    splashback: ['none', 'measured'].includes(r.splashback) ? r.splashback : '' });
  return { version: 1, schedule: value.schedule, rules: (Array.isArray(value.rules) ? value.rules : []).slice(0, 20).map(clean),
    roofNotApplicable: (Array.isArray(value.roofNotApplicable) ? value.roofNotApplicable : []).filter((c) => ROOF_CATEGORIES.includes(c)),
    overrides: (Array.isArray(value.overrides) ? value.overrides : []).slice(0, 150).map(clean) };
}
export function scopeRuleFor(profile, room) {
  return profile.overrides.find((r) => r.roomKey ? r.roomKey === roomScopeKey(room) : key(r.roomName) === key(room.name)) || profile.rules.find((r) => r.group === roomGroup(room.name));
}
export function buildInclusionScope({ profile, rooms = [], roofMeasurements = [], context, geometryValidation, canonical, planEvidence = {}, projectDefaults = {} }) {
  profile = sanitizeScopeProfile(profile);
  const checklist = [], quantities = [], areas = [];
  const check = (category, passed, reason = '') => {
    const excluded = profile.roofNotApplicable.includes(category);
    checklist.push({ category, passed: Boolean(passed || excluded), notApplicable: excluded, reason: passed || excluded ? '' : reason });
  };
  check('Inclusion schedule', INCLUSION_SCHEDULES.includes(profile.schedule), 'Select Classic, Premier or Premium and configure the builder rules.');
  check('Validated geometry', geometryValidation?.passed, 'The building geometry must pass validation before finishes can be calculated.');
  const walls = [...(context.completedWallRuns || []), ...canonical.completedWallRuns];
  const openings = [...(context.placedOpenings || []), ...canonical.placedOpenings];
  check('Opening dimensions', openings.every((o) => Number(o.widthMm) > 0 && Number(o.heightMm) > 0), 'Every opening needs a documented width and height before deductions are imported.');
  check('Wall construction', walls.length && walls.every((w) => w.constructionSystem && w.constructionSystem !== 'unclassified'), 'Unclassified walls require a documented construction system.');
  check('Wall heights / plaster / insulation', walls.length && walls.every((w) => Number(w.wallHeightM) > 0 || Number(projectDefaults.levels?.[w.level]?.ceilingHeightMm) > 0), 'Known heights are required for every included level before wall linings and insulation can be calculated.');
  const roofs = [...(context.completedAreas || []), ...canonical.completedAreas].filter((a) => a.category === 'Roof Area');
  const pitch = planEvidence.roofPitchDegrees ?? projectDefaults.roofPitchDegrees;
  check('Roof plan area', roofs.length, 'Roof outline is missing. Supply a readable roof plan; floor footprint is not a roof outline.');
  const pitchKnown = Number.isFinite(pitch) && pitch >= 0 && pitch < 80;
  check('Roof covering', roofs.length && pitchKnown, 'A documented roof pitch and roof outline are required; mixed pitches require separately measured roof faces.');
  if (geometryValidation?.passed && pitchKnown) for (const roof of roofs) quantities.push({ category: 'Roof covering', page: roof.page, level: roof.level,
    quantity: polygonArea(roof.nodes, context.pixelsPerMm) / Math.cos(pitch * Math.PI / 180), unit: 'm2', basis: 'DERIVED', evidence: `Projected roof area / cos(${pitch}°). Verify that this pitch applies to every face.` });
  const eaves = [...(context.completedEaves || []), ...canonical.completedEaves];
  check('Eaves / soffits', eaves.length && eaves.every((e) => Number(e.widthMm) > 0), 'Eave runs and documented widths are required.');
  // Eave edges are not evidence of gutters on gable edges, fascia on every edge, or downpipe counts.
  for (const category of ['Fascia', 'Gutters', 'Downpipes', 'Ridges', 'Hips', 'Valleys']) {
    const measured = roofMeasurements.filter((m) => m.type === category && m.quantity > 0);
    check(category, measured.length, `${category} needs a separately measured roof schedule; it cannot be inferred from all eave edges. If absent by design, record that in the roof specification.`);
    if (geometryValidation?.passed) for (const m of measured) quantities.push({ category, page: m.page, level: m.level, quantity: m.quantity,
      unit: category === 'Downpipes' ? 'No' : 'lm', basis: 'DERIVED', evidence: m.evidence });
  }
  check('Room boundaries', rooms.length, 'No bounded rooms were measured.');
  const measuredRooms = [];
  for (const room of rooms) {
    const page = context.pages.find((p) => p.pageNumber === room.page);
    const nodes = page && Array.isArray(room.nodes) ? room.nodes.map((p) => ({ x: p.x * page.logicalWidth, y: p.y * page.logicalHeight })) : [];
    const issue = polygonIssue(nodes);
    const valid = !issue && room.basis !== 'ASSUMED' && room.confidence >= 0.7;
    check(`${room.name}: boundary`, valid, issue || 'Room geometry confidence is below the admission threshold.');
    if (valid) measuredRooms.push({ ...room, nodes });
  }
  const floors = [...(context.completedFloorplans || []), ...canonical.completedFloorplans];
  for (const room of measuredRooms) {
    const footprints = floors.filter((f) => f.page === room.page && f.type === 'Footprint');
    if (footprints.length && !segments(room.nodes, true).every(([a, b]) => [a, b, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }].every((p) => footprints.some((f) => insideOrOn(p, f.nodes, context.pixelsPerMm * 100))))) {
      room.overlap = true; check(`${room.name}: envelope containment`, false, 'Room boundary runs outside the measured building footprint.');
    }
  }
  for (const page of [...new Set(floors.filter((f) => f.type === 'Footprint').map((f) => f.page))]) {
    const footprintArea = floors.filter((f) => f.page === page && f.type === 'Footprint').reduce((sum, f) => sum + polygonArea(f.nodes, context.pixelsPerMm), 0);
    const roomArea = measuredRooms.filter((r) => r.page === page).reduce((sum, r) => sum + polygonArea(r.nodes, context.pixelsPerMm), 0);
    check(`Sheet ${page}: room coverage`, Math.abs(roomArea - footprintArea) <= Math.max(1, footprintArea * 0.05), `Room boundaries cover ${roomArea.toFixed(2)} m² against ${footprintArea.toFixed(2)} m² of footprint. Missing or overlapping room zones require review; wall footprints allow a 5% tolerance.`);
  }
  // Reject overlapping room interiors, including containment; shared boundaries are permitted.
  for (let i = 0; i < measuredRooms.length; i++) for (let j = i + 1; j < measuredRooms.length; j++) {
    const a = measuredRooms[i], b = measuredRooms[j];
    if (a.page !== b.page) continue;
    const strictlyInside = (p, polygon) => insideOrOn(p, polygon) && !segments(polygon, true).some(([x, y]) => distanceToLine(p, x, y) < 1e-6);
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const overlap = a.nodes.some((p) => strictlyInside(p, b.nodes)) || b.nodes.some((p) => strictlyInside(p, a.nodes))
      || segments(a.nodes, true).some(([p, q]) => segments(b.nodes, true).some(([r, s]) => cross(p, q, r) * cross(p, q, s) < 0 && cross(r, s, p) * cross(r, s, q) < 0))
      || segments(a.nodes, true).some(([x, y]) => strictlyInside({ x: (x.x + y.x) / 2, y: (x.y + y.y) / 2 }, b.nodes))
      || (a.nodes.length === b.nodes.length && a.nodes.every((p) => b.nodes.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6)));
    if (overlap) { a.overlap = true; b.overlap = true; check(`${a.name} / ${b.name}: room overlap`, false, 'Room floor boundaries overlap; finishes are withheld.'); }
  }
  for (const room of rooms) {
    const measured = measuredRooms.find((r) => r === room || (r.page === room.page && r.x === room.x && r.y === room.y && r.name === room.name));
    const rule = scopeRuleFor(profile, room);
    const group = roomGroup(room.name);
    check(`${room.name}: floor finish`, rule?.floorFinish, 'The selected inclusion schedule has no floor finish rule for this room.');
    const wet = group === 'Wet areas';
    if (wet) check(`${room.name}: wall tiling rule`, rule?.wallTiling, 'Set no wall tiles, perimeter height in mm, or full height.');
    const splashbackRoom = /kitchen|laundry|ldry|butler|pantry/i.test(room.name);
    if (splashbackRoom) check(`${room.name}: splashback rule`, rule?.splashback, 'Confirm whether this room includes a measured splashback.');
    if (!geometryValidation?.passed || !measured || measured.overlap) continue;
    const area = polygonArea(measured.nodes, context.pixelsPerMm);
    if (rule?.floorFinish && rule.floorFinish !== 'None') {
      const id = `scope:${encodeURIComponent(context.jobId)}:${encodeURIComponent(context.takeoffId)}:${context.documentHash}:${room.page}:${room.x}:${room.y}`;
      areas.push({ id, page: room.page, level: room.level, source: 'ai', category: rule.floorFinish, nodes: measured.nodes, exclusions: [],
        ai: { scopeDerived: true, documentHash: context.documentHash, scopeSchedule: profile.schedule, detectionId: id } });
      quantities.push({ category: rule.floorFinish, room: room.name, page: room.page, level: room.level, quantity: area, unit: 'm2', basis: 'DERIVED', evidence: `${profile.schedule} rule applied to the measured room polygon.` });
    }
    if (wet && rule?.wallTiling && rule.wallTiling !== 'none') {
      const height = rule.wallTiling === 'full-height'
        ? (room.ceilingHeightMm ?? planEvidence.levels?.[room.level]?.ceilingHeightMm ?? projectDefaults.levels?.[room.level]?.ceilingHeightMm) : rule.wallTileHeightMm;
      check(`${room.name}: tile height`, Number(height) > 0, 'Tiling height is unknown; full height requires the room ceiling height.');
      const openings = [...(context.placedOpenings || []), ...canonical.placedOpenings].filter((o) => o.page === room.page
        && segments(measured.nodes, true).some(([a, b]) => distanceToLine(o, a, b) <= 150 * context.pixelsPerMm));
      const sizesKnown = openings.every((o) => Number(o.widthMm) > 0 && Number(o.heightMm) > 0);
      check(`${room.name}: tile opening deductions`, sizesKnown, 'An opening on this room boundary has an unknown size.');
      if (Number(height) > 0 && sizesKnown) {
        const deductions = openings.reduce((s, o) => s + Number(o.widthMm) * Math.min(Number(o.heightMm), height) / 1e6, 0);
        let quantity = Math.max(0, polygonPerimeter(measured.nodes, context.pixelsPerMm) * height / 1000 - deductions);
        if (rule.wallTiling === 'standard') {
          const page = context.pages.find((p) => p.pageNumber === room.page);
          const shower = Array.isArray(room.showerWallNodes) && page ? room.showerWallNodes.map((p) => ({ x: p.x * page.logicalWidth, y: p.y * page.logicalHeight })) : [];
          const showerKnown = shower.length >= 2 && shower.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && segments(measured.nodes, true).some(([a, b]) => distanceToLine(p, a, b) <= 150 * context.pixelsPerMm))
            && Number(rule.showerTileHeightMm) >= height;
          check(`${room.name}: shower wall tiles`, showerKnown, 'Standard tiling needs measured shower wall runs and the builder’s shower tiling height in mm. Use a room override for wet areas without a shower.');
          if (!showerKnown) continue;
          const showerOpenings = openings.filter((o) => segments(shower).some(([a, b]) => distanceToLine(o, a, b) <= 150 * context.pixelsPerMm));
          check(`${room.name}: shower wall openings`, !showerOpenings.length, 'Openings intersect the shower tiling run; their vertical positions need review.');
          if (showerOpenings.length) continue;
          const showerLength = segments(shower).reduce((sum, [a, b]) => sum + Math.hypot(a.x - b.x, a.y - b.y), 0) / context.pixelsPerMm / 1000;
          quantity += showerLength * (rule.showerTileHeightMm - height) / 1000;
        }
        quantities.push({ category: 'Wall tiles', room: room.name, page: room.page, level: room.level, quantity, unit: 'm2', basis: 'DERIVED', evidence: `Room perimeter × ${height} mm tiling height, less known opening intersections. Window sill heights must be checked before final approval.` });
        // Window sill elevations are not yet measured, so avoid an apparently approved deduction.
        if (rule.wallTiling !== 'full-height' && openings.some((o) => o.type === 'window')) check(`${room.name}: window sill heights`, false, 'Confirm window sill elevations before accepting partial-height tile deductions.');
      }
    }
    if (splashbackRoom && rule?.splashback === 'measured') {
      const known = Number(room.splashbackLengthM) > 0 && Number(room.splashbackHeightMm) > 0;
      check(`${room.name}: splashback dimensions`, known, 'No measured splashback length and height were found.');
      if (known) quantities.push({ category: 'Splashback tiles', room: room.name, page: room.page, level: room.level,
        quantity: room.splashbackLengthM * room.splashbackHeightMm / 1000, unit: 'm2', basis: 'DERIVED', evidence: 'Documented splashback length × height.' });
    }
  }
  return { version: 1, schedule: profile.schedule, complete: checklist.every((i) => i.passed), checklist, quantities, areas };
}
