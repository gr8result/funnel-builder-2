import { distance } from "./geometry.js";

const MIN_WALL_LENGTH = 36;
const MIN_SOURCE_FRAGMENT_LENGTH = 10;
const MIN_THICKNESS = 3;
const MAX_THICKNESS = 34;
const MIN_FACE_OVERLAP = 12;
const PARALLEL_TOLERANCE_DEG = 3;
const SAME_FACE_TOLERANCE = 5;
const BAND_GAP_TOLERANCE = 42;
const JUNCTION_FACE_TOLERANCE = 8;
const DIMENSION_TICK_MIN_LENGTH = 3;
const DIMENSION_TICK_MAX_LENGTH = 28;
const DIMENSION_TICK_FACE_TOLERANCE = 5;
const DIMENSION_CHAIN_MIN_TICKS = 3;
const MIN_CONFIDENCE = 0.64;
const FACE_FRAGMENT_GAP = 10;
const SMALL_FRAGMENT_GAP = BAND_GAP_TOLERANCE;
const MAX_WINDOW_GAP = 70;
const MAX_DOOR_GAP = 95;
const MAX_GARAGE_GAP = 260;
const JAMB_ALONG_TOLERANCE = 9;
const OPENING_SYMBOL_PAD = 10;
const REJECTED_TAGS = new Set([
  "annotation",
  "dimension",
  "dimension-line",
  "extension-line",
  "text",
  "text-bound",
  "door-arc",
  "symbol",
  "page-border",
  "title-block",
  "title-block-rule",
  "leader",
  "hatch",
  "hatching",
  "furniture",
  "furniture-edge",
  "cabinet",
  "cabinetry",
  "bench",
  "appliance",
  "window",
  "window-symbol",
  "glazing",
  "door",
  "door-symbol",
  "garage-door",
  "opening",
  "note",
  "arrow",
  "setback",
]);

function rawSegments(planGeometryIndex) {
  const raw = Array.isArray(planGeometryIndex?.rawSegments)
    ? planGeometryIndex.rawSegments
    : typeof planGeometryIndex?.getCandidateWallSegments === "function"
      ? planGeometryIndex.getCandidateWallSegments()
      : planGeometryIndex?.segments;
  return Array.isArray(raw) ? raw : [];
}

function segmentTag(segment) {
  return String(segment?.geometryType || segment?.objectType || segment?.role || segment?.type || segment?.classification || "").toLowerCase();
}

function segmentText(segment) {
  return String(segment?.label || segment?.text || segment?.name || segment?.annotation || "").toLowerCase();
}

function bounds(segment) {
  return {
    minX: Math.min(segment.a.x, segment.b.x),
    maxX: Math.max(segment.a.x, segment.b.x),
    minY: Math.min(segment.a.y, segment.b.y),
    maxY: Math.max(segment.a.y, segment.b.y),
  };
}

function isLikelyPageBorder(segment, page = {}) {
  const width = page.sourceWidth || page.width || 0;
  const height = page.sourceHeight || page.height || 0;
  if (!(width > 0) || !(height > 0) || !segment?.a || !segment?.b) return false;
  const b = bounds(segment);
  const marginX = width * 0.025;
  const marginY = height * 0.025;
  return (
    (b.maxX - b.minX > width * 0.82 && (b.minY <= marginY || b.maxY >= height - marginY)) ||
    (b.maxY - b.minY > height * 0.82 && (b.minX <= marginX || b.maxX >= width - marginX))
  );
}

function rejectionReason(segment, page) {
  if (!segment?.a || !segment?.b) return "missing endpoints";
  if (segment.stroked === false) return "not stroked";
  if (segment.isText || segment.isDimension || segment.isPageBorder || segment.isTitleBlock || segment.isDoorArc || segment.isSymbol) return "annotation metadata";
  if (REJECTED_TAGS.has(segmentTag(segment))) return `rejected tag ${segmentTag(segment)}`;
  if (Array.isArray(segment.dashPattern) && segment.dashPattern.length) return "dashed annotation";
  if (isLikelyPageBorder(segment, page)) return "page border";
  if ((segment.length || distance(segment.a, segment.b)) < MIN_SOURCE_FRAGMENT_LENGTH) return "too short";
  return null;
}

