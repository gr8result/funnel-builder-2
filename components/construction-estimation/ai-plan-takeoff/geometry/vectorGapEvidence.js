// Gaps the drawing fills: on a vector PDF a window (and a sliding or stacking door) is drawn as
// parallel lines running across the gap in its wall, inside the wall's thickness: the frame and the
// glass. A gap in a wall's faces with two or more such lines spanning it is an opening on the
// drawing's own evidence, as a window the estimator placed would be. A gap with nothing drawn across
// it (an open passage, a missed junction) gets no evidence here.
// Coordinates are logical plan pixels; gaps are the engine's candidate openings.

import { indexAxisLines } from './vectorWallFit.js';

export const GAP_EVIDENCE_DEFAULTS = {
  minLines: 2,          // frame/glass lines needed across the gap
  spanShare: 0.8,       // each runs across this much of the gap
  bandMm: 25,           // inside the wall's thickness, with this margin
  maxGapMm: 6000,
};

/**
 * @param gaps engine openings ({ x, y, axis: 'h'|'v', widthMm, hostThicknessMm, confirmed, kind })
 * @param segments extractPdfLinework output in the same space
 * @returns {{ x, y, ref, kind: 'window', widthMm, lines: number }[]} evidence for the engine
 */
export function gapGlazingEvidence(gaps, segments, pixelsPerMm, overrides = {}) {
  const options = { ...GAP_EVIDENCE_DEFAULTS, ...overrides };
  if (!segments?.length || !(pixelsPerMm > 0)) return [];
  const mm = (value) => value * pixelsPerMm;
  const index = indexAxisLines(segments);
  const evidence = [];
  for (const gap of gaps || []) {
    if (gap.confirmed || (gap.axis !== 'h' && gap.axis !== 'v') || !(gap.widthMm > 0) || gap.widthMm > options.maxGapMm) continue;
    const horizontal = gap.axis === 'h';
    const c = horizontal ? gap.y : gap.x, s = horizontal ? gap.x : gap.y;
    const half = mm(Number(gap.hostThicknessMm) || 90) / 2 + mm(options.bandMm);
    const s0 = s - mm(gap.widthMm) / 2, s1 = s + mm(gap.widthMm) / 2;
    let lines = 0;
    for (const line of index[gap.axis]) {
      if (line.c < c - half || line.c > c + half) continue;
      let covered = 0;
      for (const [a, b] of line.intervals) covered += Math.max(0, Math.min(b, s1) - Math.max(a, s0));
      if (covered >= (s1 - s0) * options.spanShare) lines += 1;
    }
    if (lines >= options.minLines) evidence.push({ x: gap.x, y: gap.y, ref: `pdf-glazing:${Math.round(gap.x)}:${Math.round(gap.y)}`, kind: 'window', widthMm: gap.widthMm, lines });
  }
  return evidence;
}
