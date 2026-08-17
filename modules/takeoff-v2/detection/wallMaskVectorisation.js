import { createNormalisedOpening, createNormalisedWall } from "./normalisedGeometry.js";
import { connectedComponents } from "./wallPreprocessing.js";

export function vectoriseSemanticWallMasks(segmentation = {}, { mmPerPixel = null, minWallLengthPx = 4 } = {}) {
  const masks = segmentation.masks || segmentation;
  const exteriorWalls = vectoriseWallMask(masks.exteriorWallMask, {
    type: "exterior",
    source: segmentation.provider || "semantic-segmentation",
    confidence: segmentation.confidence ?? 0.7,
    mmPerPixel,
    minWallLengthPx,
  });
  const interiorWalls = vectoriseWallMask(masks.interiorWallMask, {
    type: "interior",
    source: segmentation.provider || "semantic-segmentation",
    confidence: segmentation.confidence ?? 0.65,
    mmPerPixel,
    minWallLengthPx,
  });
  const openings = [
    ...vectoriseOpeningMask(masks.doorMask, { type: "door", source: segmentation.provider || "semantic-segmentation", confidence: segmentation.confidence ?? 0.65, mmPerPixel }),
    ...vectoriseOpeningMask(masks.windowMask, { type: "window", source: segmentation.provider || "semantic-segmentation", confidence: segmentation.confidence ?? 0.65, mmPerPixel }),
  ];
  return {
    walls: [...exteriorWalls, ...interiorWalls],
    openings,
    diagnostics: {
      exteriorWallCount: exteriorWalls.length,
      interiorWallCount: interiorWalls.length,
      openingCount: openings.length,
      vectorisation: "connected-component-centrelines",
    },
  };
}

export function vectoriseWallMask(mask, { type = "unknown", source = "semantic-segmentation", confidence = 0.7, mmPerPixel = null, minWallLengthPx = 4 } = {}) {
  if (!mask?.data) return [];
  const runs = [
    ...extractAxisWallRuns(mask, { axis: "horizontal", minWallLengthPx }),
    ...extractAxisWallRuns(mask, { axis: "vertical", minWallLengthPx }),
  ];
  const sourceShapes = runs.length ? runs : connectedComponents(mask, { minPixels: 1 });
  return sourceShapes
    .map((shape, index) => wallFromShape(shape, { type, source, confidence, mmPerPixel, index }))
    .filter((wall) => wall && wall.lengthDocUnits >= minWallLengthPx);
}

export function vectoriseOpeningMask(mask, { type = "opening", source = "semantic-segmentation", confidence = 0.65, mmPerPixel = null } = {}) {
  if (!mask?.data) return [];
  return connectedComponents(mask, { minPixels: 1 })
    .map((component, index) => openingFromComponent(component, { type, source, confidence, mmPerPixel, index }))
    .filter(Boolean);
}

function wallFromShape(shape, { type, source, confidence, mmPerPixel, index }) {
  const width = shape.maxX - shape.minX + 1;
  const height = shape.maxY - shape.minY + 1;
  const horizontal = shape.axis ? shape.axis === "horizontal" : width >= height;
  const centreY = (shape.minY + shape.maxY + 1) / 2;
  const centreX = (shape.minX + shape.maxX + 1) / 2;
  const start = horizontal ? { x: shape.minX, y: centreY } : { x: centreX, y: shape.minY };
  const end = horizontal ? { x: shape.maxX + 1, y: centreY } : { x: centreX, y: shape.maxY + 1 };
  const thicknessPx = horizontal ? height : width;
  const faceA = horizontal
    ? { start: { x: shape.minX, y: shape.minY }, end: { x: shape.maxX + 1, y: shape.minY } }
    : { start: { x: shape.minX, y: shape.minY }, end: { x: shape.minX, y: shape.maxY + 1 } };
  const faceB = horizontal
    ? { start: { x: shape.minX, y: shape.maxY + 1 }, end: { x: shape.maxX + 1, y: shape.maxY + 1 } }
    : { start: { x: shape.maxX + 1, y: shape.minY }, end: { x: shape.maxX + 1, y: shape.maxY + 1 } };
  return createNormalisedWall({
    id: `seg-${type}-wall-${index + 1}`,
    type,
    start,
    end,
    thicknessMm: mmPerPixel ? thicknessPx * mmPerPixel : null,
    innerFace: type === "exterior" ? faceB : null,
    outerFace: type === "exterior" ? faceA : null,
    source,
    confidence,
    providerGeometry: {
      maskBoundingBox: {
        x: shape.minX,
        y: shape.minY,
        width,
        height,
      },
      thicknessPx,
      orientation: horizontal ? "horizontal" : "vertical",
    },
    metadata: {
      classification: type,
      confidenceLabel: confidence >= 0.8 ? "HIGH" : confidence >= 0.55 ? "MEDIUM" : "LOW",
    },
  });
}