function normalizeAngle(angle) {
  let next = angle;
  while (next < 0) next += Math.PI;
  while (next >= Math.PI) next -= Math.PI;
  return next;
}

function angleDiffDeg(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, Math.PI - diff) * 180 / Math.PI;
}

function oriented(segment) {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return null;
  const angle = normalizeAngle(Math.atan2(dy, dx));
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const a = segment.a.x * ux + segment.a.y * uy;
  const b = segment.b.x * ux + segment.b.y * uy;
  const fixed = ((segment.a.x * nx + segment.a.y * ny) + (segment.b.x * nx + segment.b.y * ny)) / 2;
  return {
    ...segment,
    angle,
    ux,
    uy,
    nx,
    ny,
    fixed,
    startAlong: Math.min(a, b),
    endAlong: Math.max(a, b),
    length,
  };
}

function orientedRawSegments(segments = []) {
  return segments
    .filter((segment) => segment?.a && segment?.b && segment.stroked !== false)
    .map(oriented)
    .filter(Boolean);
}

function nearestPointOnSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return a;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function pointOn(line, along, fixed = line.fixed) {
  return { x: line.ux * along + line.nx * fixed, y: line.uy * along + line.ny * fixed };
}

function overlap(a, b) {
  return Math.max(0, Math.min(a.endAlong, b.endAlong) - Math.max(a.startAlong, b.startAlong));
}

function lineMidAlong(line, seed) {
  const mid = { x: (line.a.x + line.b.x) / 2, y: (line.a.y + line.b.y) / 2 };
  return mid.x * seed.ux + mid.y * seed.uy;
}

function lineFixedRangeForSeed(line, seed) {
  const aFixed = line.a.x * seed.nx + line.a.y * seed.ny;
  const bFixed = line.b.x * seed.nx + line.b.y * seed.ny;
  return { min: Math.min(aFixed, bFixed), max: Math.max(aFixed, bFixed) };
}

function evidenceNearGap(rawLines, seed, faceAFixed, faceBFixed, gap) {
  const minFixed = Math.min(faceAFixed, faceBFixed) - Math.max(6, Math.abs(faceAFixed - faceBFixed) * 0.8);
  const maxFixed = Math.max(faceAFixed, faceBFixed) + Math.max(6, Math.abs(faceAFixed - faceBFixed) * 0.8);
  return rawLines
    .filter((line) => {
      const along = lineMidAlong(line, seed);
      if (along < gap.start - OPENING_SYMBOL_PAD || along > gap.end + OPENING_SYMBOL_PAD) return false;
      const fixed = lineFixedRangeForSeed(line, seed);
      return fixed.min <= maxFixed && fixed.max >= minFixed;
    })
    .map((line) => ({
      id: line.id,
      tag: segmentTag(line),
      text: segmentText(line),
      along: lineMidAlong(line, seed),
      angleDiff: angleDiffDeg(line.angle, seed.angle),
      length: line.length,
    }));
}

function jambEvidenceAt(rawLines, seed, faceAFixed, faceBFixed, along) {
  const minFixed = Math.min(faceAFixed, faceBFixed) - JUNCTION_FACE_TOLERANCE;
  const maxFixed = Math.max(faceAFixed, faceBFixed) + JUNCTION_FACE_TOLERANCE;
  const thickness = Math.abs(faceAFixed - faceBFixed);
  return rawLines
    .filter((line) => {
      const diff = angleDiffDeg(line.angle, seed.angle);
      if (diff < 65 || diff > 115) return false;
      if (line.length < Math.max(2, thickness * 0.45) || line.length > Math.max(34, thickness * 5)) return false;
      const lineAlong = lineMidAlong(line, seed);
      if (Math.abs(lineAlong - along) > JAMB_ALONG_TOLERANCE) return false;
      const fixed = lineFixedRangeForSeed(line, seed);
      return fixed.min <= maxFixed && fixed.max >= minFixed;
    })
    .map((line) => line.id)
    .filter(Boolean);
}

