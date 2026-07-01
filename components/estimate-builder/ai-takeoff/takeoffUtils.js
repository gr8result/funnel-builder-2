// takeoffUtils.js — geometry, scale, measurements, storage.

import { OT } from "./takeoffTypes";

// ── Basic geometry ────────────────────────────────────────────────────────────

export const dist  = (a, b) => Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2);
export const r2    = (n)    => Math.round((n||0)*100)/100;

export function polyLen(pts) {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += dist(pts[i-1], pts[i]);
  return t;
}

// Shoelace formula — signed area (positive = CCW)
export function polyArea(pts) {
  if (pts.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i+1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a / 2);
}

export function polyPerim(pts) {
  let t = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) t += dist(pts[i], pts[(i+1)%n]);
  return t;
}

export function centroid(pts) {
  return { x: pts.reduce((s,p)=>s+p.x,0)/pts.length, y: pts.reduce((s,p)=>s+p.y,0)/pts.length };
}

// Rectangle: two opposite corners → 4 corner points (CW from top-left)
export function rectCorners(a, b) {
  return [
    { x: Math.min(a.x,b.x), y: Math.min(a.y,b.y) },
    { x: Math.max(a.x,b.x), y: Math.min(a.y,b.y) },
    { x: Math.max(a.x,b.x), y: Math.max(a.y,b.y) },
    { x: Math.min(a.x,b.x), y: Math.max(a.y,b.y) },
  ];
}

// Circle area in canvas units (px²)
export function circleArea(centerPt, radiusPt) {
  const r = dist(centerPt, radiusPt);
  return Math.PI * r * r;
}

export function circlePerim(centerPt, radiusPt) {
  return 2 * Math.PI * dist(centerPt, radiusPt);
}

// ── Scale conversion ──────────────────────────────────────────────────────────

// PDF.js renders at 2× = 192 dpi
export function presetToPpm(ratio) {
  return (192 / 25.4) * (1000 / ratio);
}

export function calibToPpm(ptA, ptB, realM) {
  const px = dist(ptA, ptB);
  return (px > 0 && realM > 0) ? px / realM : null;
}

// Alias so ScaleCalibrationPanel.jsx (unchanged file) doesn't break
export const calibrationToPpm = calibToPpm;

export const pxToM  = (px, ppm) => (ppm > 0 ? px / ppm       : null);
export const pxToM2 = (px, ppm) => (ppm > 0 ? px / (ppm*ppm) : null);

// ── Overlay measurements (all return metres, null if no scale) ────────────────

export function overlayMeasure(ov, ppm) {
  const pts = ov.points || [];
  switch (ov.type) {
    case OT.EXTERNAL_WALL:
    case OT.INTERNAL_WALL:
    case OT.POLYLINE:
    case OT.MEASURE:
      return { lengthM: pxToM(polyLen(pts), ppm) };

    case OT.ROOM:
    case OT.AREA: {
      const areaM2  = pxToM2(polyArea(pts), ppm);
      const perimM  = pxToM(polyPerim(pts), ppm);
      return { areaM2, perimM };
    }

    case OT.RECTANGLE: {
      const areaM2  = pxToM2(polyArea(pts), ppm);
      const perimM  = pxToM(polyPerim(pts), ppm);
      return { areaM2, perimM };
    }

    case OT.CIRCLE: {
      if (pts.length < 2) return {};
      const areaM2  = pxToM2(circleArea(pts[0], pts[1]), ppm);
      const perimM  = pxToM(circlePerim(pts[0], pts[1]), ppm);
      const radiusM = pxToM(dist(pts[0], pts[1]), ppm);
      return { areaM2, perimM, radiusM };
    }

    case OT.DOOR:
    case OT.WINDOW:
    case OT.COLUMN:
      return {};

    default:
      return {};
  }
}

export function fmtM(n)  { return n != null ? `${r2(n).toFixed(2)} m`  : "—"; }
export function fmtM2(n) { return n != null ? `${r2(n).toFixed(2)} m²` : "—"; }
export function fmtMM(n) { return n != null ? `${Math.round((n||0)*1000)} mm` : "—"; }

// ── Snap ─────────────────────────────────────────────────────────────────────

// Old vertex-only snap kept for any callers that still use it
export function snapVertex(pt, overlays, screenThreshPx, zoom) {
  const thresh = screenThreshPx / Math.max(zoom, 0.1);
  let best = null, bd = thresh;
  for (const ov of overlays) {
    for (const p of (ov.points || [])) {
      const d = dist(pt, p);
      if (d < bd) { best = p; bd = d; }
    }
  }
  return best;
}

