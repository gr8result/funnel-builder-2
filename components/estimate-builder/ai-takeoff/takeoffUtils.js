// takeoffUtils.js - geometry, scale, measurements, storage.

import { OT } from "./takeoffTypes";

export const dist = (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
export const r2 = (n) => Math.round((n || 0) * 100) / 100;

export function polyLen(pts = []) {
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) total += dist(pts[i - 1], pts[i]);
  return total;
}

export function polyArea(pts = []) {
  if (pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area / 2);
}

export function polyPerim(pts = []) {
  if (pts.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < pts.length; i += 1) total += dist(pts[i], pts[(i + 1) % pts.length]);
  return total;
}

export function centroid(pts = []) {
  if (!pts.length) return { x: 0, y: 0 };
  return {
    x: pts.reduce((sum, pt) => sum + pt.x, 0) / pts.length,
    y: pts.reduce((sum, pt) => sum + pt.y, 0) / pts.length,
  };
}

export const polygonCentroid = centroid;

export function rectCorners(a, b) {
  return [
    { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
    { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) },
    { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
    { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) },
  ];
}

export function circleArea(centerPt, radiusPt) {
  const radius = dist(centerPt, radiusPt);
  return Math.PI * radius * radius;
}

export function circlePerim(centerPt, radiusPt) {
  return 2 * Math.PI * dist(centerPt, radiusPt);
}

// PDF.js renders at 2x = 192 dpi.
export function presetToPpm(ratio) {
  return (192 / 25.4) * (1000 / ratio);
}

export function calibToPpm(ptA, ptB, realM) {
  const px = dist(ptA, ptB);
  return px > 0 && realM > 0 ? px / realM : null;
}

export const calibrationToPpm = calibToPpm;
export const pxToM = (px, ppm) => (ppm > 0 ? px / ppm : null);
export const pxToM2 = (px, ppm) => (ppm > 0 ? px / (ppm * ppm) : null);

export function getPixelsPerUnit(scale) {
  return Number(scale?.pixelsPerUnit || scale?.pixelsPerMetre || 0);
}

export function overlayMeasure(ov, ppm) {
  const pts = ov.points || [];
  switch (ov.type) {
    case OT.EXTERNAL_WALL:
    case OT.INTERNAL_WALL:
    case OT.POLYLINE:
    case OT.MEASURE:
      return { lengthM: pxToM(polyLen(pts), ppm) };

    case OT.ROOM:
    case OT.AREA:
    case OT.RECTANGLE:
      return { areaM2: pxToM2(polyArea(pts), ppm), perimM: pxToM(polyPerim(pts), ppm) };

    case OT.CIRCLE:
      if (pts.length < 2) return {};
      return {
        areaM2: pxToM2(circleArea(pts[0], pts[1]), ppm),
        perimM: pxToM(circlePerim(pts[0], pts[1]), ppm),
        radiusM: pxToM(dist(pts[0], pts[1]), ppm),
      };

    default:
      return {};
  }
}

export function fmtM(n) {
  return n != null ? `${r2(n).toFixed(2)} m` : "-";
}

export function fmtLM(n) {
  return fmtM(n);
}

export function fmtM2(n) {
  return n != null ? `${r2(n).toFixed(2)} m2` : "-";
}

export function fmtMM(n) {
  return n != null ? `${Math.round((n || 0) * 1000)} mm` : "-";
}

export function summarise(overlays = [], ppm) {
  const totals = {
    externalWallLM: 0,
    internalWallLM: 0,
    polylineLM: 0,
    floorAreaM2: 0,
    doorCount: 0,
    windowCount: 0,
    columnCount: 0,
    rooms: [],
  };

  for (const ov of overlays) {
    const measurement = overlayMeasure(ov, ppm);
    if (ov.type === OT.EXTERNAL_WALL) totals.externalWallLM += measurement.lengthM || 0;
    if (ov.type === OT.INTERNAL_WALL) totals.internalWallLM += measurement.lengthM || 0;
    if (ov.type === OT.POLYLINE) totals.polylineLM += measurement.lengthM || 0;
    if (ov.type === OT.ROOM || ov.type === OT.AREA || ov.type === OT.RECTANGLE) totals.floorAreaM2 += measurement.areaM2 || 0;
    if (ov.type === OT.DOOR) totals.doorCount += 1;
    if (ov.type === OT.WINDOW) totals.windowCount += 1;
    if (ov.type === OT.COLUMN) totals.columnCount += 1;
    if (ov.type === OT.ROOM) {
      totals.rooms.push({
        id: ov.id,
        name: ov.roomName || ov.label,
        areaM2: r2(measurement.areaM2 || 0),
        perimM: r2(measurement.perimM || 0),
        finish: ov.floorFinish,
        status: ov.status,
      });
    }
  }

  return {
    ...totals,
    externalWallLM: r2(totals.externalWallLM),
    internalWallLM: r2(totals.internalWallLM),
    floorAreaM2: r2(totals.floorAreaM2),
  };
}

const KEY = "gr8:takeoff:v1";

export function saveProject(project) {
  try {
    const all = loadAll();
    const index = all.findIndex((item) => item.id === project.id);
    const next = { ...project, updatedAt: new Date().toISOString() };
    if (index >= 0) all[index] = next;
    else all.push(next);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

export function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function loadByJobId(jobId) {
  return loadAll().find((project) => project.jobId === jobId) || null;
}