function openingTypeFromEvidence(gap, evidence, startJambs, endJambs) {
  const width = gap.end - gap.start;
  const joined = evidence.map((entry) => `${entry.tag} ${entry.text}`).join(" ");
  const hasJambs = startJambs.length > 0 && endJambs.length > 0;
  if (/garage|panel\s*lift|roller|gd\b/.test(joined)) return { type: "garage-door", confidence: 0.9, reason: "garage-door symbol or annotation in wall gap" };
  if (/sliding|slider|stacker|sd\b/.test(joined)) return { type: "door", confidence: 0.86, reason: "sliding-door evidence in wall gap" };
  if (/door|entry|external-door|hinge|swing|arc|\bd\b/.test(joined)) return { type: "door", confidence: 0.84, reason: "door symbol evidence in wall gap" };
  if (/window|glaz|sill|\bw\d*\b/.test(joined)) return { type: "window", confidence: 0.84, reason: "window/glazing evidence in wall gap" };
  const thinParallelLines = evidence.filter((entry) => entry.angleDiff <= PARALLEL_TOLERANCE_DEG && entry.length >= Math.min(14, width * 0.35)).length;
  if (width <= MAX_WINDOW_GAP && (hasJambs || thinParallelLines >= 1)) return { type: "window", confidence: hasJambs ? 0.74 : 0.68, reason: hasJambs ? "window-sized gap bounded by jambs" : "window-sized gap with parallel glazing evidence" };
  if (width <= MAX_DOOR_GAP && hasJambs) return { type: "door", confidence: 0.72, reason: "door-sized gap bounded by jambs" };
  if (width <= MAX_GARAGE_GAP && hasJambs && thinParallelLines >= 2) return { type: "garage-door", confidence: 0.76, reason: "wide garage-door-sized gap with jambs and panel evidence" };
  if (width <= MAX_WINDOW_GAP && hasJambs) return { type: "unknown-opening", confidence: 0.66, reason: "supported opening-sized wall gap" };
  return null;
}

function normalizeFaceIntervals(lines) {
  return lines
    .map((line) => ({ start: line.startAlong, end: line.endAlong, ids: [line.id].filter(Boolean) }))
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .reduce((merged, interval) => {
      const current = merged[merged.length - 1];
      if (current && interval.start <= current.end + FACE_FRAGMENT_GAP) {
        current.end = Math.max(current.end, interval.end);
        current.ids.push(...interval.ids);
      } else {
        merged.push({ ...interval });
      }
      return merged;
    }, []);
}

function buildWallAssemblyInterval({ faceALines, faceBLines, rawLines, seed, faceAFixed, faceBFixed, pointerAlong, pointerTolerance = 0 }) {
  const sourceIntervals = [...normalizeFaceIntervals(faceALines), ...normalizeFaceIntervals(faceBLines)]
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (!sourceIntervals.length) return null;
  const merged = [];
  sourceIntervals.forEach((interval) => {
    const current = merged[merged.length - 1];
    if (current && interval.start <= current.end + FACE_FRAGMENT_GAP) {
      current.end = Math.max(current.end, interval.end);
      current.ids.push(...interval.ids);
    } else {
      merged.push({ ...interval });
    }
  });

  const assemblies = [];
  let current = { start: merged[0].start, end: merged[0].end, solids: [{ start: merged[0].start, end: merged[0].end }], openings: [], sourceIds: [...merged[0].ids] };
  for (let index = 1; index < merged.length; index += 1) {
    const next = merged[index];
    const gap = { start: current.end, end: next.start };
    const gapWidth = gap.end - gap.start;
    const startJambs = jambEvidenceAt(rawLines, seed, faceAFixed, faceBFixed, gap.start);
    const endJambs = jambEvidenceAt(rawLines, seed, faceAFixed, faceBFixed, gap.end);
    const evidence = evidenceNearGap(rawLines, seed, faceAFixed, faceBFixed, gap);
    const opening = openingTypeFromEvidence(gap, evidence, startJambs, endJambs);
    if (opening) {
      current.openings.push({ ...gap, ...opening, evidenceIds: evidence.map((entry) => entry.id).filter(Boolean), startJambIds: startJambs, endJambIds: endJambs });
      current.end = Math.max(current.end, next.end);
      current.solids.push({ start: next.start, end: next.end });
      current.sourceIds.push(...next.ids);
      continue;
    }
    if (gapWidth <= SMALL_FRAGMENT_GAP) {
      current.end = Math.max(current.end, next.end);
      current.solids[current.solids.length - 1].end = Math.max(current.solids[current.solids.length - 1].end, next.end);
      current.sourceIds.push(...next.ids);
      continue;
    }

    assemblies.push(current);
    current = { start: next.start, end: next.end, solids: [{ start: next.start, end: next.end }], openings: [], sourceIds: [...next.ids] };
  }
  assemblies.push(current);
  if (!Number.isFinite(pointerAlong)) return assemblies.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0] || null;
  return assemblies.find((assembly) => pointerAlong >= assembly.start - pointerTolerance && pointerAlong <= assembly.end + pointerTolerance) || null;
}