// ── Enhanced snap engine ──────────────────────────────────────────────────────
//
// Returns { x, y, type, label } when a snap target is found, or:
//   { ...rawPt, type: "free" }  when altHeld (free placement always allowed)
//   null                         when blockIfNoSnap=true AND no snap target found
//   { ...rawPt, type: null }    when blockIfNoSnap=false AND no snap target found
//
// blockIfNoSnap = true  → used in click handlers: null means "block this click"
// blockIfNoSnap = false → used in mousemove:  always returns a position for preview

export function findSnapPoint({ rawPt, overlays, zoom, ppm, altHeld, shiftHeld, lastPt, blockIfNoSnap = false }) {
  if (!rawPt) return null;

  const SCREEN_THRESH = 12; // screen pixels
  const thresh  = SCREEN_THRESH / Math.max(zoom, 0.1);
  const mThresh = thresh * 0.75; // midpoints use slightly tighter tolerance

  // ── Build geometry collections ────────────────────────────────────────────
  const endpoints     = [];
  const segments      = [];

  for (const ov of (overlays || [])) {
    const pts = ov.points || [];
    if (!pts.length) continue;

    // Collect endpoints
    for (const p of pts) endpoints.push(p);

    // Collect segments
    const isPolygon = ov.type === OT.ROOM || ov.type === OT.AREA || ov.type === OT.RECTANGLE;
    const n = isPolygon ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const j = isPolygon ? (i + 1) % pts.length : i + 1;
      if (j < pts.length) segments.push([pts[i], pts[j]]);
    }
  }

  // ── Alt held: always allow free placement ────────────────────────────────
  if (altHeld) {
    return applyAngleLock({ ...rawPt, type: "free", label: "Free" }, lastPt, shiftHeld);
  }

  // ── 1. Endpoint snap (highest priority) ───────────────────────────────────
  let best = null, bestDist = thresh;
  for (const p of endpoints) {
    const d = dist(rawPt, p);
    if (d < bestDist) { best = { ...p, type: "endpoint", label: "Endpoint" }; bestDist = d; }
  }
  if (best) return applyAngleLock(best, lastPt, shiftHeld);

  // ── 2. Intersection snap ──────────────────────────────────────────────────
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const ix = segIntersect(segments[i][0], segments[i][1], segments[j][0], segments[j][1]);
      if (ix && dist(rawPt, ix) < thresh) {
        return applyAngleLock({ ...ix, type: "intersection", label: "Intersection" }, lastPt, shiftHeld);
      }
    }
  }

  // ── 3. Midpoint snap ──────────────────────────────────────────────────────
  for (const [a, b] of segments) {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (dist(rawPt, mid) < mThresh) {
      return applyAngleLock({ ...mid, type: "midpoint", label: "Midpoint" }, lastPt, shiftHeld);
    }
  }

  // ── 4. Nearest-point-on-segment (perpendicular foot) snap ─────────────────
  for (const [a, b] of segments) {
    const foot = segFoot(rawPt, a, b);
    if (foot && dist(rawPt, foot) < thresh * 0.6) {
      return applyAngleLock({ ...foot, type: "online", label: "On line" }, lastPt, shiftHeld);
    }
  }

  // ── 5. Grid snap (when scale is known) ────────────────────────────────────
  if (ppm) {
    const gridM  = ppm >= 200 ? 0.5 : 0.25;   // coarser grid at small zoom
    const gridPx = ppm * gridM;
    const gx     = Math.round(rawPt.x / gridPx) * gridPx;
    const gy     = Math.round(rawPt.y / gridPx) * gridPx;
    if (dist(rawPt, { x: gx, y: gy }) < thresh * 0.45) {
      return applyAngleLock({ x: gx, y: gy, type: "grid", label: `Grid ${gridM}m` }, lastPt, shiftHeld);
    }
  }

  // ── No geometry snap found ────────────────────────────────────────────────
  if (blockIfNoSnap) {
    // Caller wants a hard block — return null so the click is rejected
    return null;
  }
  // For preview/mousemove use: return the raw cursor position so the line still follows
  return applyAngleLock({ ...rawPt, type: null, label: "" }, lastPt, shiftHeld);
}

// Project raw cursor onto the nearest 45° ray from lastPt
function applyAngleLock(pt, lastPt, shiftHeld) {
  if (!shiftHeld || !lastPt) return pt;

  const dx  = pt.x - lastPt.x;
  const dy  = pt.y - lastPt.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return pt;

  const raw      = Math.atan2(dy, dx);
  const step     = Math.PI / 4;              // 45°
  const snapped  = Math.round(raw / step) * step;
  const angleDeg = (Math.round(snapped * 180 / Math.PI) + 360) % 360;

  return {
    x: lastPt.x + len * Math.cos(snapped),
    y: lastPt.y + len * Math.sin(snapped),
    type:  pt.type ? `${pt.type}+angle` : "angle",
    label: `${angleDeg}°`,
    angleDeg,
    lockFrom: lastPt,
  };
}

