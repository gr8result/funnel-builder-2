export const OPENING_SYMBOL_REVIEW_DEFAULTS = {
  minimumWidthMm: 400,
  maximumWidthMm: 6000,
  maximumSeparationBetweenFrameMarksMm: 1600,
  wallBandFactor: 0.72,
  minimumFrameInkShare: 0.42,
  minimumFrameExcessPixels: 7,
  minimumWallRunMm: 700,
  dedupeMm: 180,
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function framePeaks(profile, minimumInk, minIndex, maxIndex) {
  const peaks = [];
  let start = -1, maximum = 0, total = 0, samples = 0;
  for (let index = minIndex; index <= maxIndex + 1; index += 1) {
    const value = index <= maxIndex ? profile[index] : 0;
    if (value >= minimumInk) {
      if (start < 0) { start = index; maximum = value; total = 0; samples = 0; }
      maximum = Math.max(maximum, value);
      total += value; samples += 1;
      continue;
    }
    if (start >= 0) {
      peaks.push({ index: (start + index - 1) / 2, peak: maximum, mean: total / samples });
      start = -1;
    }
  }
  return peaks;
}

/**
 * Find high-contrast cross-wall frame marks inside an already measured wall band.
 * Results are review candidates only: they do not alter walls, openings or quantities.
 */
export function detectOpeningSymbolReviewCandidates({ ink, width, height, pixelsPerMm, logicalWidth, logicalHeight, walls = [] }, overrides = {}) {
  const options = { ...OPENING_SYMBOL_REVIEW_DEFAULTS, ...overrides };
  if (!ink || !(width > 0 && height > 0 && pixelsPerMm > 0 && logicalWidth > 0 && logicalHeight > 0)) return [];
  const sx = width / logicalWidth, sy = height / logicalHeight;
  const candidates = [];
  for (const wall of walls) {
    if (!wall?.nodes?.[0] || !wall?.nodes?.[1]) continue;
    const vertical = wall.axis === 'v';
    const runScale = vertical ? sy : sx;
    const crossScale = vertical ? sx : sy;
    const [a, b] = wall.nodes;
    const start = Math.round(Math.min(vertical ? a.y : a.x, vertical ? b.y : b.x) * runScale);
    const end = Math.round(Math.max(vertical ? a.y : a.x, vertical ? b.y : b.x) * runScale);
    const lengthMm = (end - start) / (pixelsPerMm * runScale);
    if (lengthMm < options.minimumWallRunMm) continue;
    const centre = Math.round(((vertical ? a.x + b.x : a.y + b.y) / 2) * crossScale);
    const thicknessMm = Number(wall.measuredThicknessMm || wall.thicknessMm);
    if (!(thicknessMm > 0)) continue;
    const halfBand = Math.max(2, thicknessMm * pixelsPerMm * crossScale * options.wallBandFactor / 2);
    const crossStart = Math.max(0, Math.ceil(centre - halfBand));
    const crossEnd = Math.min((vertical ? width : height) - 1, Math.floor(centre + halfBand));
    const bandPixels = crossEnd - crossStart + 1;
    if (bandPixels < 4) continue;
    const profile = new Uint16Array(vertical ? height : width);
    for (let along = Math.max(0, start); along <= Math.min(vertical ? height - 1 : width - 1, end); along += 1) {
      for (let across = crossStart; across <= crossEnd; across += 1) {
        const pixel = vertical ? along * width + across : across * width + along;
        profile[along] += ink[pixel] ? 1 : 0;
      }
    }
    const baselineValues = [];
    for (let along = Math.max(0, start); along <= Math.min(vertical ? height - 1 : width - 1, end); along += 1) baselineValues.push(profile[along]);
    const baseline = median(baselineValues);
    const frameThreshold = Math.max(Math.ceil(bandPixels * options.minimumFrameInkShare), baseline + options.minimumFrameExcessPixels);
    const peaks = framePeaks(profile, frameThreshold, Math.max(0, start), Math.min(vertical ? height - 1 : width - 1, end));
    for (let index = 0; index + 1 < peaks.length; index += 1) {
      const first = peaks[index], second = peaks[index + 1];
      const widthMm = (second.index - first.index) / (pixelsPerMm * runScale);
      if (widthMm < options.minimumWidthMm || widthMm > options.maximumWidthMm) continue;
      const peakGapMm = (second.index - first.index) / (pixelsPerMm * runScale);
      if (index + 2 < peaks.length) {
        const nextGapMm = (peaks[index + 2].index - second.index) / (pixelsPerMm * runScale);
        if (nextGapMm <= options.maximumSeparationBetweenFrameMarksMm && nextGapMm < peakGapMm) continue;
      }
      const runCentre = (first.index + second.index) / 2 / runScale;
      const crossCentre = centre / crossScale;
      const candidate = {
        id: `opening-symbol-${wall.id}-${Math.round(runCentre * 10)}`,
        hostWallId: wall.id,
        axis: wall.axis,
        x: vertical ? crossCentre : runCentre,
        y: vertical ? runCentre : crossCentre,
        widthMm: Math.round(widthMm),
        openingClass: 'Unclassified Opening',
        confidence: 0.45,
        reviewRequired: true,
        evidence: `Two transverse frame marks span ${Math.round(options.minimumFrameInkShare * 100)}% or more of a measured wall band, ${Math.round(widthMm)} mm apart. This could be a door, window or wall detail; verify its class and size.`,
        symbolEvidence: { firstFrameInk: first.peak, secondFrameInk: second.peak, wallBandPixels: bandPixels, baselinePixels: baseline },
      };
      const duplicate = candidates.some((other) => other.hostWallId === candidate.hostWallId
        && Math.hypot(other.x - candidate.x, other.y - candidate.y) <= options.dedupeMm * pixelsPerMm);
      if (!duplicate) candidates.push(candidate);
    }
  }
  return candidates;
}