function wallSectionsFromAssembly(assembly, startAlong, length) {
  const sections = [];
  const openings = [...assembly.openings].sort((a, b) => a.start - b.start);
  let cursor = startAlong;
  openings.forEach((opening, index) => {
    if (opening.start > cursor) {
      sections.push({
        type: "solid",
        startOffset: Math.max(0, cursor - startAlong),
        endOffset: Math.min(length, opening.start - startAlong),
        confidence: 0.82,
      });
    }
    sections.push({
      type: opening.type,
      startOffset: Math.max(0, opening.start - startAlong),
      endOffset: Math.min(length, opening.end - startAlong),
      openingId: `op-${index + 1}`,
      confidence: opening.confidence,
      reason: opening.reason,
    });
    cursor = Math.max(cursor, opening.end);
  });
  if (cursor < startAlong + length) {
    sections.push({
      type: "solid",
      startOffset: Math.max(0, cursor - startAlong),
      endOffset: length,
      confidence: 0.82,
    });
  }
  return sections.filter((section) => section.endOffset - section.startOffset > 0.5);
}

function lineCrossesFaceAt(line, seed, faceFixed, interval) {
  const diff = angleDiffDeg(line.angle, seed.angle);
  if (diff < 65 || diff > 115) return null;
  if (line.length < DIMENSION_TICK_MIN_LENGTH || line.length > DIMENSION_TICK_MAX_LENGTH) return null;
  const aFixed = line.a.x * seed.nx + line.a.y * seed.ny;
  const bFixed = line.b.x * seed.nx + line.b.y * seed.ny;
  const minFixed = Math.min(aFixed, bFixed);
  const maxFixed = Math.max(aFixed, bFixed);
  if (minFixed > faceFixed + DIMENSION_TICK_FACE_TOLERANCE || maxFixed < faceFixed - DIMENSION_TICK_FACE_TOLERANCE) return null;
  const mid = { x: (line.a.x + line.b.x) / 2, y: (line.a.y + line.b.y) / 2 };
  const along = mid.x * seed.ux + mid.y * seed.uy;
  if (along < interval.start - BAND_GAP_TOLERANCE || along > interval.end + BAND_GAP_TOLERANCE) return null;
  return { along, sourceId: line.id, length: line.length };
}

function dimensionChainEvidence(seed, partner, rawLines, interval) {
  const faces = [seed.fixed, partner.fixed];
  const evidence = faces.map((faceFixed) => {
    const ticks = rawLines
      .map((line) => lineCrossesFaceAt(line, seed, faceFixed, interval))
      .filter(Boolean)
      .sort((a, b) => a.along - b.along);
    const uniqueTicks = [];
    ticks.forEach((tick) => {
      if (!uniqueTicks.some((prior) => Math.abs(prior.along - tick.along) <= 4)) uniqueTicks.push(tick);
    });
    return { faceFixed, ticks: uniqueTicks };
  });
  const strongest = evidence.sort((a, b) => b.ticks.length - a.ticks.length)[0] || { ticks: [] };
  if (strongest.ticks.length < DIMENSION_CHAIN_MIN_TICKS) return null;
  return {
    type: "dimension-chain",
    tickCount: strongest.ticks.length,
    faceFixed: strongest.faceFixed,
    tickSourceIds: strongest.ticks.map((tick) => tick.sourceId).filter(Boolean),
    reason: `dimension chain evidence: ${strongest.ticks.length} repeated perpendicular ticks`,
  };
}

