import { EXTERIOR_WALL_CLASSES, EXTERIOR_CONSTRUCTION_SYSTEMS, INTERIOR_CONSTRUCTION_SYSTEMS, CLADDING_PRODUCTS, CLADDING_PRODUCT_CUSTOM, POST_CORE_TYPES, TIMBER_POST_SIZE_OPTIONS, STEEL_SECTION_TYPES, POST_SURROUND_TYPES, POST_BRICK_FINISH_OPTIONS } from '../takeoffRunData.js';

// Which exteriorFinish values are valid for a given constructionSystem. A wall system with no
// finish concept here (core-filled blockwork keeps "rendered" as its one legacy-compatible value;
// double brick and custom have none) simply has an empty list, rejecting any finish at all.
const EXTERIOR_FINISH_CHOICES = {
  brick_veneer: ['face_brick', 'rendered_brick'],
  core_filled_blockwork: ['rendered'],
  lightweight_cladding: CLADDING_PRODUCTS,
};
import { validateAnalysisEvidence } from './analysisEvidence.js';

// These are the active canvas's accepted values. Do not substitute the smaller
// downstream material-thickness list or the abandoned overlay schema.
const WALL_THICKNESSES = [70, 90, 100, 110, 140, 150, 200, 230, 270, 300, 350];
const LEVELS = ['Ground Floor', 'Second Level', 'Third Level', 'Unassigned'];
const OPENING_CLASSES = ['Window', 'Internal Door', 'External Door', 'Garage Door', 'Large Glazed/Stacker/Sliding Door', 'Other Opening'];
const AREA_CATEGORIES = ['Tiles', 'Hybrid', 'Carpets', 'Polished Concrete', 'exposed Agg', 'Roof Area'];
const FLOORPLANS = {
  Footprint: { label: 'Outer Footprint', color: 'rgba(33, 150, 243, 0.25)', stroke: '#1565c0' },
  Living: { label: 'Living Area', color: 'rgba(76, 175, 80, 0.3)', stroke: '#2e7d32' },
  Garage: { label: 'Garage', color: 'rgba(158, 158, 158, 0.35)', stroke: '#616161' },
  Alfresco: { label: 'Alfresco', color: 'rgba(255, 152, 0, 0.3)', stroke: '#ef6c00' },
  Patio: { label: 'Patio', color: 'rgba(233, 30, 99, 0.25)', stroke: '#c2185b' },
  Porch: { label: 'Porch', color: 'rgba(236, 72, 153, 0.25)', stroke: '#be185d' },
  Balcony: { label: 'Balcony', color: 'rgba(0, 188, 212, 0.25)', stroke: '#00838f' },
  Other: { label: 'Other Non-Living', color: 'rgba(121, 85, 72, 0.28)', stroke: '#5d4037' },
};

function requireValue(condition, message) {
  if (!condition) throw new Error(`AI takeoff: ${message}`);
}

