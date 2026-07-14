import { distancePx } from "./geometry.js";

export function createScaleCalibration({ start, end, realDistanceMm, label = "" }) {
  const pointA = start;
  const pointB = end;
  const pixelDistance = distancePx(pointA, pointB);
  const distanceMm = Number(realDistanceMm);

  if (!Number.isFinite(distanceMm) || distanceMm <= 0) {
    throw new Error("Scale calibration requires a positive realDistanceMm value.");
  }
  if (!Number.isFinite(pixelDistance) || pixelDistance <= 0) {
    throw new Error("Scale calibration requires two different image points.");
  }

  return {
    pointA,
    pointB,
    referenceDistanceMm: distanceMm,
    pixelsPerMm: pixelDistance / distanceMm,
    mmPerPixel: distanceMm / pixelDistance,
    pixelDistance,
    start: pointA,
    end: pointB,
    realDistanceMm: distanceMm,
    pixelsPerMillimetre: pixelDistance / distanceMm,
    millimetresPerPixel: distanceMm / pixelDistance,
    label,
    unit: "mm",
  };
}

export function createScaleFromSuggestion(suggestion = {}) {
  const ratio = Number(suggestion.ratio || 0);
  const dpi = Number(suggestion.dpi || 300);
  const mmPerPixel = Number(suggestion.mmPerPixel || suggestion.millimetresPerPixel || (ratio && dpi ? ratio / (dpi / 25.4) : 0));
  const pixelsPerMm = Number(suggestion.pixelsPerMm || suggestion.pixelsPerMillimetre || (mmPerPixel ? 1 / mmPerPixel : 0));

  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new Error("Scale suggestion requires a positive drawing ratio.");
  }
  if (!Number.isFinite(mmPerPixel) || mmPerPixel <= 0 || !Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0) {
    throw new Error("Scale suggestion could not be converted to mm per pixel.");
  }

  return {
    pointA: null,
    pointB: null,
    referenceDistanceMm: null,
    pixelsPerMm,
    mmPerPixel,
    pixelsPerMillimetre: pixelsPerMm,
    millimetresPerPixel: mmPerPixel,
    pixelDistance: null,
    start: null,
    end: null,
    realDistanceMm: null,
    label: suggestion.normalized || `1:${ratio}`,
    ratio,
    dpi,
    unit: "mm",
    source: "confirmed-scale-suggestion",
    confirmedAt: new Date().toISOString(),
  };
}

export function pixelsToMillimetres(pixelDistance, scale) {
  if (!scale?.millimetresPerPixel) {
    return 0;
  }
  return Number(pixelDistance || 0) * scale.millimetresPerPixel;
}

export function millimetresToPixels(distanceMm, scale) {
  if (!scale?.pixelsPerMillimetre) {
    return 0;
  }
  return Number(distanceMm || 0) * scale.pixelsPerMillimetre;
}

export function pixelsToSquareMillimetres(areaPx2, scale) {
  if (!scale?.millimetresPerPixel) {
    return 0;
  }
  return Number(areaPx2 || 0) * scale.millimetresPerPixel * scale.millimetresPerPixel;
}

export function formatMillimetres(distanceMm, options = {}) {
  const value = Number(distanceMm || 0);
  const roundedMm = Math.round(value);
  const includeMetres = options.includeMetres !== false;
  const mmText = `${roundedMm.toLocaleString()} mm`;

  if (!includeMetres) {
    return mmText;
  }

  return `${mmText} (${(value / 1000).toFixed(2)} m)`;
}

export function formatSquareMillimetres(areaMm2, options = {}) {
  const value = Number(areaMm2 || 0);
  const includeSquareMetres = options.includeSquareMetres !== false;
  const mmText = `${Math.round(value).toLocaleString()} mm²`;

  if (!includeSquareMetres) {
    return mmText;
  }

  return `${mmText} (${(value / 1000000).toFixed(2)} m²)`;
}

export function estimateDrawingScale(scale, dpi = 300) {
  if (!scale?.millimetresPerPixel || !Number.isFinite(dpi) || dpi <= 0) {
    return null;
  }

  const sourceMmPerPixel = 25.4 / dpi;
  const ratio = scale.millimetresPerPixel / sourceMmPerPixel;
  return Math.max(1, Math.round(ratio));
}