function structuralCrossings(lines, seed, faceAFixed, faceBFixed, interval) {
  const minFixed = Math.min(faceAFixed, faceBFixed) - JUNCTION_FACE_TOLERANCE;
  const maxFixed = Math.max(faceAFixed, faceBFixed) + JUNCTION_FACE_TOLERANCE;
  return lines
    .filter((line) => {
      const diff = angleDiffDeg(line.angle, seed.angle);
      if (diff < 25 || diff > 155) return false;
      if (line.length < MIN_WALL_LENGTH) return false;
      const aFixed = line.a.x * seed.nx + line.a.y * seed.ny;
      const bFixed = line.b.x * seed.nx + line.b.y * seed.ny;
      const lineMinFixed = Math.min(aFixed, bFixed);
      const lineMaxFixed = Math.max(aFixed, bFixed);
      return lineMinFixed <= maxFixed && lineMaxFixed >= minFixed;
    })
    .map((line) => {
      const p = line.a;
      const denom = seed.ux * line.uy - seed.uy * line.ux;
      if (Math.abs(denom) < 0.0001) return null;
      const dx = p.x - pointOn(seed, 0, 0).x;
      const dy = p.y - pointOn(seed, 0, 0).y;
      const along = (dx * line.uy - dy * line.ux) / denom;
      return along >= interval.start - BAND_GAP_TOLERANCE && along <= interval.end + BAND_GAP_TOLERANCE
        ? { along, sourceId: line.id, confidence: Math.min(0.92, 0.62 + Math.min(0.2, line.length / 600)) }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.along - b.along);
}

function trimIntervalToJunctions(lines, seed, faceAFixed, faceBFixed, interval) {
  const crossings = structuralCrossings(lines, seed, faceAFixed, faceBFixed, interval);
  if (crossings.length < 2) {
    return { ...interval, startSource: "face-termination", endSource: "face-termination", crossings };
  }
  const start = crossings[0].along;
  const end = crossings[crossings.length - 1].along;
  if (end - start < MIN_WALL_LENGTH) {
    return { ...interval, startSource: "face-termination", endSource: "face-termination", crossings };
  }
  return { start, end, startSource: "structural-intersection", endSource: "structural-intersection", crossings };
}

function sameFaceLines(lines, seed, fixed) {
  return lines.filter((line) => (
    angleDiffDeg(line.angle, seed.angle) <= PARALLEL_TOLERANCE_DEG &&
    Math.abs(line.fixed - fixed) <= SAME_FACE_TOLERANCE
  ));
}

function stableWallId(start, end, thickness) {
  const points = [
    `${Math.round(start.x)}-${Math.round(start.y)}`,
    `${Math.round(end.x)}-${Math.round(end.y)}`,
  ].sort();
  return `hl-wall-${points[0]}-${points[1]}-${Math.round(thickness * 10) / 10}`;
}

function candidateDebug(type, seed, partner, pointerDistance, reason, extra = {}) {
  return {
    candidateType: type,
    coordinates: {
      seed: seed ? { start: seed.a, end: seed.b } : null,
      partner: partner ? { start: partner.a, end: partner.b } : null,
    },
    length: seed && partner ? Math.max(seed.length || 0, partner.length || 0) : seed?.length || 0,
    distanceFromPointer: pointerDistance,
    representation: partner ? "paired wall band" : "single vector stroke",
    belongsToDimensionChain: Boolean(extra.dimensionEvidence),
    reason,
    ...extra,
  };
}

function makeCandidate(seed, partner, lines, rawLines, pointer, pointerDistance, searchRadiusDocUnits) {
  const thickness = Math.abs(seed.fixed - partner.fixed);
  if (thickness < MIN_THICKNESS || thickness > MAX_THICKNESS) {
    return { rejected: true, debug: candidateDebug("parallel-pair", seed, partner, pointerDistance, `thickness ${Math.round(thickness * 10) / 10} outside range`) };
  }
  if (overlap(seed, partner) < MIN_FACE_OVERLAP) {
    return { rejected: true, debug: candidateDebug("parallel-pair", seed, partner, pointerDistance, "parallel faces do not overlap") };
  }

  const pointerAlong = pointer.x * seed.ux + pointer.y * seed.uy;
  const pointerFixed = pointer.x * seed.nx + pointer.y * seed.ny;
  const faceAFixed = seed.fixed;
  const faceBFixed = partner.fixed;
  const minFaceFixed = Math.min(faceAFixed, faceBFixed);
  const maxFaceFixed = Math.max(faceAFixed, faceBFixed);
  const bandDistance = pointerFixed < minFaceFixed
    ? minFaceFixed - pointerFixed
    : pointerFixed > maxFaceFixed
      ? pointerFixed - maxFaceFixed
      : 0;
  if (bandDistance > Math.max(2, searchRadiusDocUnits)) {
    return { rejected: true, debug: candidateDebug("parallel-pair", seed, partner, pointerDistance, `pointer ${Math.round(bandDistance * 10) / 10} outside wall band`) };
  }
  const faceALines = sameFaceLines(lines, seed, faceAFixed);
  const faceBLines = sameFaceLines(lines, seed, faceBFixed);
  const assemblyInterval = buildWallAssemblyInterval({ faceALines, faceBLines, rawLines, seed, faceAFixed, faceBFixed, pointerAlong, pointerTolerance: Math.max(2, searchRadiusDocUnits) });
  if (!assemblyInterval) return { rejected: true, debug: candidateDebug("parallel-pair", seed, partner, pointerDistance, "missing wall face interval") };

  const rawInterval = {
    start: assemblyInterval.start,
    end: assemblyInterval.end,
  };
  const dimensionEvidence = dimensionChainEvidence(seed, partner, rawLines, rawInterval);
  if (dimensionEvidence) {
    return { rejected: true, debug: candidateDebug("dimension-chain", seed, partner, pointerDistance, dimensionEvidence.reason, { dimensionEvidence }) };
  }
  const supportedInterval = trimIntervalToJunctions(lines, seed, faceAFixed, faceBFixed, rawInterval);
  const startAlong = supportedInterval.start;
  const endAlong = supportedInterval.end;
  const length = endAlong - startAlong;
  if (length < MIN_WALL_LENGTH) return { rejected: true, debug: candidateDebug("parallel-pair", seed, partner, pointerDistance, `length ${Math.round(length)} below wall minimum`) };

  const centerFixed = (faceAFixed + faceBFixed) / 2;
  const startJunction = pointOn(seed, startAlong, centerFixed);
  const endJunction = pointOn(seed, endAlong, centerFixed);
  const faceA = { start: pointOn(seed, startAlong, faceAFixed), end: pointOn(seed, endAlong, faceAFixed) };
  const faceB = { start: pointOn(seed, startAlong, faceBFixed), end: pointOn(seed, endAlong, faceBFixed) };
  const faceSupport = new Set(assemblyInterval.sourceIds || []).size;
  const sections = wallSectionsFromAssembly(assemblyInterval, startAlong, length);
  const openings = sections
    .filter((section) => section.type !== "solid")
    .map((section, index) => ({
      id: section.openingId || `op-${index + 1}`,
      type: section.type,
      startOffset: section.startOffset,
      endOffset: section.endOffset,
      width: section.endOffset - section.startOffset,
      confidence: section.confidence,
      reason: section.reason,
    }));
  const pointerDistanceForDiagnostics = pointerAlong >= startAlong - BAND_GAP_TOLERANCE && pointerAlong <= endAlong + BAND_GAP_TOLERANCE
    ? Math.min(pointerDistance, bandDistance)
    : pointerDistance;
  const thicknessScore = thickness >= 5 && thickness <= 22 ? 0.16 : 0.08;
  const lengthScore = Math.min(0.18, length / 900);
  const supportScore = Math.min(0.16, faceSupport * 0.035);
  const distanceScore = Math.max(0, 0.16 - pointerDistanceForDiagnostics / 90);
  const confidence = Math.min(0.96, 0.38 + thicknessScore + lengthScore + supportScore + distanceScore);
  if (confidence < MIN_CONFIDENCE) return { rejected: true, debug: candidateDebug("parallel-pair", seed, partner, pointerDistance, `confidence ${confidence.toFixed(2)} below threshold`) };

  return {
    id: stableWallId(startJunction, endJunction, thickness),
    axis: { start: startJunction, end: endJunction },
    centreline: { start: startJunction, end: endJunction },
    faces: { exterior: [faceA.start, faceA.end], interior: [faceB.start, faceB.end] },
    faceA,
    faceB,
    thickness,
    sections,
    openings,
    startJunction,
    endJunction,
    confidence,
    endpointReview: supportedInterval.crossings.length < 2 ? "Needs endpoint review" : null,
    source: "local-vector-wall-band",
    sourceSegmentIds: [...new Set(assemblyInterval.sourceIds || [])],
    diagnostics: {
      pointerDistance: pointerDistanceForDiagnostics,
      candidateLength: length,
      parallelFaces: 2,
      estimatedThickness: thickness,
      openingCount: openings.length,
      bridgeReasons: openings.map((opening) => opening.reason),
      startJunction,
      endJunction,
      startSource: supportedInterval.startSource,
      endSource: supportedInterval.endSource,
      reason: supportedInterval.crossings.length >= 2 ? "accepted and trimmed to structural intersections" : "accepted parallel structural wall band",
      rasterEvidence: "not-used",
    },
    debug: candidateDebug("structural-wall-band", seed, partner, pointerDistance, supportedInterval.crossings.length >= 2 ? "accepted structural wall band with adjoining junctions" : "accepted wall band but endpoints need review", {
      dimensionEvidence: null,
      centreline: { start: startJunction, end: endJunction },
      thickness,
      confidence,
      openings,
    }),
  };
}

export function findHighlightableWallAtPoint({ point, planGeometryIndex, page = {}, searchRadiusDocUnits = 12, diagnosticsEnabled = false } = {}) {
  if (!point || !planGeometryIndex) return { wall: null, diagnostics: [] };
  const diagnostics = [];
  const all = rawSegments(planGeometryIndex);
  const rawLines = orientedRawSegments(all);
  const lines = all
    .map((segment) => {
      const reason = rejectionReason(segment, page);
      if (reason) {
        if (diagnosticsEnabled) diagnostics.push({ id: segment?.id, accepted: false, reason });
        return null;
      }
      return oriented(segment);
    })
    .filter(Boolean);
  const radius = Math.max(2, searchRadiusDocUnits);
  const seedHits = lines
    .map((line) => {
      const projected = nearestPointOnSegment(point, line.a, line.b);
      return { line, distance: distance(point, projected) };
    })
    .filter((hit) => hit.distance <= radius + MAX_GARAGE_GAP)
    .sort((a, b) => a.distance - b.distance);

  const candidates = [];
  const seedLines = seedHits.length ? seedHits.slice(0, 32) : lines.slice(0, 80).map((line) => ({ line, distance: 0 }));
  seedLines.forEach(({ line: seed, distance: pointerDistance }) => {
    lines.forEach((partner) => {
      if (partner.id === seed.id) return;
      if (angleDiffDeg(seed.angle, partner.angle) > PARALLEL_TOLERANCE_DEG) return;
      const candidate = makeCandidate(seed, partner, lines, rawLines, point, pointerDistance, radius);
      if (candidate.rejected) {
        if (diagnosticsEnabled) diagnostics.push({ seedId: seed.id, partnerId: partner.id, accepted: false, ...(candidate.debug || {}) });
        return;
      }
      candidates.push(candidate);
    });
  });

  const unique = new Map();
  candidates.forEach((candidate) => {
    const prior = unique.get(candidate.id);
    if (!prior || candidate.confidence > prior.confidence) unique.set(candidate.id, candidate);
  });
  const sorted = [...unique.values()].sort((a, b) => (
    b.confidence - a.confidence ||
    a.diagnostics.pointerDistance - b.diagnostics.pointerDistance ||
    b.diagnostics.candidateLength - a.diagnostics.candidateLength
  ));
  if (diagnosticsEnabled) {
    sorted.slice(0, 3).forEach((candidate) => diagnostics.push({ ...candidate.diagnostics, ...candidate.debug, id: candidate.id, accepted: true }));
  }
  return { wall: sorted[0] || null, diagnostics };
}