// Segment–segment intersection (returns null if parallel or no overlap)
function segIntersect(p1, p2, p3, p4) {
  const dx1 = p2.x - p1.x, dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x, dy2 = p4.y - p3.y;
  const cross = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(cross) < 1e-10) return null;
  const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / cross;
  const u = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / cross;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: p1.x + t * dx1, y: p1.y + t * dy1 };
  }
  return null;
}

// Perpendicular foot from pt onto segment [a,b] — null if foot falls outside segment
function segFoot(pt, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-10) return null;
  const t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq;
  if (t <= 0.05 || t >= 0.95) return null;   // avoid endpoints (covered above)
  return { x: a.x + t * dx, y: a.y + t * dy };
}

// ── Hit testing ───────────────────────────────────────────────────────────────

export function hitOverlay(pt, ov, thresh) {
  const pts = ov.points || [];
  if (ov.type === OT.DOOR || ov.type === OT.WINDOW || ov.type === OT.COLUMN) {
    return pts[0] && dist(pt, pts[0]) <= thresh;
  }
  if (ov.type === OT.CIRCLE) {
    if (pts.length < 2) return false;
    const r = dist(pts[0], pts[1]);
    return Math.abs(dist(pt, pts[0]) - r) <= thresh;
  }
  if (ov.type === OT.ROOM || ov.type === OT.AREA || ov.type === OT.RECTANGLE) {
    if (ptInPoly(pt, pts)) return true;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      if (segDist(pt, pts[i], pts[(i+1)%n]) <= thresh) return true;
    }
    return false;
  }
  // Polylines
  for (let i = 0; i < pts.length - 1; i++) {
    if (segDist(pt, pts[i], pts[i+1]) <= thresh) return true;
  }
  return false;
}

function segDist(p, a, b) {
  const dx = b.x-a.x, dy = b.y-a.y;
  const lenSq = dx*dx + dy*dy;
  if (!lenSq) return dist(p,a);
  const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx + (p.y-a.y)*dy) / lenSq));
  return dist(p, { x: a.x+t*dx, y: a.y+t*dy });
}

function ptInPoly(pt, poly) {
  let inside = false;
  for (let i=0, j=poly.length-1; i<poly.length; j=i++) {
    const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y;
    if (((yi>pt.y)!==(yj>pt.y)) && pt.x < (xj-xi)*(pt.y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}

// ── Summary totals ────────────────────────────────────────────────────────────

export function summarise(overlays, ppm) {
  const totals = { externalWallLM:0, internalWallLM:0, polylineLM:0, floorAreaM2:0, doorCount:0, windowCount:0, columnCount:0, rooms:[] };
  for (const ov of overlays) {
    const m = overlayMeasure(ov, ppm);
    if (ov.type === OT.EXTERNAL_WALL) totals.externalWallLM += m.lengthM || 0;
    if (ov.type === OT.INTERNAL_WALL) totals.internalWallLM += m.lengthM || 0;
    if (ov.type === OT.POLYLINE)      totals.polylineLM     += m.lengthM || 0;
    if (ov.type === OT.ROOM || ov.type === OT.AREA || ov.type === OT.RECTANGLE) totals.floorAreaM2 += m.areaM2 || 0;
    if (ov.type === OT.DOOR)   totals.doorCount++;
    if (ov.type === OT.WINDOW) totals.windowCount++;
    if (ov.type === OT.COLUMN) totals.columnCount++;
    if (ov.type === OT.ROOM) {
      totals.rooms.push({ id: ov.id, name: ov.roomName || ov.label, areaM2: r2(m.areaM2||0), perimM: r2(m.perimM||0), finish: ov.floorFinish, status: ov.status });
    }
  }
  return { ...totals, externalWallLM: r2(totals.externalWallLM), internalWallLM: r2(totals.internalWallLM), floorAreaM2: r2(totals.floorAreaM2) };
}

// ── Storage ───────────────────────────────────────────────────────────────────

const KEY = "gr8:takeoff:v1";

export function saveProject(p) {
  try {
    const all = loadAll();
    const i   = all.findIndex(x => x.id === p.id);
    const n   = { ...p, updatedAt: new Date().toISOString() };
    if (i >= 0) all[i] = n; else all.push(n);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

export function loadAll()         { try { return JSON.parse(localStorage.getItem(KEY)||"[]"); } catch { return []; } }
export function loadByJobId(jid)  { return loadAll().find(p => p.jobId === jid) || null; }