function extractAxisWallRuns(mask, { axis, minWallLengthPx }) {
  const horizontal = axis === "horizontal";
  const primaryLimit = horizontal ? mask.height : mask.width;
  const secondaryLimit = horizontal ? mask.width : mask.height;
  const minRunLength = Math.max(12, minWallLengthPx);
  const candidates = [];
  for (let primary = 0; primary < primaryLimit; primary += 1) {
    let runStart = null;
    for (let secondary = 0; secondary <= secondaryLimit; secondary += 1) {
      const value = secondary < secondaryLimit
        ? horizontal
          ? mask.data[primary * mask.width + secondary]
          : mask.data[secondary * mask.width + primary]
        : 0;
      if (value && runStart === null) runStart = secondary;
      if (!value && runStart !== null) {
        if (secondary - runStart >= minRunLength) {
          candidates.push(horizontal
            ? { axis, minX: runStart, maxX: secondary - 1, minY: primary, maxY: primary }
            : { axis, minX: primary, maxX: primary, minY: runStart, maxY: secondary - 1 });
        }
        runStart = null;
      }
    }
  }
  return mergeAxisRuns(candidates, axis);
}

function mergeAxisRuns(runs, axis) {
  const horizontal = axis === "horizontal";
  const sorted = [...runs].sort((a, b) => (horizontal ? a.minY - b.minY || a.minX - b.minX : a.minX - b.minX || a.minY - b.minY));
  const merged = [];
  sorted.forEach((run) => {
    const current = merged[merged.length - 1];
    const overlaps = current && (horizontal
      ? run.minY <= current.maxY + 1 && intervalsCompatible(run.minX, run.maxX, current.minX, current.maxX)
      : run.minX <= current.maxX + 1 && intervalsCompatible(run.minY, run.maxY, current.minY, current.maxY));
    if (overlaps) {
      current.minX = Math.min(current.minX, run.minX);
      current.maxX = Math.max(current.maxX, run.maxX);
      current.minY = Math.min(current.minY, run.minY);
      current.maxY = Math.max(current.maxY, run.maxY);
    } else {
      merged.push({ ...run });
    }
  });
  return merged;
}

function intervalsCompatible(a1, a2, b1, b2) {
  return intervalsOverlap(a1, a2, b1, b2, 0.45) || Math.abs(a1 - b1) <= 10 || Math.abs(a2 - b2) <= 10;
}

function intervalsOverlap(a1, a2, b1, b2, ratio = 0.5) {
  const overlap = Math.max(0, Math.min(a2, b2) - Math.max(a1, b1) + 1);
  return overlap >= Math.min(a2 - a1 + 1, b2 - b1 + 1) * ratio;
}

function openingFromComponent(component, { type, source, confidence, mmPerPixel, index }) {
  const width = component.maxX - component.minX + 1;
  const height = component.maxY - component.minY + 1;
  const horizontal = width >= height;
  const centreY = (component.minY + component.maxY) / 2;
  const centreX = (component.minX + component.maxX) / 2;
  const start = horizontal ? { x: component.minX, y: centreY } : { x: centreX, y: component.minY };
  const end = horizontal ? { x: component.maxX + 1, y: centreY } : { x: centreX, y: component.maxY + 1 };
  return createNormalisedOpening({
    id: `seg-${type}-${index + 1}`,
    type,
    start,
    end,
    widthMm: mmPerPixel ? Math.max(width, height) * mmPerPixel : null,
    source,
    confidence,
    providerGeometry: {
      maskBoundingBox: { x: component.minX, y: component.minY, width, height },
      orientation: horizontal ? "horizontal" : "vertical",
    },
  });
}