function text(value, label) {
  requireValue(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string.`);
  return value;
}

function positive(value, label) {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value > 0, `${label} must be a positive finite number.`);
  return value;
}

function optionalPositive(value, label) {
  if (value === undefined || value === null) return null;
  return positive(value, label);
}

function option(value, choices, label) {
  requireValue(choices.includes(value), `${label} must be one of: ${choices.join(', ')}.`);
  return value;
}

function optionalText(value, label, fallback = '') {
  if (value === undefined) return fallback;
  requireValue(typeof value === 'string', `${label} must be a string.`);
  return value;
}

function optionalBoolean(value, label, fallback) {
  if (value === undefined) return fallback;
  requireValue(typeof value === 'boolean', `${label} must be a boolean.`);
  return value;
}

function optionalOption(value, choices, label) {
  if (value === undefined || value === null) return undefined;
  requireValue(choices.includes(value), `${label} must be one of: ${choices.join(', ')}.`);
  return value;
}

// A wall's frame thickness (separate from its overall/nominal system thickness) is only ever 70mm
// or 90mm timber, or explicitly absent (a system with no frame at all, such as core-filled
// blockwork). Undefined means the caller did not supply a value and canonical classification
// derives one later; it is not the same as an explicit null.
function optionalFrameThicknessMm(value, label) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  requireValue(value === 70 || value === 90, `${label} must be 70, 90 or null.`);
  return value;
}

function sameScale(value, scale, label) {
  if (value === undefined) return;
  positive(value, label);
  requireValue(value === scale, `${label} differs from the job calibration; mixed scales are not supported.`);
}

function samePoint(a, b) { return a.x === b.x && a.y === b.y; }
function cross(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function onSegment(a, b, point) {
  return cross(a, b, point) === 0 && point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x)
    && point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y);
}
function intersects(a, b, c, d) {
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  if (onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)) return true;
  return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0))
    && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0));
}

function validatePolygon(nodes, label) {
  requireValue(nodes.length >= 3, `${label} needs at least three vertices.`);
  let twiceArea = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const next = (i + 1) % nodes.length;
    requireValue(!samePoint(nodes[i], nodes[next]), `${label} has a zero-length edge.`);
    twiceArea += nodes[i].x * nodes[next].y - nodes[next].x * nodes[i].y;
    for (let j = i + 1; j < nodes.length; j += 1) {
      const after = (j + 1) % nodes.length;
      if (next === j || after === i) continue;
      requireValue(!intersects(nodes[i], nodes[next], nodes[j], nodes[after]), `${label} must not self-intersect.`);
    }
  }
  requireValue(Number.isFinite(twiceArea) && Math.abs(twiceArea) > 1e-9, `${label} must have a non-zero finite area.`);
  return nodes;
}

function pointInside(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if (onSegment(a, b, point)) return true;
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function polygonsIntersect(a, b) {
  return a.some((point, i) => b.some((other, j) => intersects(point, a[(i + 1) % a.length], other, b[(j + 1) % b.length])));
}

function coordinateConverter(detection, page) {
  const label = `Detection ${detection.detectionId}`;
  const coordinates = detection.coordinates;
  requireValue(coordinates && typeof coordinates === 'object', `${label} needs an explicit coordinates.space.`);
  requireValue(Object.keys(coordinates).every((key) => ['space', 'width', 'height'].includes(key)), `${label} coordinates must describe the full unrotated page; crop/rotation/transforms are not supported.`);
  const space = option(coordinates.space, ['logical', 'normalized', 'image'], `${label} coordinates.space`);
  const width = space === 'normalized' ? 1 : space === 'image'
    ? positive(coordinates.width, `${label} image width`) : page.logicalWidth;
  const height = space === 'normalized' ? 1 : space === 'image'
    ? positive(coordinates.height, `${label} image height`) : page.logicalHeight;
  return (point) => {
    requireValue(point && typeof point.x === 'number' && Number.isFinite(point.x)
      && typeof point.y === 'number' && Number.isFinite(point.y), `${label} coordinates must be finite numbers.`);
    requireValue(point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height, `${label} coordinates are outside page bounds.`);
    // Logical coordinates are already canonical; retain their exact values.
    if (space === 'logical') return { x: point.x, y: point.y };
    // Divide before multiplying to avoid overflowing valid finite source coordinates.
    return { x: point.x / width * page.logicalWidth, y: point.y / height * page.logicalHeight };
  };
}

/**
 * Validate an entire detection batch, then return only canonical canvas objects.
 * This function has no state, storage, network, timestamps, or mutation side effects.
 * Normalized coordinates are fractions [0, 1]; image coordinates require raster
 * width/height. Every page uses the existing job's single pixelsPerMm calibration.
 */
export function convertAiTakeoffDetections(batch, context) {
  requireValue(batch && typeof batch === 'object' && context && typeof context === 'object', 'batch and context are required.');
  const identity = {};
  for (const key of ['jobId', 'takeoffId', 'documentHash']) {
    identity[key] = text(context[key], `Context ${key}`);
    requireValue(text(batch[key], `Batch ${key}`) === identity[key], `Batch ${key} does not match the active job/document.`);
  }
  const runId = text(batch.runId, 'runId');
  const modelVersion = text(batch.modelVersion, 'modelVersion');
  const scale = positive(context.pixelsPerMm, 'pixelsPerMm calibration');
  sameScale(batch.pixelsPerMm, scale, 'Batch pixelsPerMm');
  requireValue(!batch.pageScales && !batch.calibrations, 'Per-page calibration is not supported.');
  requireValue(Array.isArray(context.pages) && context.pages.length > 0, 'Context needs loaded page dimensions.');
  const pages = new Map();
  for (const page of context.pages) {
    requireValue(page && Number.isInteger(page.pageNumber) && page.pageNumber > 0, 'Context pageNumber must be a positive integer.');
    requireValue(!pages.has(page.pageNumber), `Duplicate context page ${page.pageNumber}.`);
    positive(page.logicalWidth, `Page ${page.pageNumber} logicalWidth`);
    positive(page.logicalHeight, `Page ${page.pageNumber} logicalHeight`);
    sameScale(page.pixelsPerMm, scale, `Page ${page.pageNumber} pixelsPerMm`);
    pages.set(page.pageNumber, page);
  }
  requireValue(Array.isArray(batch.detections), 'detections must be an array.');
  const detections = new Map();
  const canonicalIds = new Map();
  for (const detection of batch.detections) {
    requireValue(detection && typeof detection === 'object', 'Each detection must be an object.');
    const detectionId = text(detection.detectionId, 'detectionId');
    requireValue(!detections.has(detectionId), `Duplicate detectionId ${detectionId}.`);
    option(detection.kind, ['wall', 'opening', 'floorplan', 'area', 'pillar', 'eave'], `Detection ${detectionId} kind`);
    requireValue(Number.isInteger(detection.page) && pages.has(detection.page), `Detection ${detectionId} must reference a loaded numeric page.`);
    requireValue(typeof detection.confidence === 'number' && Number.isFinite(detection.confidence)
      && detection.confidence >= 0 && detection.confidence <= 1, `Detection ${detectionId} confidence must be between 0 and 1.`);
    sameScale(detection.pixelsPerMm, scale, `Detection ${detectionId} pixelsPerMm`);
    // Encoding each component separately makes the delimiter unambiguous even if IDs contain it.
    const id = `ai:${[identity.jobId, identity.takeoffId, identity.documentHash, runId, detection.kind, detectionId].map(encodeURIComponent).join(':')}`;
    detections.set(detectionId, detection);
    canonicalIds.set(detectionId, id);
  }
  const existingWalls = new Map();
  requireValue(context.completedWallRuns === undefined || Array.isArray(context.completedWallRuns), 'completedWallRuns must be an array.');
  for (const wall of context.completedWallRuns || []) {
    if (wall?.id === undefined || wall?.id === null) continue;
    const key = String(wall.id);
    requireValue(!existingWalls.has(key), `Existing wall ID ${key} is ambiguous.`);
    existingWalls.set(key, wall);
  }
  const result = {
    completedWallRuns: [], placedOpenings: [], completedFloorplans: [], completedAreas: [],
    completedMeasurements: [], completedEaves: [], completedPillars: [],
  };
  for (const detection of batch.detections) {
    const label = `Detection ${detection.detectionId}`;
    const convertPoint = coordinateConverter(detection, pages.get(detection.page));
    const level = detection.level === undefined ? {} : { level: option(detection.level, LEVELS, `${label} level`) };
    const base = {
      id: canonicalIds.get(detection.detectionId), page: detection.page, ...level,
      source: 'ai', confidence: detection.confidence,
      ai: {
        runId, detectionId: detection.detectionId, documentHash: identity.documentHash, sourcePage: detection.page, modelVersion,
        ...(detection.analysisEvidence === undefined ? {} : { analysisEvidence: validateAnalysisEvidence(detection.analysisEvidence) }),
      },
    };
    const nodesFor = (value, polygon = false) => {
      requireValue(Array.isArray(value), `${label} nodes must be an array.`);
      const nodes = value.map(convertPoint);
      return polygon ? validatePolygon(nodes, label) : nodes;
    };
    if (detection.kind === 'wall') {
      const category = option(detection.category, ['exterior', 'interior'], `${label} category`);
      const nodes = nodesFor(detection.nodes);
      requireValue(nodes.length >= 2, `${label} wall needs at least two vertices.`);
      let lengthPx = 0;
      for (let i = 1; i < nodes.length; i += 1) {
        requireValue(!samePoint(nodes[i - 1], nodes[i]), `${label} wall has a zero-length segment.`);
        lengthPx += Math.hypot(nodes[i].x - nodes[i - 1].x, nodes[i].y - nodes[i - 1].y);
      }
      const lengthMm = positive(lengthPx / scale, `${label} computed wall length`);
      if (category === 'interior') requireValue(detection.exteriorType === undefined || detection.exteriorType === '', `${label} interior wall cannot carry an exterior type.`);
      if (category === 'interior') requireValue(detection.exteriorFinish === undefined, `${label} interior wall cannot carry an exterior finish.`);
      // Canonical construction-system fields (Phase 2A). All optional and additive: a detection
      // that omits them keeps working exactly as before, deriving its system/frame from the
      // legacy category/exteriorType/thicknessMm fields above when the schedule reads it.
      const constructionSystem = optionalOption(detection.constructionSystem, category === 'exterior' ? EXTERIOR_CONSTRUCTION_SYSTEMS : INTERIOR_CONSTRUCTION_SYSTEMS, `${label} constructionSystem`);
      const frameThicknessMm = optionalFrameThicknessMm(detection.frameThicknessMm, `${label} frameThicknessMm`);
      requireValue(detection.customSystemLabel === undefined || (constructionSystem === 'custom' && typeof detection.customSystemLabel === 'string'), `${label} customSystemLabel is only valid text for a custom constructionSystem.`);
      if (detection.exteriorFinish !== undefined) {
        const finishChoices = EXTERIOR_FINISH_CHOICES[constructionSystem] || [];
        requireValue(category === 'exterior' && finishChoices.includes(detection.exteriorFinish), `${label} exteriorFinish must be one of: ${finishChoices.join(', ') || 'none for this constructionSystem'}.`);
      }
      requireValue(detection.exteriorFinishCustomLabel === undefined || (detection.exteriorFinish === CLADDING_PRODUCT_CUSTOM && typeof detection.exteriorFinishCustomLabel === 'string'), `${label} exteriorFinishCustomLabel is only valid text when exteriorFinish is ${CLADDING_PRODUCT_CUSTOM}.`);
      result.completedWallRuns.push({
        ...base, category, nodes, lengthMm,
        thicknessMm: option(detection.thicknessMm, WALL_THICKNESSES, `${label} thicknessMm`),
        alignment: option(detection.alignment, ['outer', 'inner'], `${label} alignment`),
        exteriorType: category === 'exterior' ? option(detection.exteriorType ?? 'Other', EXTERIOR_WALL_CLASSES, `${label} exteriorType`) : '',
        ...(constructionSystem === undefined ? {} : { constructionSystem }),
        ...(frameThicknessMm === undefined ? {} : { frameThicknessMm }),
        // The frame size was not found on the plans or in Job Setup; 70 mm stands until confirmed.
        ...(detection.frameAssumed === true ? { frameAssumed: true } : {}),
        ...(category === 'exterior' && detection.exteriorFinish !== undefined ? { exteriorFinish: detection.exteriorFinish } : {}),
        ...(detection.exteriorFinish === CLADDING_PRODUCT_CUSTOM && detection.exteriorFinishCustomLabel !== undefined ? { exteriorFinishCustomLabel: detection.exteriorFinishCustomLabel } : {}),
        ...(constructionSystem === 'custom' && detection.customSystemLabel !== undefined ? { customSystemLabel: detection.customSystemLabel } : {}),
        linedFaces: option(detection.linedFaces ?? 2, [1, 2], `${label} linedFaces`),
        openingDeductionsEnabled: optionalBoolean(detection.openingDeductionsEnabled, `${label} openingDeductionsEnabled`, true),
        wallHeightM: detection.wallHeightM == null ? null : positive(detection.wallHeightM, `${label} wallHeightM`),
      });
    } else if (detection.kind === 'opening') {
      const type = option(detection.type, ['window', 'door'], `${label} type`);
      const openingClass = option(detection.openingClass, OPENING_CLASSES, `${label} openingClass`);
      requireValue((type === 'window') === (openingClass === 'Window'), `${label} type and openingClass conflict.`);
      const hasBatchHost = detection.hostDetectionId !== undefined;
      const hasExistingHost = detection.hostWallId !== undefined;
      // An observed opening whose wall could not be matched is still one opening: it is counted
      // and placed without a wall link (the canvas's existing "no host" state) for the estimator to attach.
      const unhosted = detection.unhosted === true;
      requireValue(unhosted ? !hasBatchHost && !hasExistingHost : hasBatchHost !== hasExistingHost, `${label} needs exactly one hostDetectionId or existing hostWallId.`);
      let host, hostWallId;
      if (unhosted) {
        hostWallId = '';
      } else if (hasBatchHost) {
        host = detections.get(text(detection.hostDetectionId, `${label} hostDetectionId`));
        requireValue(host?.kind === 'wall', `${label} hostDetectionId must identify a wall in this batch.`);
        hostWallId = canonicalIds.get(host.detectionId);
      } else {
        requireValue(typeof detection.hostWallId === 'string' || (typeof detection.hostWallId === 'number' && Number.isFinite(detection.hostWallId)), `${label} hostWallId must be a valid ID.`);
        host = existingWalls.get(String(detection.hostWallId));
        requireValue(host, `${label} hostWallId does not identify an existing wall.`);
        hostWallId = host.id;
      }
      requireValue(unhosted || host.page === detection.page, `${label} host wall must be on the same page.`);
      if (!unhosted && detection.level && detection.level !== 'Unassigned' && host.level && host.level !== 'Unassigned') {
        requireValue(detection.level === host.level, `${label} host wall has a conflicting level.`);
      }
      requireValue(detection.nodes === undefined || (Array.isArray(detection.nodes) && detection.nodes.length === 1 && detection.x === undefined && detection.y === undefined), `${label} opening must have one unambiguous point.`);
      const point = convertPoint(Array.isArray(detection.nodes) ? detection.nodes[0] : detection);
      result.placedOpenings.push({
        ...base, type, openingClass, ...point, hostWallId,
        // A located opening remains countable when its dimensions are not printed.
        // Null dimensions deliberately prevent area/architrave calculations.
        widthMm: optionalPositive(detection.widthMm, `${label} widthMm`),
        heightMm: optionalPositive(detection.heightMm, `${label} heightMm`),
        itemTag: optionalText(detection.itemTag, `${label} itemTag`, `${type === 'window' ? 'W' : 'D'} AI ${detection.detectionId}`),
        subType: optionalText(detection.subType, `${label} subType`, type === 'window' ? 'standard' : openingClass),
        glassType: optionalText(detection.glassType, `${label} glassType`),
        frameMaterial: optionalText(detection.frameMaterial, `${label} frameMaterial`),
        frameColour: optionalText(detection.frameColour, `${label} frameColour`),
        sillType: optionalText(detection.sillType, `${label} sillType`),
        brickSillRequired: optionalBoolean(detection.brickSillRequired, `${label} brickSillRequired`, false),
        location: optionalText(detection.location, `${label} location`),
        frameJambDetails: optionalText(detection.frameJambDetails, `${label} frameJambDetails`),
      });
    } else if (detection.kind === 'eave') {
      const nodes = nodesFor(detection.nodes);
      requireValue(nodes.length >= 2, `${label} eave needs at least two vertices.`);
      const lengthMm = positive(nodes.slice(1).reduce((sum, node, i) => sum + Math.hypot(node.x - nodes[i].x, node.y - nodes[i].y), 0) / scale, `${label} eave length`);
      const widthMm = optionalPositive(detection.widthMm, `${label} widthMm`);
      result.completedEaves.push({ ...base, nodes, lengthMm, widthMm, widthOption: widthMm && [450, 600, 900, 1200].includes(widthMm) ? String(widthMm) : 'Special', alignment: 'outer' });
    } else if (detection.kind === 'floorplan') {
      const type = option(detection.type, Object.keys(FLOORPLANS), `${label} floorplan type`);
      result.completedFloorplans.push({ ...base, type, ...FLOORPLANS[type], label: optionalText(detection.label, `${label} label`, FLOORPLANS[type].label), nodes: nodesFor(detection.nodes, true) });
    } else if (detection.kind === 'pillar') {
      // A pillar/post/column is a discrete vertical object, never a wall - its own kind, own
      // canonical fields, never folded into completedWallRuns or completedAreas.
      const coreType = optionalOption(detection.coreType, POST_CORE_TYPES, `${label} coreType`) || 'unclassified';
      requireValue(detection.steelSectionType === undefined || coreType === 'steel', `${label} steelSectionType is only valid for a steel core.`);
      requireValue(detection.steelSectionDesignation === undefined || coreType === 'steel', `${label} steelSectionDesignation is only valid for a steel core.`);
      requireValue(detection.timberSizeOption === undefined || coreType === 'timber', `${label} timberSizeOption is only valid for a timber core.`);
      requireValue(detection.brickFinish === undefined || coreType === 'brick', `${label} brickFinish is only valid for a brick/masonry core.`);
      requireValue(detection.coreCustomLabel === undefined || coreType === 'custom', `${label} coreCustomLabel is only valid for a custom core.`);
      const surroundType = optionalOption(detection.surroundType, POST_SURROUND_TYPES, `${label} surroundType`) || 'none';
      requireValue(surroundType !== 'none' || (detection.surroundWidthMm === undefined && detection.surroundDepthMm === undefined), `${label} surround dimensions require a surroundType other than none.`);
      requireValue(detection.surroundCustomLabel === undefined || surroundType === 'custom', `${label} surroundCustomLabel is only valid for a custom surround.`);
      result.completedPillars.push({
        ...base, nodes: nodesFor(detection.nodes, true),
        coreType,
        coreWidthMm: optionalPositive(detection.coreWidthMm, `${label} coreWidthMm`),
        coreDepthMm: optionalPositive(detection.coreDepthMm, `${label} coreDepthMm`),
        ...(coreType === 'steel' ? { steelSectionType: optionalOption(detection.steelSectionType, STEEL_SECTION_TYPES, `${label} steelSectionType`) || null } : {}),
        ...(coreType === 'steel' && detection.steelSectionDesignation !== undefined ? { steelSectionDesignation: optionalText(detection.steelSectionDesignation, `${label} steelSectionDesignation`) } : {}),
        ...(coreType === 'timber' ? { timberSizeOption: optionalOption(detection.timberSizeOption, TIMBER_POST_SIZE_OPTIONS, `${label} timberSizeOption`) || null } : {}),
        ...(coreType === 'brick' ? { brickFinish: optionalOption(detection.brickFinish, POST_BRICK_FINISH_OPTIONS, `${label} brickFinish`) || null } : {}),
        ...(coreType === 'custom' && detection.coreCustomLabel !== undefined ? { coreCustomLabel: optionalText(detection.coreCustomLabel, `${label} coreCustomLabel`) } : {}),
        surroundType,
        ...(surroundType !== 'none' ? {
          surroundWidthMm: optionalPositive(detection.surroundWidthMm, `${label} surroundWidthMm`),
          surroundDepthMm: optionalPositive(detection.surroundDepthMm, `${label} surroundDepthMm`),
        } : {}),
        ...(surroundType === 'custom' && detection.surroundCustomLabel !== undefined ? { surroundCustomLabel: optionalText(detection.surroundCustomLabel, `${label} surroundCustomLabel`) } : {}),
        heightMm: optionalPositive(detection.heightMm, `${label} heightMm`),
        quantity: detection.quantity === undefined ? 1 : positive(detection.quantity, `${label} quantity`),
        location: optionalText(detection.location, `${label} location`),
      });
    } else {
      const category = option(detection.category, AREA_CATEGORIES, `${label} area category`);
      const nodes = nodesFor(detection.nodes, true);
      requireValue(detection.exclusions === undefined || Array.isArray(detection.exclusions), `${label} exclusions must be an array.`);
      requireValue(category !== 'Roof Area' || !detection.exclusions?.length, `${label} roof exclusions are not supported by the current roof schedule.`);
      const exclusions = (detection.exclusions || []).map((exclusion, index) => ({ id: `${base.id}:exclusion:${index}`, nodes: nodesFor(exclusion?.nodes, true) }));
      exclusions.forEach((exclusion, index) => {
        requireValue(exclusion.nodes.every((point) => pointInside(point, nodes)) && !polygonsIntersect(exclusion.nodes, nodes), `${label} exclusion must lie inside its area.`);
        for (let i = 0; i < index; i += 1) requireValue(!polygonsIntersect(exclusion.nodes, exclusions[i].nodes)
          && !pointInside(exclusion.nodes[0], exclusions[i].nodes) && !pointInside(exclusions[i].nodes[0], exclusion.nodes), `${label} exclusions must not overlap.`);
      });
      result.completedAreas.push({ ...base, category, nodes, exclusions, ...(category === 'Roof Area' ? { level: detection.level || 'Unassigned' } : {}) });
    }
  }
  return result;
}
