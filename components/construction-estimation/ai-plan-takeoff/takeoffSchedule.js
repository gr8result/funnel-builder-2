import { assertTakeoffImportable, signatureFromSchedule } from './ai-integration/geometryValidation.js';
import { associateTakeoffMeasurements, takeoffMaterialFields, takeoffThickness, openingQuantity, openingDimensions, openingHostId, uniqueTakeoffItems, brickSillLength, windowCodeForOpening, isCavitySlider, isRobeSlider, internalDoorPurchaseType, materialRound, EXTERIOR_WALL_SYSTEM_FIELD_KEYS, windowStyleLabel, isFixedWindowOpening, doorStyleLabel, brickOrderQuantities, internalDoorJambTrace, internalDoorReconciliationTrace, TAKEOFF_LEVELS } from '../../../lib/construction-estimation/takeoffMaterialQuantities.js';
import { absentTakeoffMaterialFields } from '../../../lib/construction-estimation/takeoffAbsentMaterialFields.js';
import { ARCHITRAVE_DEFAULTS, ARCHITRAVE_RULES, packOpenings } from '../../../lib/construction-estimation/architraveCutting.js';
import { INPUT_DATA_SHEET_TEMPLATE } from '../../../lib/construction-estimation/inputDataSheetTemplate.js';
import { createAiScheduleRows, documentedInputCandidates } from './ai-integration/scheduleEvidence.js';
import { buildTakeoffReview, reviewAudience, reviewText } from './ai-integration/reviewSummary.js';
import { EXTERIOR_WALL_CLASSES, normaliseLevel, explicitLevel, resolveTakeoffLevel, importWallCategory, resolveExteriorClass, runLengthM, createExteriorClassificationTotals, resolveConstructionSystem, legacyExteriorClassFromSystem, EXTERIOR_CONSTRUCTION_SYSTEMS, INTERIOR_CONSTRUCTION_SYSTEMS, CONSTRUCTION_SYSTEM_LABELS, resolveOpeningRoom, resolvePostColumnCore, POST_SURROUND_TYPE_LABELS } from './takeoffRunData.js';

const DEFAULT_WALL_HEIGHT_M = 2.4;

const IMPORT_LEVELS = { 'Ground Floor': 'lower', 'Second Level': 'upper', 'Third Level': 'third' };

const FLOOR_AREA_LABELS = {
  Footprint: 'Gross building footprint',
  Living: 'Living area',
  Garage: 'Garage',
  Alfresco: 'Alfresco',
  Patio: 'Patio',
  Porch: 'Porch',
  Balcony: 'Balcony',
  Deck: 'Deck',
  Other: 'Other separately named areas'
};

const FLOOR_FINISH_UNITS = {
  Tiles: 'm2',
  Carpets: 'm2',
  Hybrid: 'm2',
  'Polished Concrete': 'm2',
  'exposed Agg': 'm2'
};

const OPENING_CLASSES = ['Window', 'Internal Door', 'External Door', 'Garage Door', 'Large Glazed/Stacker/Sliding Door', 'Other Opening'];

function round(value, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}

function polygonAreaM2(nodes, pixelsPerMm) {
  if (!nodes || nodes.length < 3 || !pixelsPerMm) return 0;
  let areaPx = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const j = (i + 1) % nodes.length;
    areaPx += nodes[i].x * nodes[j].y - nodes[j].x * nodes[i].y;
  }
  const areaMm2 = Math.abs(areaPx / 2) / (pixelsPerMm * pixelsPerMm);
  return areaMm2 / 1000000;
}

function openingAreaM2(opening) {
  const { widthMm, heightMm } = openingDimensions(opening);
  return widthMm * heightMm / 1000000 * openingQuantity(opening);
}

// A PDF sheet number does not identify a storey - sheet 3 of a two-storey set is not a third level -
// so a sheet's building level comes from what the estimator assigned to it, never from its position
// in the file. An unassigned sheet stays labelled by sheet number and imports nothing, which is what
// surfaces the "assign the measured plan sheets to building levels" warning.
function floorFromPage(page = 1, sheetLevels = {}) {
  const pageNumber = Number(page) || 1;
  const assigned = normaliseLevel(sheetLevels?.[pageNumber] ?? sheetLevels?.[String(pageNumber)]);
  if (assigned !== 'Unassigned') return { key: IMPORT_LEVELS[assigned], label: assigned };
  return { key: `sheet${pageNumber}`, label: `Sheet ${pageNumber}` };
}

function floorForItem(item, sheetLevels) {
  const level = resolveTakeoffLevel(item, sheetLevels);
  return level !== 'Unassigned' ? { key: IMPORT_LEVELS[level], label: level } : floorFromPage(item.page, sheetLevels);
}

function parseHeightM(value, fallback = DEFAULT_WALL_HEIGHT_M) {
  const num = Number(value?.value ?? value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  if (num > 20) return num / 1000;
  return num;
}

function wallHeightByFloor(jobSetupRows = {}) {
  return {
    lower: parseHeightM(jobSetupRows.lowerCeilingHeight, DEFAULT_WALL_HEIGHT_M),
    upper: parseHeightM(jobSetupRows.upperCeilingHeight, DEFAULT_WALL_HEIGHT_M),
    third: parseHeightM(jobSetupRows.thirdCeilingHeight, DEFAULT_WALL_HEIGHT_M)
  };
}

function classifyOpening(opening = {}) {
  const explicit = String(opening.openingClass || '').trim();
  if (OPENING_CLASSES.includes(explicit)) return explicit;
  const type = String(opening.type || '').toLowerCase();
  const subType = String(opening.subType || opening.windowStyle || opening.doorType || '').toLowerCase();
  if (type === 'window') return 'Window';
  if (isCavitySlider(opening) || isRobeSlider(opening)) return 'Internal Door';
  if (subType.includes('garage') || subType.includes('panel') || subType.includes('roller')) return 'Garage Door';
  if (subType.includes('stacker') || subType.includes('sliding') || subType.includes('glazed') || subType.includes('gsd')) return 'Large Glazed/Stacker/Sliding Door';
  if (subType.includes('internal')) return 'Internal Door';
  if (subType.includes('entry') || subType.includes('external')) return 'External Door';
  if (type === 'door') return 'External Door';
  return 'Other Opening';
}

function makeRow(section, itemId, category, quantity, unit, extra = {}) {
  return { section, itemId, category, quantity: round(quantity), unit, ...extra };
}

function createFloorAreaRows(floorplans = [], pixelsPerMm) {
  const rows = Object.keys(FLOOR_AREA_LABELS).map((type) => {
    const quantity = floorplans
      .filter((item) => item.type === type)
      .reduce((sum, item) => sum + polygonAreaM2(item.nodes, pixelsPerMm), 0);
    return makeRow('Floor Areas', `floor_${type}`, FLOOR_AREA_LABELS[type], quantity, 'm2');
  });

  const footprint = rows.find((row) => row.itemId === 'floor_Footprint')?.quantity || 0;
  const garage = rows.find((row) => row.itemId === 'floor_Garage')?.quantity || 0;
  const separatelyNamed = rows
    .filter((row) => !['floor_Footprint', 'floor_Living'].includes(row.itemId))
    .reduce((sum, row) => sum + row.quantity, 0);
  const livingRow = rows.find((row) => row.itemId === 'floor_Living');
  const livingMeasured = livingRow?.quantity || 0;
  const totalLiving = livingMeasured || Math.max(0, footprint - separatelyNamed);
  // Living area is normally not outlined on its own: it is the footprint less the garage,
  // alfresco and other named areas. Showing 0 here because no polygon is typed "Living" reads as
  // "this house has no living area"; show the same derived figure the totals use.
  if (livingRow && !livingMeasured && footprint > 0) {
    livingRow.quantity = round(totalLiving);
    livingRow.notes = 'Gross footprint less the separately named areas.';
  }

  rows.push(makeRow('Floor Areas', 'floor_total_living', 'Total living area', totalLiving, 'm2'));
  rows.push(makeRow('Floor Areas', 'floor_total_under_roof', 'Total under-roof area', footprint, 'm2'));
  rows.push(makeRow('Floor Areas', 'floor_garage_check', 'Garage', garage, 'm2'));
  return rows;
}

function createFloorFinishRows(finishes = [], pixelsPerMm) {
  const finishCategories = Array.from(new Set([
    ...Object.keys(FLOOR_FINISH_UNITS),
    ...finishes.map((area) => area.category).filter(Boolean)
  ]));

  return finishCategories.map((category) => {
    const quantity = finishes
      .filter((area) => area.category === category)
      .reduce((sum, area) => {
        const exclusions = (area.exclusions || []).reduce((exclusionSum, exclusion) => exclusionSum + polygonAreaM2(exclusion.nodes, pixelsPerMm), 0);
        return sum + Math.max(0, polygonAreaM2(area.nodes, pixelsPerMm) - exclusions);
      }, 0);
    return makeRow('Floor Finishes', `finish_${category}`, category, quantity, FLOOR_FINISH_UNITS[category] || 'm2');
  });
}

function createEaveRows(eaves = [], pixelsPerMm, sheetLevels = {}) {
  return Object.values(eaves.reduce((acc, eave) => {
    const widthLabel = eave.widthOption === 'Special' ? `${eave.widthMm}mm Special` : `${eave.widthMm || eave.widthOption}mm`;
    const level = resolveTakeoffLevel(eave, sheetLevels);
    const key = `${level}|${widthLabel}`;
    const lengthM = runLengthM(eave, pixelsPerMm);
    if (!acc[key]) {
      acc[key] = makeRow('Roof and Eaves', `eaves_${key}`, 'Eaves area', 0, 'm2', {
        level,
        eavesWidth: widthLabel,
        eavesLengthLm: 0,
        fasciaLengthLm: 0,
        gutterLengthLm: 0,
        downpipeQuantity: eave.downpipeQuantity || 0
      });
    }
    acc[key].eavesLengthLm = round(acc[key].eavesLengthLm + lengthM);
    // AI fascia and gutters require their own measured runs in the inclusion scope.
    const inferredEdgeLength = eave.source === 'ai' ? 0 : lengthM;
    acc[key].fasciaLengthLm = round(acc[key].fasciaLengthLm + inferredEdgeLength);
    acc[key].gutterLengthLm = round(acc[key].gutterLengthLm + inferredEdgeLength);
    acc[key].quantity = round(acc[key].quantity + lengthM * ((eave.widthMm || 0) / 1000));
    return acc;
  }, {}));
}

function createRoofAreaRows(areas = [], pixelsPerMm) {
  return Object.values(areas.reduce((rows, area) => {
    const level = area.level || 'Unassigned';
    if (!rows[level]) rows[level] = makeRow('Roof Areas', `roof_area_${level.replace(/\s+/g, '_').toLowerCase()}`, `Roof area - ${level}`, 0, 'm2', { level });
    rows[level].quantity = round(rows[level].quantity + polygonAreaM2(area.nodes, pixelsPerMm));
    return rows;
  }, {}));
}

function createRoomRows(measurements = []) {
  return measurements.map((measurement) => (
    makeRow('Rooms', measurement.id, 'Basic project measurement', measurement.lengthMm ? measurement.lengthMm / 1000 : 0, 'lm', {
      planSheet: measurement.page
    })
  ));
}

// Exported so downstream modules (Client Selections) can rebuild the window schedule from the
// persisted openings. The schedule object itself is derived state and is never saved, so this
// is the only way to get the same rows and counts the takeoff screen shows.
export function createWindowAndDoorSchedules(openings = [], sheetLevels = {}) {
  const windows = [];
  const doors = [];

  const windowBuckets = new Map();
  const doorBuckets = new Map();

  uniqueTakeoffItems(openings).forEach((opening) => {
    const openingClass = classifyOpening(opening);
    const floor = floorForItem(opening, sheetLevels);
    const { widthMm, heightMm } = openingDimensions(opening);
    const areaM2 = openingAreaM2(opening);

    if (openingClass === 'Window') {
      const key = [
        floor.label,
        String(opening.location || opening.room || '').trim() || 'Unspecified',
        String(opening.windowStyle || opening.subType || 'Standard').trim(),
        widthMm,
        heightMm,
        String(opening.glassType || '').trim(),
        String(opening.frameMaterial || '').trim(),
        String(opening.frameColour || '').trim(),
        String(opening.sillType || '').trim(),
        String(opening.brickSillRequired || '').trim()
      ].join('|');
      const windowRoom = resolveOpeningRoom(opening);
      const existing = windowBuckets.get(key) || {
        floor: floor.label,
        location: String(opening.location || opening.room || '').trim() || 'Unspecified',
        roomKey: windowRoom.roomKey,
        roomLabel: windowRoom.roomLabel,
        windowStyle: String(opening.windowStyle || opening.subType || 'Standard').trim(),
        quantity: 0,
        widthMm,
        heightMm,
        totalOpeningAreaM2: 0,
        frameMaterial: String(opening.frameMaterial || '').trim(),
        frameColour: String(opening.frameColour || '').trim(),
        glassType: String(opening.glassType || '').trim(),
        sillType: String(opening.sillType || '').trim(),
        brickSillRequired: Boolean(opening.brickSillRequired),
        brickSillLengthLm: 0,
        // The original drawing tag survives even when the size does not reduce to a standard
        // height/width shorthand code; windowCodeForOpening (derived from the actual documented
        // height/width, so it can never disagree with them) takes precedence when it exists.
        originalTag: String(opening.itemTag || '').trim(),
        hostWallId: String(opening.hostWallId || '').trim(),
        hostWallSystem: CONSTRUCTION_SYSTEM_LABELS[opening.hostConstructionSystem] || '',
        openings: [],
      };
      existing.openings.push({ id: String(opening.id), page: Number(opening.page || 1) });
      existing.quantity += openingQuantity(opening);
      existing.totalOpeningAreaM2 = round(existing.totalOpeningAreaM2 + areaM2);
      const fullHeight = heightMm >= 2100;
      const eligibleBrickSill = existing.brickSillRequired && !fullHeight && widthMm > 0;
      if (opening.brickSillLengthLm !== undefined) {
        existing.brickSillLengthLm = round(existing.brickSillLengthLm + opening.brickSillLengthLm);
      } else if (eligibleBrickSill) {
        existing.brickSillLengthLm = round(existing.brickSillLengthLm + (widthMm / 1000) * openingQuantity(opening));
      }
      windowBuckets.set(key, existing);
      return;
    }

    const externalOrInternal = openingClass === 'Internal Door' ? 'Internal' : 'External';
    // A door's subtype (Cavity Sliding, Barn, Hinged...) is a distinct physical construction with
    // its own framing requirement - grouping it with an ordinary hinged door of the same size would
    // silently lose that framing requirement (a cavity slider needs a cage; a hinged door does not).
    const doorStyle = doorStyleLabel(opening.subType) || 'Hinged';
    const cavitySlider = isCavitySlider(opening);
    const key = [
      floor.label,
      String(opening.location || opening.room || '').trim() || 'Unspecified',
      externalOrInternal,
      openingClass,
      doorStyle,
      widthMm,
      heightMm,
      String(opening.glassType || '').trim(),
      String(opening.frameJambDetails || opening.frameMaterial || '').trim()
    ].join('|');
    const room = resolveOpeningRoom(opening);
    const existing = doorBuckets.get(key) || {
      floor: floor.label,
      location: String(opening.location || opening.room || '').trim() || 'Unspecified',
      roomKey: room.roomKey,
      roomLabel: room.roomLabel,
      internalExternal: externalOrInternal,
      doorType: openingClass,
      doorStyle,
      isCavitySlider: cavitySlider,
      // For an interior-hosted door (which is what a cavity slider always is) the host wall's
      // measured thicknessMm IS its frame thickness - wallThicknessMm already reflects the cavity
      // pocket's forced 90mm upgrade from associateTakeoffMeasurements, so no separate field is
      // needed here.
      hostFrameThicknessMm: opening.wallThicknessMm ?? null,
      quantity: 0,
      widthMm,
      heightMm,
      totalOpeningAreaM2: 0,
      frameJambDetails: String(opening.frameJambDetails || opening.frameMaterial || '').trim(),
      glassType: String(opening.glassType || '').trim(),
      originalTag: String(opening.itemTag || '').trim(),
      hostWallId: String(opening.hostWallId || '').trim(),
      hostWallSystem: CONSTRUCTION_SYSTEM_LABELS[opening.hostConstructionSystem] || '',
      openings: [],
    };
    existing.openings.push({ id: String(opening.id), page: Number(opening.page || 1) });
    existing.brickSillLengthLm = round((existing.brickSillLengthLm || 0) + (opening.brickSillLengthLm || 0));
    existing.quantity += openingQuantity(opening);
    existing.totalOpeningAreaM2 = round(existing.totalOpeningAreaM2 + areaM2);
    doorBuckets.set(key, existing);
  });

  Array.from(windowBuckets.values()).forEach((row, index) => {
    windows.push({
      section: 'Windows',
      itemId: `window_schedule_${index + 1}`,
      mark: `W${index + 1}`,
      category: 'Window',
      unit: 'count',
      quantity: row.quantity,
      floor: row.floor,
      location: row.location,
      roomKey: row.roomKey,
      roomLabel: row.roomLabel,
      windowStyle: row.windowStyle,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
      // The height/width-derived shorthand is authoritative whenever it exists (it can never
      // disagree with the documented heightMm/widthMm it was built from); the original drawing tag
      // is the fallback for a genuinely non-standard size, so every row still has a real code.
      code: windowCodeForOpening({ openingClass: 'Window', heightMm: row.heightMm, widthMm: row.widthMm }) || row.originalTag || '',
      sizeLabel: row.heightMm && row.widthMm ? `${row.heightMm}H x ${row.widthMm}W` : '',
      hostWallId: row.hostWallId,
      hostWallSystem: row.hostWallSystem,
      openings: row.openings,
      totalOpeningAreaM2: row.totalOpeningAreaM2,
      frameMaterial: row.frameMaterial,
      frameColour: row.frameColour,
      glassType: row.glassType,
      sillType: row.sillType,
      brickSillRequired: row.brickSillRequired ? 'Yes' : 'No',
      brickSillLengthLm: row.brickSillLengthLm
    });
  });

  Array.from(doorBuckets.values()).forEach((row, index) => {
    doors.push({
      section: 'Doors',
      itemId: `door_schedule_${index + 1}`,
      mark: `D${index + 1}`,
      category: 'Door',
      unit: 'count',
      quantity: row.quantity,
      floor: row.floor,
      location: row.location,
      roomKey: row.roomKey,
      roomLabel: row.roomLabel,
      internalExternal: row.internalExternal,
      doorType: row.doorType,
      // doorStyle distinguishes a Cavity Sliding Door / Barn Door / Robe Slider from an ordinary
      // Hinged door - the Doors section must show this, not just the coarser openingClass, so a
      // cavity slider's framing requirement is never silently folded into "Internal Door".
      doorStyle: row.doorStyle,
      isCavitySlider: row.isCavitySlider,
      hostFrameThicknessMm: row.hostFrameThicknessMm,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
      code: row.originalTag || '',
      sizeLabel: row.heightMm && row.widthMm ? `${row.widthMm}W x ${row.heightMm}H` : '',
      hostWallId: row.hostWallId,
      hostWallSystem: row.hostWallSystem,
      openings: row.openings,
      totalOpeningAreaM2: row.totalOpeningAreaM2,
      brickSillLengthLm: row.brickSillLengthLm || 0,
      brickSillRequired: row.brickSillLengthLm > 0 ? 'Yes' : 'No',
      frameJambDetails: row.frameJambDetails,
      glassType: row.glassType
    });
  });

  const brickSillSubtotals = [...windows, ...doors].reduce((acc, row) => {
    if (row.brickSillRequired !== 'Yes') return acc;
    acc[row.floor] = round((acc[row.floor] || 0) + (Number(row.brickSillLengthLm) || 0));
    return acc;
  }, {});

  return {
    windows,
    doors,
    brickSillSubtotals,
    totalBrickSillLengthLm: round(Object.values(brickSillSubtotals).reduce((sum, value) => sum + value, 0))
  };
}

// A pillar's drawn footprint is the FINISHED/visible rectangle - the surround's outer face when a
// surround exists, or the core itself when it does not. Falls back to it only when the builder has
// not entered an explicit dimension, per "explicit entered/documented dimensions take precedence
// over scale-derived dimensions."
function pillarFootprintMm(pillar, pixelsPerMm) {
  const nodes = pillar.nodes || [];
  if (nodes.length < 3 || !(Number(pixelsPerMm) > 0)) return { widthMm: null, depthMm: null };
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const widthPx = Math.max(...xs) - Math.min(...xs);
  const depthPx = Math.max(...ys) - Math.min(...ys);
  return { widthMm: round(widthPx / pixelsPerMm, 0) || null, depthMm: round(depthPx / pixelsPerMm, 0) || null };
}

// A pillar/post/column's own type/size label, distinct from its optional surround - "100x100 SHS
// Steel", "150x150 Timber", "Face Brick" (masonry core, no separate "size" beyond width/depth).
function pillarCoreLabel(pillar, coreWidthMm, coreDepthMm) {
  const core = resolvePostColumnCore(pillar);
  const sizeText = coreWidthMm && coreDepthMm ? `${coreWidthMm}x${coreDepthMm}` : '';
  // A documented designation (e.g. "150 x 100", "Ø89" for a CHS) is the authoritative label for a
  // steel section when given - a CHS has one diameter, not a width x depth pair, so plain numeric
  // dimensions cannot always represent it.
  if (core.coreType === 'steel') return [pillar.steelSectionType, pillar.steelSectionDesignation || sizeText].filter(Boolean).join(' ') || core.displayLabel;
  if (core.coreType === 'timber') return sizeText ? `Timber ${sizeText}` : core.displayLabel;
  if (core.coreType === 'brick') return pillar.brickFinish || core.displayLabel;
  return core.displayLabel;
}

// Groups pillars/posts/columns by level, only merging rows whose full specification matches
// exactly (core type/size, surround type/size, height) - "Where identical posts/columns exist,
// group them only when all relevant specification fields match."
export function createPillarSchedule(pillars = [], pixelsPerMm, sheetLevels = {}) {
  const rows = [];
  const buckets = new Map();
  pillars.forEach((pillar) => {
    const floor = floorForItem(pillar, sheetLevels);
    const footprint = pillarFootprintMm(pillar, pixelsPerMm);
    const surroundType = pillar.surroundType && pillar.surroundType !== 'none' ? pillar.surroundType : 'none';
    // With no surround, the core IS the visible/finished footprint - fall back to the drawn
    // rectangle only when the builder has not entered an explicit core dimension.
    const coreWidthMm = pillar.coreWidthMm || (surroundType === 'none' ? footprint.widthMm : null);
    const coreDepthMm = pillar.coreDepthMm || (surroundType === 'none' ? footprint.depthMm : null);
    const finishedWidthMm = surroundType === 'none' ? coreWidthMm : (pillar.surroundWidthMm || footprint.widthMm);
    const finishedDepthMm = surroundType === 'none' ? coreDepthMm : (pillar.surroundDepthMm || footprint.depthMm);
    const room = resolveOpeningRoom(pillar);
    const key = [
      floor.label, pillar.coreType, coreWidthMm, coreDepthMm, pillar.steelSectionType, pillar.steelSectionDesignation, pillar.timberSizeOption,
      pillar.brickFinish, pillar.coreCustomLabel, surroundType, finishedWidthMm, finishedDepthMm,
      pillar.surroundCustomLabel, pillar.heightMm, room.roomLabel,
    ].join('|');
    const existing = buckets.get(key);
    if (existing) { existing.quantity += Number(pillar.quantity) || 1; existing.openings.push({ id: String(pillar.id), page: Number(pillar.page || 1) }); return; }
    buckets.set(key, {
      floor: floor.label, level: floor.label,
      typeLabel: pillarCoreLabel(pillar, coreWidthMm, coreDepthMm),
      coreType: pillar.coreType, coreWidthMm, coreDepthMm,
      steelSectionType: pillar.steelSectionType || null, steelSectionDesignation: pillar.steelSectionDesignation || null,
      surroundType, surroundLabel: POST_SURROUND_TYPE_LABELS[surroundType] || 'None',
      surroundWidthMm: surroundType === 'none' ? null : finishedWidthMm,
      surroundDepthMm: surroundType === 'none' ? null : finishedDepthMm,
      finishedWidthMm, finishedDepthMm,
      heightMm: pillar.heightMm || null,
      quantity: Number(pillar.quantity) || 1,
      roomKey: room.roomKey, roomLabel: room.roomLabel, location: pillar.location || room.roomLabel,
      classificationStatus: resolvePostColumnCore(pillar).classificationStatus,
      openings: [{ id: String(pillar.id), page: Number(pillar.page || 1) }],
    });
  });
  Array.from(buckets.values()).forEach((row, index) => {
    rows.push({
      section: 'Pillars, Posts & Columns',
      itemId: `pillar_schedule_${index + 1}`,
      mark: `P${index + 1}`,
      category: row.typeLabel,
      unit: 'count',
      ...row,
      sizeLabel: row.coreWidthMm && row.coreDepthMm ? `${row.coreWidthMm}x${row.coreDepthMm}` : '—',
      finishedSizeLabel: row.finishedWidthMm && row.finishedDepthMm ? `${row.finishedWidthMm}x${row.finishedDepthMm}` : (row.sizeLabel || '—'),
    });
  });
  return rows;
}

// The Job Setup Window Schedule: one row per external window or external door, the only
// openings that reduce an external wall's area. An ordinary internal door has no bearing on
// external wall area or brick sills, so it is left out entirely rather than shown and ignored -
// keeping this table's row count the same as what the M2 totals below are actually built from.
//
// This is the single traceable source for those M2 totals and for brickVeneerSillsLm: every
// aggregate below is summed straight from these same rows rather than recomputed a second way,
// so the schedule and the numbers it feeds can never quietly drift apart. Where a Job Setup field
// already carries the identical total (${prefix}ExternalOpeningAreaM2, brickVeneerSillsLm), that
// field's own computation in takeoffMaterialFields is called here rather than re-derived, so
// there remains exactly one implementation of each rule.
//
// Exported so a saved takeoff job (placedOpenings + completedWallRuns + sheetLevels) can be
// rebuilt into this schedule directly, the same way Client Selections already rebuilds
// createWindowAndDoorSchedules from placedOpenings alone.
export function createJobSetupWindowSchedule({ completedWallRuns = [], placedOpenings = [], pixelsPerMm, sheetLevels = {}, jobSetupRows = {} } = {}) {
  const records = createMeasurementRecords({
    completedWallRuns, placedOpenings, pixelsPerMm,
    completedFloorplans: [], completedAreas: [], completedEaves: [], completedMeasurements: [],
  });
  // An opening's own recorded page can disagree with its host wall's page (the wall is the
  // structural fact of which sheet it was actually drawn on); linking it to its host wall's own
  // resolved level is a more authoritative source than re-deriving the opening's level from its
  // own page number, so only a wall-less opening falls back to that. Walls have no host to inherit
  // from, so their own explicit-or-sheet level stays their final answer.
  const measurements = associateTakeoffMeasurements(records.map((item) => ({
    ...item,
    level: item.kind === 'opening' ? explicitLevel(item) : resolveTakeoffLevel(item, sheetLevels),
  })), pixelsPerMm);
  // Never silently defaults to Ground Floor: a still-unlinked opening (no host wall to inherit
  // from) falls back to its own page/sheetLevels assignment here, exactly as it would have without
  // a host wall - it just never gets a chance to overrule a real host wall's level above.
  measurements.forEach((item) => {
    if (item.kind === 'opening' && item.level === 'Unassigned') item.level = resolveTakeoffLevel(item, sheetLevels);
  });

  // The exact predicate takeoffMaterialFields' ${prefix}ExternalOpeningAreaM2 uses: linked to an
  // exterior wall, and not an internal door (a cavity-slider or robe door reclassified as
  // "Internal Door" is never external, however it is linked).
  const externalOpenings = uniqueTakeoffItems(measurements).filter((item) => item.kind === 'opening'
    && item.quantity !== null && item.linkedWallId && item.wallCategory === 'exterior' && item.openingClass !== 'Internal Door');

  const rows = externalOpenings.map((item) => {
    const floor = floorForItem(item, sheetLevels);
    const rawSillLm = brickSillLength(item);
    const rawAreaM2 = item.openingAreaM2 ?? openingAreaM2(item);
    return {
      section: 'Window Schedule',
      itemId: item.id,
      level: floor.label,
      openingType: item.openingClass,
      windowCode: windowCodeForOpening(item),
      heightMm: item.heightMm ?? null,
      widthMm: item.widthMm ?? null,
      quantity: item.quantity,
      // Rounded for display. The unrounded values (rawAreaM2, rawSillLm) are what level totals
      // sum, so a level's total is never a few millimetres off from adding up its own displayed
      // rows, and never a different rounding to takeoffMaterialFields' own totals.
      openingAreaM2: round(rawAreaM2),
      rawAreaM2,
      wallId: item.linkedWallId,
      // exteriorClassification (Face Brick Veneer / Rendered Brick Veneer / ...) is more specific
      // than the canonical constructionSystem alone (which does not carry exterior finish), so it
      // stays the richer label for this display column. But a legacy 'Other' is not itself proof of
      // no classification: a wall classified only through the newer canonical system (core-filled
      // blockwork, double brick, custom) has no legacy alias at all and would otherwise misreport
      // as 'Other' here even though it has a real, reviewed construction (Phase 2B).
      wallSystem: (item.exteriorClassification && item.exteriorClassification !== 'Other')
        ? item.exteriorClassification
        : (CONSTRUCTION_SYSTEM_LABELS[item.hostConstructionSystem] || item.exteriorClassification || ''),
      // The complete wall-system reference behind the short wallSystem label above, carried straight
      // from the host wall (associateTakeoffMeasurements) rather than re-derived here - this table
      // only shows the short label, but the frame thickness and cladding/finish product stay
      // available for downstream estimating/product logic to read.
      wallSystemDetail: item.wallSystemLabel || '',
      wallFrameThicknessMm: item.wallFrameThicknessMm ?? null,
      wallExteriorFinish: item.wallExteriorFinish || '',
      elevation: item.elevation || '',
      brickSillApplies: rawSillLm > 0 ? 'Yes' : 'No',
      brickSillLm: round(rawSillLm),
      rawSillLm,
      // Room/Location and Glass Type are already captured on the raw opening by AI Plan Takeoff's
      // own editor (the "Location / room" text field and "Glass Type" select in
      // AIPlanTakeoffStandalone.jsx both write directly onto opening.location / opening.glassType,
      // which associateTakeoffMeasurements/createMeasurementRecords carry through unchanged onto
      // this measurement item) - only reading them through into this row was missing. '' means the
      // estimator has not filled that field in yet for this opening, never an invented value.
      location: item.location || item.room || '',
      roomKey: resolveOpeningRoom(item).roomKey,
      roomLabel: resolveOpeningRoom(item).roomLabel,
      glassType: item.glassType || '',
      // Whether THIS specific opening needs a flyscreen/security screen - read straight from the
      // opening's own flag (undefined/false unless the estimator has actually set it), never
      // assumed true for every window. No such field existed on a takeoff opening before; this is
      // the minimum passthrough needed so the quotation can show flyscreens/security screens only
      // where the job actually calls for them, never a blanket allowance guess.
      flyscreenRequired: Boolean(item.flyscreenRequired),
      securityScreenRequired: Boolean(item.securityScreenRequired),
      // opening.subType is the same live "Window Type" dropdown value (FG/AW/DH/LVR/CA/BI/...) -
      // windowStyleLabel/isFixedWindowOpening read it, they never classify from array position or
      // guess a style Client Selections invented on its own.
      openingStyle: item.openingClass === 'Window' ? windowStyleLabel(item.subType) : '',
      // The equivalent of openingStyle above, for a door row instead of a window row (e.g. "Glass
      // Sliding Door", "Stacker Door") - read from the exact same live subType dropdown via
      // doorStyleLabel, never guessed. '' for a window row, exactly as openingStyle is '' for a door row.
      doorStyle: item.openingClass !== 'Window' ? doorStyleLabel(item.subType) : '',
      isFixed: item.openingClass === 'Window' && isFixedWindowOpening(item),
    };
  });

  const wallsByLevel = uniqueTakeoffItems(measurements).filter((item) => item.kind === 'wall' && item.quantity !== null);
  const fieldsByLevel = takeoffMaterialFields(measurements, jobSetupRows);
  const levelTotals = Object.entries(IMPORT_LEVELS).map(([level, prefix]) => {
    const levelRows = rows.filter((row) => row.level === level);
    return {
      level,
      // materialRound (4dp), matching takeoffMaterialFields' own precision, so this window/door
      // split always adds back up to externalOpeningAreaM2 exactly.
      windowOpeningAreaM2: materialRound(levelRows.filter((row) => row.openingType === 'Window').reduce((sum, row) => sum + row.rawAreaM2, 0)),
      externalDoorOpeningAreaM2: materialRound(levelRows.filter((row) => row.openingType !== 'Window').reduce((sum, row) => sum + row.rawAreaM2, 0)),
      // Sourced from takeoffMaterialFields directly (the same field Sections 83/84 read) rather
      // than summed again here, so this total and Sections 83/84 can never disagree. Already
      // rounded once inside takeoffMaterialFields (to 4dp) - rounding it again here (to this
      // function's own 2dp default) is exactly the kind of second, slightly different rounding
      // that let this total quietly drift from the two rows it is made of.
      externalOpeningAreaM2: Number(fieldsByLevel[`${prefix}ExternalOpeningAreaM2`]) || 0,
      brickSillLm: materialRound(levelRows.reduce((sum, row) => sum + row.rawSillLm, 0)),
      rowCount: levelRows.length,
    };
  }).filter((total) => total.rowCount > 0 || wallsByLevel.some((wall) => wall.level === total.level));

  return {
    rows: rows.map(({ rawAreaM2, rawSillLm, ...row }) => row),
    levelTotals,
    totalExternalOpeningAreaM2: materialRound(levelTotals.reduce((sum, total) => sum + total.externalOpeningAreaM2, 0)),
    // Already rounded once inside takeoffMaterialFields, for the same reason as above.
    totalBrickSillLm: Number(fieldsByLevel.brickVeneerSillsLm) || 0,
  };
}

// Groups a set of openings into one row per (level, width, height, host frame thickness) - the
// exact physical specification a purchase order for that opening's hardware is written against,
// so grouping on anything coarser would misrepresent what needs to be ordered. Shared by both
// cavity slider cages (createJobSetupPayload/createCavitySliderCageSchedule) and, below, ordinary
// internal doors (createInternalDoorSizeSchedule) - it is the one grouping rule for "how many of
// this exact size", not a separately-maintained copy per opening type.
// includeFrameThickness distinguishes two genuinely different procurement questions. A cavity
// slider order is for a complete cage that must physically fit the wall it sits in, so two
// otherwise-identical-size sliders in a 70mm and a 90mm wall are different cage products and must
// stay on separate lines (includeFrameThickness: true, the default, preserves this for
// buildCavitySliderSchedule below). An ordinary door leaf (hinged or robe/sliding) is the same
// physical product regardless of which wall it happens to be hung in - only its width and height
// identify it - so folding the host wall's frame thickness into that grouping key manufactures a
// false distinction: the same 720x2040 door ordered for a 70mm wall and a 90mm wall is one product,
// not two, and splitting it produces exactly the confusing near-duplicate size rows (same label,
// different quantities) this was written to fix. Frame thickness still drives the jamb quantity
// separately (takeoffMaterialFields/internalDoorJambTrace), which is unaffected by this grouping.
function groupOpeningsBySize(openings, section, itemPrefix, { includeFrameThickness = true } = {}) {
  const groups = new Map();
  openings.forEach((item) => {
    const { widthMm, heightMm } = openingDimensions(item);
    const hostFrameThicknessMm = includeFrameThickness ? (item.wallThicknessMm ?? null) : null;
    const key = [item.level, widthMm, heightMm, hostFrameThicknessMm].join('|');
    const existing = groups.get(key) || { level: item.level, widthMm, heightMm, hostFrameThicknessMm, quantity: 0, openings: [] };
    existing.quantity += openingQuantity(item);
    existing.openings.push({ id: String(item.id), page: Number(item.page || 1) });
    groups.set(key, existing);
  });
  return Array.from(groups.values()).map((row, index) => ({
    section,
    itemId: `${itemPrefix}_${index + 1}`,
    level: row.level,
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    hostFrameThicknessMm: row.hostFrameThicknessMm,
    sizeLabel: row.widthMm && row.heightMm ? `${row.widthMm} x ${row.heightMm}${row.hostFrameThicknessMm ? ` / ${row.hostFrameThicknessMm}mm host frame` : ''}` : '',
    quantity: row.quantity,
    openings: row.openings,
  }));
}
function buildCavitySliderSchedule(cavitySliderOpenings) {
  return groupOpeningsBySize(cavitySliderOpenings, 'Cavity Slider Frames / Cages', 'cavity_slider_cage');
}

// Standalone equivalent of createJobSetupWindowSchedule for cavity slider doors, so Job Setup's
// EstimateBuilderWorkbook can show the frame/cage order list the same way it shows the Window
// Schedule - straight from placedOpenings + completedWallRuns, without going through the full
// createJobSetupPayload pipeline (which needs project options this display does not).
export function createCavitySliderCageSchedule({ completedWallRuns = [], placedOpenings = [], pixelsPerMm, sheetLevels = {} } = {}) {
  const records = createMeasurementRecords({
    completedWallRuns, placedOpenings, pixelsPerMm,
    completedFloorplans: [], completedAreas: [], completedEaves: [], completedMeasurements: [],
  });
  // See createJobSetupWindowSchedule above: an opening's own page can disagree with its host
  // wall's page, so a linked opening inherits its host wall's resolved level rather than
  // re-deriving its own from a possibly-mismatched page number; only a wall-less opening falls
  // back to its own page/sheetLevels assignment.
  const measurements = associateTakeoffMeasurements(records.map((item) => ({
    ...item,
    level: item.kind === 'opening' ? explicitLevel(item) : resolveTakeoffLevel(item, sheetLevels),
  })), pixelsPerMm);
  measurements.forEach((item) => {
    if (item.kind === 'opening' && item.level === 'Unassigned') item.level = resolveTakeoffLevel(item, sheetLevels);
  });
  const cavitySliderOpenings = uniqueTakeoffItems(measurements).filter((item) => item.kind === 'opening'
    && item.quantity !== null && isCavitySlider(item));
  return { rows: buildCavitySliderSchedule(cavitySliderOpenings) };
}

// Exterior walls with their cladding product (the wall's own exteriorFinish, e.g.
// 'James Hardie Linea Weatherboard - 180mm'; pass exteriorFinish to keep one product only), each
// with its level, unrounded run length and only
// the openings linked to that wall - the same linkedWallId relationship and Internal Door exclusion
// takeoffMaterialFields applies to linkedOpeningAreaM2. Read-only: builds nothing new into the
// Takeoff itself.
export function createCladdingProductWallSchedule({ completedWallRuns = [], placedOpenings = [], pixelsPerMm, sheetLevels = {}, exteriorFinish = '' } = {}) {
  const records = createMeasurementRecords({
    completedWallRuns, placedOpenings, pixelsPerMm,
    completedFloorplans: [], completedAreas: [], completedEaves: [], completedMeasurements: [],
  });
  // Same level resolution as createJobSetupWindowSchedule above.
  const measurements = associateTakeoffMeasurements(records.map((item) => ({
    ...item,
    level: item.kind === 'opening' ? explicitLevel(item) : resolveTakeoffLevel(item, sheetLevels),
  })), pixelsPerMm);
  const items = uniqueTakeoffItems(measurements);
  const walls = items.filter((item) => item.kind === 'wall' && item.quantity !== null
    && item.category === 'exterior' && item.exteriorFinish && (!exteriorFinish || item.exteriorFinish === exteriorFinish));
  const rows = walls.map((wall) => {
    const openings = items.filter((item) => item.kind === 'opening' && item.quantity !== null
      && item.linkedWallId === wall.id && item.openingClass !== 'Internal Door');
    return {
      wallId: wall.id,
      level: wall.level,
      levelPrefix: TAKEOFF_LEVELS[wall.level] || '',
      exteriorFinish: wall.exteriorFinish,
      lengthM: Number(wall.quantity) || 0,
      openingIds: openings.map((item) => item.id),
      openingAreaM2: openings.reduce((sum, item) => sum + (Number(item.openingAreaM2) || 0), 0),
    };
  });
  return { rows };
}

// Standalone size breakdown of ordinary STANDARD (hinged/passage) internal doors - a distinct
// procurement product from both cavity sliders (own cage kit, createCavitySliderCageSchedule) and
// robe/sliding doors (own supplier stream, createRobeSlidingDoorSchedule below): a robe/sliding
// door is not "an internal door that happens to be wide", it is ordered from a different product
// line entirely, so it must never appear in this schedule or its total.
//
// Grouped by width x height only (includeFrameThickness: false) - a 720x2040 hinged door is the
// same physical product whether it is hung in a 70mm or a 90mm wall, so folding the host wall's
// frame thickness into the grouping key would split one real product into two rows with the same
// on-screen label and different quantities (the exact "820mm Internal Door - 1" / "820mm Internal
// Door - 4"-style duplication this was written to fix). Frame thickness still correctly drives a
// separate, unaffected calculation: the jamb stock quantity (takeoffMaterialFields /
// internalDoorJambTrace), which reads wallThicknessMm off the same openings directly.
export function createInternalDoorSizeSchedule({ completedWallRuns = [], placedOpenings = [], pixelsPerMm, sheetLevels = {} } = {}) {
  const records = createMeasurementRecords({
    completedWallRuns, placedOpenings, pixelsPerMm,
    completedFloorplans: [], completedAreas: [], completedEaves: [], completedMeasurements: [],
  });
  const measurements = associateTakeoffMeasurements(records.map((item) => ({
    ...item,
    level: item.kind === 'opening' ? explicitLevel(item) : resolveTakeoffLevel(item, sheetLevels),
  })), pixelsPerMm);
  measurements.forEach((item) => {
    if (item.kind === 'opening' && item.level === 'Unassigned') item.level = resolveTakeoffLevel(item, sheetLevels);
  });
  const internalDoorOpenings = uniqueTakeoffItems(measurements).filter((item) => item.kind === 'opening'
    && item.quantity !== null && item.openingClass === 'Internal Door' && !isCavitySlider(item) && !isRobeSlider(item));
  return { rows: groupOpeningsBySize(internalDoorOpenings, 'Internal Doors', 'internal_door', { includeFrameThickness: false }) };
}

// One pass of the same measurement pipeline every schedule above uses, returning what purchasing
// and labour need: each internal-door opening classified (internalDoorPurchaseType), the existing
// jamb trace (internalDoorJambTrace - the one jamb rule) and the existing cavity-cage grouping
// (buildCavitySliderSchedule - size + host frame thickness). Read-only.
export function createInternalDoorPurchaseSchedule({ completedWallRuns = [], placedOpenings = [], pixelsPerMm, sheetLevels = {} } = {}) {
  const records = createMeasurementRecords({
    completedWallRuns, placedOpenings, pixelsPerMm,
    completedFloorplans: [], completedAreas: [], completedEaves: [], completedMeasurements: [],
  });
  const measurements = associateTakeoffMeasurements(records.map((item) => ({
    ...item,
    level: item.kind === 'opening' ? explicitLevel(item) : resolveTakeoffLevel(item, sheetLevels),
  })), pixelsPerMm);
  measurements.forEach((item) => {
    if (item.kind === 'opening' && item.level === 'Unassigned') item.level = resolveTakeoffLevel(item, sheetLevels);
  });
  const unique = uniqueTakeoffItems(measurements);
  const internalDoors = unique.filter((item) => item.kind === 'opening' && item.quantity !== null && item.openingClass === 'Internal Door');
  return {
    openings: internalDoors.map((item) => {
      const { widthMm, heightMm } = openingDimensions(item);
      return {
        id: String(item.id),
        page: Number(item.page || 1),
        level: item.level,
        widthMm,
        heightMm,
        quantity: openingQuantity(item),
        doorType: item.subType || '',
        purchaseType: internalDoorPurchaseType(item),
        wallThicknessMm: item.wallThicknessMm || takeoffThickness(item.thicknessMm) || null,
        hostWallId: item.linkedWallId || item.hostWallId || null,
      };
    }),
    jambTrace: internalDoorJambTrace(unique),
    cavityCages: buildCavitySliderSchedule(internalDoors.filter((item) => isCavitySlider(item))),
  };
}

// Standalone size breakdown of robe/sliding doors: a separate procurement product/supplier stream
// from both standard hinged internal doors (above) and cavity sliders (own cage kit) - see the rule
// this schedule exists to enforce: STANDARD INTERNAL DOORS != LARGE ROBE/SLIDING DOORS, never
// combined into one quantity, one product reference, or one calculation. isCavitySlider is still
// excluded defensively even though isRobeSlider/isCavitySlider match mutually exclusive subType
// values in practice (Robe vs Cavity) - so a door tagged as both by a future data entry never
// double-counts into this schedule and the cavity-slider-cage schedule at once. Grouped by width x
// height only, for the same reason createInternalDoorSizeSchedule is: the door leaf product does
// not change with the host wall's frame thickness.
export function createRobeSlidingDoorSchedule({ completedWallRuns = [], placedOpenings = [], pixelsPerMm, sheetLevels = {} } = {}) {
  const records = createMeasurementRecords({
    completedWallRuns, placedOpenings, pixelsPerMm,
    completedFloorplans: [], completedAreas: [], completedEaves: [], completedMeasurements: [],
  });
  const measurements = associateTakeoffMeasurements(records.map((item) => ({
    ...item,
    level: item.kind === 'opening' ? explicitLevel(item) : resolveTakeoffLevel(item, sheetLevels),
  })), pixelsPerMm);
  measurements.forEach((item) => {
    if (item.kind === 'opening' && item.level === 'Unassigned') item.level = resolveTakeoffLevel(item, sheetLevels);
  });
  const robeSlidingDoorOpenings = uniqueTakeoffItems(measurements).filter((item) => item.kind === 'opening'
    && item.quantity !== null && item.openingClass === 'Internal Door' && isRobeSlider(item) && !isCavitySlider(item));
  return { rows: groupOpeningsBySize(robeSlidingDoorOpenings, 'Robe / Sliding Doors', 'robe_sliding_door', { includeFrameThickness: false }) };
}

// Diagnostic-only companion to the jamb90x19StockLengthsEach/jamb110x19StockLengthsEach totals
// takeoffMaterialFields computes: those are aggregate counts, which cannot answer "which actual
// doors produced this number, and why". Runs the identical measurement pipeline every schedule
// above uses (createMeasurementRecords -> associateTakeoffMeasurements) and hands every internal-door
// opening (host wall now linked, so wallThicknessMm is populated exactly as takeoffMaterialFields
// sees it) to internalDoorJambTrace, which applies the exact same rule that function uses. Not
// wired into any UI - used by the jamb regression test and by ad-hoc diagnostics.
export function createInternalDoorJambTrace({ completedWallRuns = [], placedOpenings = [], pixelsPerMm, sheetLevels = {} } = {}) {
  const records = createMeasurementRecords({
    completedWallRuns, placedOpenings, pixelsPerMm,
    completedFloorplans: [], completedAreas: [], completedEaves: [], completedMeasurements: [],
  });
  const measurements = associateTakeoffMeasurements(records.map((item) => ({
    ...item,
    level: item.kind === 'opening' ? explicitLevel(item) : resolveTakeoffLevel(item, sheetLevels),
  })), pixelsPerMm);
  measurements.forEach((item) => {
    if (item.kind === 'opening' && item.level === 'Unassigned') item.level = resolveTakeoffLevel(item, sheetLevels);
  });
  return internalDoorJambTrace(uniqueTakeoffItems(measurements));
}

// Full per-opening reconciliation for every internal-door-class opening in the Takeoff: which
// product category each one lands in (standard hinged door / robe-sliding door / cavity-slider
// cage) and why. Same pipeline as every schedule above; hands the associated measurements to
// internalDoorReconciliationTrace, which applies the identical isCavitySlider/isRobeSlider rule the
// standard-door and robe-door schedules use - so this trace and those schedules can never disagree
// about which opening belongs where. Not wired into any UI - used for diagnostics and regression
// tests that need to prove why a specific opening was or was not included in a given schedule.
export function createInternalDoorReconciliationTrace({ completedWallRuns = [], placedOpenings = [], pixelsPerMm, sheetLevels = {} } = {}) {
  const records = createMeasurementRecords({
    completedWallRuns, placedOpenings, pixelsPerMm,
    completedFloorplans: [], completedAreas: [], completedEaves: [], completedMeasurements: [],
  });
  const measurements = associateTakeoffMeasurements(records.map((item) => ({
    ...item,
    level: item.kind === 'opening' ? explicitLevel(item) : resolveTakeoffLevel(item, sheetLevels),
  })), pixelsPerMm);
  measurements.forEach((item) => {
    if (item.kind === 'opening' && item.level === 'Unassigned') item.level = resolveTakeoffLevel(item, sheetLevels);
  });
  return internalDoorReconciliationTrace(uniqueTakeoffItems(measurements));
}

// Canonical row order for the redesigned wall-system schedule sections, matching the fixed nominal
// thickness/frame combinations Job Setup and the manual editing UI both use. Unclassified is always
// appended last and separately, never guessed into one of these rows.
const EXTERNAL_WALL_SYSTEM_ROWS = [
  { system: 'brick_veneer', frame: 70, label: '230mm Brick Veneer', frameLabel: '70mm' },
  { system: 'brick_veneer', frame: 90, label: '250mm Brick Veneer', frameLabel: '90mm' },
  { system: 'core_filled_blockwork', frame: null, label: '200mm Core-filled Blockwork', frameLabel: 'N/A' },
  { system: 'double_brick', frame: null, label: '230mm Double Brick', frameLabel: 'N/A' },
  { system: 'lightweight_cladding', frame: 70, label: 'Lightweight Cladding', frameLabel: '70mm' },
  { system: 'lightweight_cladding', frame: 90, label: 'Lightweight Cladding', frameLabel: '90mm' },
  { system: 'custom', frame: null, label: 'Custom', frameLabel: '—' },
];
const INTERNAL_WALL_SYSTEM_ROWS = [
  { system: 'internal_timber_frame', frame: 70, label: 'Internal Timber Frame', frameLabel: '70mm' },
  { system: 'internal_timber_frame', frame: 90, label: 'Internal Timber Frame', frameLabel: '90mm' },
  { system: 'custom', frame: null, label: 'Custom Internal Wall', frameLabel: '—' },
];
const wallSystemRowKey = (system, frame) => (system === 'custom' ? 'custom' : `${system}:${frame ?? 'none'}`);

/**
 * The Takeoff Schedule's wall sections, grouped by level then by canonical construction system and
 * frame - the view the builder actually needs (what is it, what frame, how long), replacing the
 * legacy per-class-only rows for display. Every group carries the exact wall ids and pages behind
 * it, unclassified or not, so a review action can navigate straight to them; nothing here recomputes
 * length or level differently to the rest of the schedule; it is a regrouping of the same walls.
 */
function createWallSystemSchedule(walls = [], pixelsPerMm, sheetLevels = {}) {
  const byLevel = new Map();
  walls.forEach((wall) => {
    const isExterior = importWallCategory(wall) === 'exterior';
    const level = floorForItem(wall, sheetLevels).label;
    const lengthM = runLengthM(wall, pixelsPerMm);
    const wallSystem = resolveConstructionSystem(wall);
    if (!byLevel.has(level)) byLevel.set(level, { external: new Map(), internal: new Map() });
    const bucket = byLevel.get(level)[isExterior ? 'external' : 'internal'];
    const key = wallSystem.classificationStatus === 'unclassified' ? 'unclassified' : wallSystemRowKey(wallSystem.system, wallSystem.frameThicknessMm);
    if (!bucket.has(key)) bucket.set(key, { lengthM: 0, walls: [], products: new Map() });
    const entry = bucket.get(key);
    entry.lengthM += lengthM;
    entry.walls.push({ id: String(wall.id), page: Number(wall.page || 1) });
    // Cladding product is DETAIL under its Lightweight Cladding/frame row, never a second wall total:
    // the row above already carries the full bucket length regardless of product.
    if (wallSystem.system === 'lightweight_cladding' && wallSystem.exteriorFinishLabel) {
      const products = entry.products;
      products.set(wallSystem.exteriorFinishLabel, (products.get(wallSystem.exteriorFinishLabel) || 0) + lengthM);
    }
  });

  const buildRows = (bucket, templates) => {
    const rows = templates.map((def) => {
      const entry = bucket.get(wallSystemRowKey(def.system, def.frame));
      const products = entry?.products?.size
        ? Array.from(entry.products.entries()).map(([label, productLengthM]) => ({ label, lengthM: round(productLengthM) })).sort((a, b) => b.lengthM - a.lengthM)
        : [];
      return {
        itemId: `wallsystem_${wallSystemRowKey(def.system, def.frame)}`, system: def.system, frameThicknessMm: def.frame,
        label: def.label, frameLabel: def.frameLabel, lengthM: round(entry?.lengthM || 0), walls: entry?.walls || [], products,
      };
    });
    const unclassified = bucket.get('unclassified');
    rows.push({
      itemId: 'wallsystem_unclassified', system: 'unclassified', frameThicknessMm: null,
      label: 'Unclassified', frameLabel: '—', lengthM: round(unclassified?.lengthM || 0), walls: unclassified?.walls || [], products: [],
    });
    return rows;
  };

  const levels = Array.from(byLevel.entries()).map(([level, { external, internal }]) => {
    const externalRows = buildRows(external, EXTERNAL_WALL_SYSTEM_ROWS);
    const internalRows = buildRows(internal, INTERNAL_WALL_SYSTEM_ROWS);
    return {
      level,
      external: { rows: externalRows, totalLengthM: round(externalRows.reduce((sum, row) => sum + row.lengthM, 0)) },
      internal: { rows: internalRows, totalLengthM: round(internalRows.reduce((sum, row) => sum + row.lengthM, 0)) },
    };
  });
  return { levels };
}

function createWallSchedules(walls = [], openings = [], pixelsPerMm, jobSetupRows = {}, sheetLevels = {}) {
  const heights = wallHeightByFloor(jobSetupRows);
  const openingsByWallId = openings.reduce((acc, opening) => {
    const host = openingHostId(opening);
    if (!host) return acc;
    if (!acc[host]) acc[host] = [];
    acc[host].push(opening);
    return acc;
  }, {});

  const exteriorRows = [];
  const interiorRows = [];
  const wallRows = [];
  const wallRecords = [];

  walls.forEach((wall, index) => {
    const floor = floorForItem(wall, sheetLevels);
    const lengthM = runLengthM(wall, pixelsPerMm);
    const isExterior = importWallCategory(wall) === 'exterior';
    const className = isExterior ? resolveExteriorClass(wall) : 'Internal';
    const wallHeightM = parseHeightM(wall.wallHeightM || wall.heightM, heights[floor.key] || DEFAULT_WALL_HEIGHT_M);
    const linedFaces = Number(wall.linedFaces || 2) === 1 ? 1 : 2;
    // A hosted opening on the same page belongs to this wall regardless of how each item's own
    // level independently resolved - the same authority associateTakeoffMeasurements gives
    // hostWallId for the Job Setup import, so this displayed schedule agrees with what gets
    // imported instead of running its own, looser same-level-or-unassigned rule.
    const linkedOpenings = uniqueTakeoffItems(openingsByWallId[String(wall.id)] || []).filter((opening) => Number(opening.page || 1) === Number(wall.page || 1) && (!isExterior || classifyOpening(opening) !== 'Internal Door'));
    const linkedOpeningArea = linkedOpenings.reduce((sum, opening) => sum + openingAreaM2(opening), 0);
    // Snap to a standard thickness and, on an interior wall, apply the same cavity-pocket rule
    // takeoffMaterialFields uses: a linked cavity-slider door always needs a 90mm frame, even on a
    // run saved without that thickness explicitly set. Without this the wall shown here can read
    // 70mm while the quantity actually imported into Job Setup is 90mm.
    const normalisedThicknessMm = takeoffThickness(wall.thicknessMm);
    const hasCavitySlider = !isExterior && linkedOpenings.some(isCavitySlider);
    const thicknessMm = hasCavitySlider && (!normalisedThicknessMm || normalisedThicknessMm === 70) ? 90 : normalisedThicknessMm;
    const wallSystem = resolveConstructionSystem(wall);

    wallRecords.push({
      section: 'Wall Records',
      itemId: String(wall.id || `wall_${index + 1}`),
      wallType: isExterior ? 'External walls' : 'Internal walls',
      planSheet: wall.page,
      level: floor.label,
      lengthM: round(lengthM),
      wallHeightM: round(wallHeightM, 3),
      thicknessMm: thicknessMm || 0,
      cavitySlider: hasCavitySlider,
      exteriorClassification: isExterior ? className : '',
      constructionSystem: wallSystem.system,
      frameThicknessMm: hasCavitySlider ? 90 : wallSystem.frameThicknessMm,
      exteriorFinish: wallSystem.exteriorFinish,
      classificationStatus: wallSystem.classificationStatus,
      wallSystemLabel: wallSystem.displayLabel,
      grossAreaM2: round(lengthM * wallHeightM),
      linkedOpenings: linkedOpenings.map((opening) => opening.id),
      openingAreaM2: round(linkedOpeningArea),
      netAreaM2: round(Math.max(0, (lengthM * wallHeightM) - linkedOpeningArea))
    });

    if (isExterior) {
      exteriorRows.push({
        section: 'Exterior Walls',
        itemId: `ext_${floor.key}_${className}_${index + 1}`,
        category: className,
        quantity: round(lengthM),
        unit: 'lm',
        floor: floor.label,
        wallHeightM: round(wallHeightM, 3)
      });
      return;
    }

    const openingDeductionsEnabled = wall.openingDeductionsEnabled !== false;
    const openingDeductionM2 = openingDeductionsEnabled ? linkedOpeningArea : 0;
    const oneFaceAreaM2 = lengthM * wallHeightM;
    const grossAreaM2 = oneFaceAreaM2 * linedFaces;
    interiorRows.push({
      section: 'Interior Walls and Plasterboard',
      itemId: `int_${floor.key}_${index + 1}`,
      category: 'Internal wall',
      floor: floor.label,
      quantity: round(lengthM),
      unit: 'lm',
      wallHeightM: round(wallHeightM, 3),
      oneFaceAreaM2: round(oneFaceAreaM2),
      linedFaces,
      grossPlasterboardAreaM2: round(grossAreaM2),
      openingDeductionsEnabled: openingDeductionsEnabled ? 'Yes' : 'No',
      openingDeductionAreaM2: round(openingDeductionM2),
      netPlasterboardAreaM2: round(Math.max(0, grossAreaM2 - openingDeductionM2 * linedFaces))
    });
  });

  const groupBy = (rows, keyFn) => rows.reduce((acc, row) => {
    const key = keyFn(row);
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const exteriorGrouped = groupBy(exteriorRows, (row) => `${row.floor}|${row.category}`);
  const exteriorTotals = Object.values(exteriorGrouped).map((rows) => {
    const sample = rows[0];
    return makeRow('Exterior Walls', `ext_total_${sample.floor}_${sample.category}`.replace(/\s+/g, '_'), sample.category, rows.reduce((sum, row) => sum + row.quantity, 0), 'lm', {
      floor: sample.floor
    });
  });

  const interiorByFloor = groupBy(interiorRows, (row) => row.floor);
  const interiorTotals = Object.values(interiorByFloor).map((rows) => {
    const sample = rows[0];
    return {
      section: 'Interior Walls and Plasterboard',
      itemId: `int_total_${sample.floor}`.replace(/\s+/g, '_'),
      category: 'Internal wall totals',
      floor: sample.floor,
      quantity: round(rows.reduce((sum, row) => sum + row.quantity, 0)),
      unit: 'lm',
      grossPlasterboardAreaM2: round(rows.reduce((sum, row) => sum + (Number(row.grossPlasterboardAreaM2) || 0), 0)),
      openingDeductionAreaM2: round(rows.reduce((sum, row) => sum + (Number(row.openingDeductionAreaM2) || 0), 0)),
      netPlasterboardAreaM2: round(rows.reduce((sum, row) => sum + (Number(row.netPlasterboardAreaM2) || 0), 0))
    };
  });

  const legacyWallRows = [
    makeRow('Walls', 'walls_external_total', 'External walls', exteriorTotals.reduce((sum, row) => sum + row.quantity, 0), 'lm'),
    makeRow('Walls', 'walls_internal_total', 'Internal walls', interiorRows.reduce((sum, row) => sum + row.quantity, 0), 'lm')
  ];

  return {
    legacyWallRows,
    wallRecords,
    exteriorRows,
    exteriorTotals,
    interiorRows,
    interiorTotals,
    wallSystemSchedule: createWallSystemSchedule(walls, pixelsPerMm, sheetLevels)
  };
}

function buildForPages({ pages, completedFloorplans, completedWallRuns, placedOpenings, completedAreas, completedMeasurements, completedEaves, completedPillars = [], pixelsPerMm, jobSetupRows, sheetLevels = {}, aiAnalysis }) {
  const include = (item) => pages.includes(item.page);
  const floorplans = completedFloorplans.filter(include);
  const walls = completedWallRuns.filter(include);
  const openings = placedOpenings.filter(include);
  const pillars = completedPillars.filter(include);
  const finishes = completedAreas.filter((area) => include(area) && area.category !== 'Roof Area');
  const roofAreas = completedAreas.filter((area) => include(area) && area.category === 'Roof Area');
  const eaves = completedEaves.filter(include);
  // Temporary audit: capture the actual eave inputs before changing schedule calculations.
  if (typeof window !== 'undefined' && completedEaves.length) {
    const runs = completedEaves.map((eave, index) => {
      const widthLabel = eave.widthOption === 'Special' ? `${eave.widthMm}mm Special` : `${eave.widthMm || eave.widthOption}mm`;
      return {
        index, id: eave.id, page: eave.page, included: include(eave),
        nodeCount: eave.nodes?.length || 0, lengthMm: eave.lengthMm ?? null,
        storedLengthM: (eave.lengthMm || 0) / 1000,
        runLengthM: runLengthM(eave, pixelsPerMm),
        nodeLengthM: runLengthM({ ...eave, lengthMm: 0 }, pixelsPerMm),
        storedLevel: eave.level ?? null, sheetLevel: sheetLevels[eave.page] ?? null,
        resolvedLevel: resolveTakeoffLevel(eave, sheetLevels),
        resolvedSheetLevel: floorFromPage(eave.page, sheetLevels).label,
        widthOption: eave.widthOption ?? null, widthMm: eave.widthMm ?? null,
        widthLabel, groupingKey: `${resolveTakeoffLevel(eave, sheetLevels)}|${widthLabel}`,
      };
    });
    const totals = (items) => ({
      count: items.length,
      storedLengthM: items.reduce((sum, item) => sum + item.storedLengthM, 0),
      runLengthM: items.reduce((sum, item) => sum + item.runLengthM, 0),
      nodeLengthM: items.reduce((sum, item) => sum + item.nodeLengthM, 0),
    });
    const filtered = runs.filter((run) => run.included);
    const summary = (items) => ({
      all: totals(items),
      secondLevel: totals(items.filter((run) => run.resolvedLevel === 'Second Level')),
      otherOrUnassignedLevels: totals(items.filter((run) => run.resolvedLevel !== 'Second Level')),
      width600mm: totals(items.filter((run) => ['600mm', '600mm Special'].includes(run.widthLabel))),
      otherWidths: totals(items.filter((run) => !['600mm', '600mm Special'].includes(run.widthLabel))),
    });
    console.log('[AI Plan Takeoff eave audit]', JSON.stringify({
      pages, pixelsPerMm, sheetLevels, completedEaves, eaves, runs,
      exteriorWalls: walls.filter((wall) => importWallCategory(wall) === 'exterior'),
      exteriorClassificationTotals: createExteriorClassificationTotals(walls, pixelsPerMm, sheetLevels),
      totals: { stored: summary(runs), filtered: summary(filtered) },
      // Include the real rounded rows as well as unrounded input totals.
      groupedRows: createEaveRows(eaves, pixelsPerMm, sheetLevels),
    }, null, 2));
  }
  const measurements = completedMeasurements.filter(include);

  const floorAreas = createFloorAreaRows(floorplans, pixelsPerMm);
  const wallSchedules = createWallSchedules(walls, openings, pixelsPerMm, jobSetupRows, sheetLevels);
  const linkedMeasurements = associateTakeoffMeasurements(createMeasurementRecords({
    completedWallRuns: walls, placedOpenings: openings, pixelsPerMm,
    completedFloorplans: [], completedAreas: [], completedEaves: [], completedMeasurements: [],
  }).map((item) => ({ ...item, level: item.level !== 'Unassigned' ? item.level : normaliseLevel(sheetLevels[item.page]) })), pixelsPerMm);
  const scheduledOpenings = linkedMeasurements.filter((item) => item.kind === 'opening').map((item) => ({
    ...item, brickSillLengthLm: brickSillLength(item), brickSillRequired: brickSillLength(item) > 0,
  }));
  const openingSchedules = createWindowAndDoorSchedules(scheduledOpenings, sheetLevels);
  const floorFinishes = createFloorFinishRows(finishes, pixelsPerMm);
  const roofAndEaves = createEaveRows(eaves, pixelsPerMm, sheetLevels);
  const roofAreaRows = createRoofAreaRows(roofAreas, pixelsPerMm);
  const evidenceRows = createAiScheduleRows(aiAnalysis, pages);
  const rooms = [...createRoomRows(measurements), ...evidenceRows.rooms];
  const pillarRows = createPillarSchedule(pillars, pixelsPerMm, sheetLevels);

  const brickSillRows = Object.entries(openingSchedules.brickSillSubtotals).map(([floor, quantity]) => ({
    section: 'Windows',
    itemId: `brick_sill_${floor}`.replace(/\s+/g, '_').toLowerCase(),
    category: 'Brick sill subtotal',
    floor,
    quantity: round(quantity),
    unit: 'lm'
  }));

  return {
    floorAreas,
    walls: wallSchedules.legacyWallRows,
    wallRecords: wallSchedules.wallRecords,
    exteriorWalls: [...wallSchedules.exteriorRows, ...wallSchedules.exteriorTotals],
    interiorWallsAndPlasterboard: [...wallSchedules.interiorRows, ...wallSchedules.interiorTotals],
    wallSystems: wallSchedules.wallSystemSchedule,
    openings: [...openingSchedules.windows, ...openingSchedules.doors],
    windows: [...openingSchedules.windows, ...brickSillRows, {
      section: 'Windows',
      itemId: 'brick_sill_total',
      mark: '',
      category: 'Total brick-veneer sill length',
      floor: 'All Floors',
      quantity: openingSchedules.totalBrickSillLengthLm,
      unit: 'lm',
      brickSillRequired: 'Yes'
    }],
    doors: openingSchedules.doors,
    floorFinishes,
    roofAndEaves,
    roofAreas: roofAreaRows,
    rooms,
    pillars: pillarRows,
    customTakeoffs: evidenceRows.customTakeoffs
  };
}

// Keep source measurements alongside display summaries. Importing summaries alone
// loses the sheet/level distinction and counts their subtotal rows a second time.
export function createWallLiningMeasurements(job = {}) {
  const records = createMeasurementRecords({ completedFloorplans: [], completedWallRuns: job.completedWallRuns || [], placedOpenings: job.placedOpenings || [], completedAreas: [], completedEaves: [], completedMeasurements: [], pixelsPerMm: job.pixelsPerMm });
  return uniqueTakeoffItems(associateTakeoffMeasurements(records.map((item) => ({ ...item, level: resolveTakeoffLevel(item, job.sheetLevels || {}) })), job.pixelsPerMm));
}

export function createMeasurementRecords({ completedFloorplans, completedWallRuns, placedOpenings, completedAreas, completedEaves, completedMeasurements, completedPillars = [], pixelsPerMm }) {
  const calibrated = Number.isFinite(Number(pixelsPerMm)) && Number(pixelsPerMm) > 0;
  const area = (item) => calibrated && item.nodes?.length >= 3
    ? polygonAreaM2(item.nodes, Number(pixelsPerMm)) : null;
  const length = (item) => Number(item.lengthMm) > 0 || (calibrated && item.nodes?.length >= 2)
    ? runLengthM(item, Number(pixelsPerMm)) : null;
  const record = (item, kind, quantity, unit, extra = {}) => ({
    ...item, kind, id: String(item.id ?? ''), page: Number(item.page || item.pageId || item.sourcePage || 1),
    level: explicitLevel(item), category: item.type || item.category || '', quantity, unit, ...extra,
  });
  return [
    ...completedFloorplans.map((item) => record(item, 'floorArea', area(item), 'm2', { label: item.label || item.type || 'Area' })),
    ...completedWallRuns.map((item) => {
      const wallSystem = resolveConstructionSystem(item);
      const category = importWallCategory(item);
      return record(item, 'wall', length(item), 'lm', {
        category,
        // Job Setup's LM/M2 totals (takeoffMaterialFields) key off this legacy five-class string,
        // not the canonical system/exteriorFinish pair - a wall classified only through the newer
        // Phase 2A constructionSystem field (no legacy exteriorType ever set) would otherwise read
        // back as "Other" here and get silently miscounted as unclassified even though
        // resolveConstructionSystem, right above, already knows exactly what it is.
        exteriorClassification: category === 'exterior' ? legacyExteriorClassFromSystem(wallSystem) : resolveExteriorClass(item),
        constructionSystem: wallSystem.system,
        frameThicknessMm: wallSystem.frameThicknessMm,
        frameMaterial: wallSystem.frameMaterial,
        exteriorFinish: wallSystem.exteriorFinish,
        classificationStatus: wallSystem.classificationStatus,
        wallSystemLabel: wallSystem.displayLabel,
        wallHeightM: parseHeightM(item.wallHeightM || item.heightM, null),
        thicknessMm: takeoffThickness(item.thicknessMm),
        linedFaces: Number(item.linedFaces || 2) === 1 ? 1 : 2,
        openingDeductionsEnabled: item.openingDeductionsEnabled !== false,
        linkedOpeningAreaM2: placedOpenings.filter((opening) => opening.hostWallId && String(opening.hostWallId) === String(item.id)).reduce((sum, opening) => sum + openingAreaM2(opening), 0),
      });
    }),
    ...placedOpenings.map((item) => record(item, 'opening', openingQuantity(item), 'count', {
      openingClass: classifyOpening(item), ...openingDimensions(item),
      openingAreaM2: openingDimensions(item).widthMm > 0 && openingDimensions(item).heightMm > 0 ? openingAreaM2(item) : null,
      brickSillRequired: item.brickSillRequired === undefined ? undefined : item.brickSillRequired === true || item.brickSillRequired === 'Yes',
    })),
    ...completedAreas.map((item) => {
      const gross = area(item);
      const exclusions = (item.exclusions || []).map(area);
      const net = gross === null || exclusions.some((value) => value === null) ? null : Math.max(0, gross - exclusions.reduce((sum, value) => sum + value, 0));
      return record(item, item.category === 'Roof Area' ? 'roofArea' : 'floorFinish', net, 'm2', { category: item.category || '' });
    }),
    ...completedEaves.map((item) => record(item, 'eave', length(item), 'lm', { widthMm: Number(item.widthMm || (item.widthOption !== 'Special' ? item.widthOption : 0)) || null })),
    ...completedMeasurements.map((item) => record(item, 'measurement', length(item), 'lm', { label: item.label || 'Measurement' })),
    ...completedPillars.map((item) => {
      const core = resolvePostColumnCore(item);
      return record(item, 'pillar', Number(item.quantity) || 1, 'count', {
        coreType: core.coreType, classificationStatus: core.classificationStatus, displayLabel: core.displayLabel,
        coreWidthMm: item.coreWidthMm ?? null, coreDepthMm: item.coreDepthMm ?? null,
        steelSectionType: item.steelSectionType ?? null, steelSectionDesignation: item.steelSectionDesignation ?? null, timberSizeOption: item.timberSizeOption ?? null,
        brickFinish: item.brickFinish ?? null, coreCustomLabel: item.coreCustomLabel || '',
        surroundType: item.surroundType || 'none', surroundWidthMm: item.surroundWidthMm ?? null, surroundDepthMm: item.surroundDepthMm ?? null,
        surroundCustomLabel: item.surroundCustomLabel || '', heightMm: item.heightMm ?? null,
        location: item.location || '', roomKey: item.roomKey || '', roomLabel: item.roomLabel || '',
      });
    }),
  ];
}

export function createTakeoffSchedule({
  projectInfo = {},
  planFilename = '',
  totalPages = 1,
  currentPage = 1,
  pixelsPerMm,
  completedWallRuns = [],
  placedOpenings = [],
  completedAreas = [],
  completedFloorplans = [],
  completedMeasurements = [],
  completedEaves = [],
  completedPillars = [],
  jobSetupRows = {},
  sheetLevels = {},
  scheduleState = {},
  aiAnalysis = scheduleState.aiAnalysis || null
}) {
  const projectPages = Array.from({ length: totalPages || 1 }, (_, index) => index + 1);
  return {
    generatedAt: new Date().toISOString(),
    aiAnalysis,
    measurementRecords: createMeasurementRecords({ completedFloorplans, completedWallRuns, placedOpenings, completedAreas, completedEaves, completedMeasurements, completedPillars, pixelsPerMm }),
    jobSetupRows,
    sheetLevels: { ...sheetLevels },
    project: {
      projectName: projectInfo.projectName || '',
      clientName: projectInfo.clientName || '',
      siteAddress: projectInfo.siteAddress || '',
      planFilename,
      numberOfPlanSheets: totalPages || 1,
      storeyOrLevelName: projectInfo.storeyOrLevelName || `Sheet ${currentPage}`,
      calibratedScaleBySheet: projectPages.map((page) => ({ page, pixelsPerMm: pixelsPerMm || null }))
    },
    currentSheet: {
      page: currentPage,
      ...buildForPages({
        pages: [currentPage], aiAnalysis,
        completedFloorplans,
        completedWallRuns,
        placedOpenings,
        completedAreas,
        completedMeasurements,
        completedEaves,
        completedPillars,
        pixelsPerMm,
        jobSetupRows,
        sheetLevels
      })
    },
    projectTotals: buildForPages({
      pages: projectPages, aiAnalysis,
      completedFloorplans,
      completedWallRuns,
      placedOpenings,
      completedAreas,
      completedMeasurements,
      completedEaves,
      completedPillars,
      pixelsPerMm,
      jobSetupRows,
      sheetLevels
    })
  };
}

export function flattenScheduleRows(schedule, scope = 'projectTotals') {
  const sectionData = schedule[scope] || {};
  return [
    ...(sectionData.floorAreas || []),
    ...(sectionData.walls || []),
    ...(sectionData.exteriorWalls || []),
    ...(sectionData.interiorWallsAndPlasterboard || []),
    ...(sectionData.windows || []),
    ...(sectionData.doors || []),
    ...(sectionData.openings || []),
    ...(sectionData.roofAndEaves || []),
    ...(sectionData.roofAreas || []),
    ...(sectionData.floorFinishes || []),
    ...(sectionData.rooms || []),
    ...(sectionData.pillars || []),
    ...(sectionData.customTakeoffs || [])
  ];
}

export function exportRowsToCsv(rows) {
  const headers = [
    'section', 'itemId', 'mark', 'category', 'quantity', 'unit', 'floor', 'level', 'planSheet',
    'grossAreaM2', 'openingAreaM2', 'netAreaM2', 'totalOpeningAreaM2', 'widthMm', 'heightMm',
    'wallHeightM', 'oneFaceAreaM2', 'linedFaces', 'grossPlasterboardAreaM2', 'openingDeductionAreaM2',
    'netPlasterboardAreaM2', 'brickSillRequired', 'brickSillLengthLm'
  ];
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}

export function exportScheduleToExcelXml(schedule) {
  const sheets = {
    'Project Summary': [
      { field: 'Project name', value: schedule.project.projectName },
      { field: 'Client name', value: schedule.project.clientName },
      { field: 'Site address', value: schedule.project.siteAddress },
      { field: 'Plan filename', value: schedule.project.planFilename },
      { field: 'Number of plan sheets', value: schedule.project.numberOfPlanSheets }
    ],
    'Floor Areas': schedule.projectTotals.floorAreas,
    'Exterior Walls': schedule.projectTotals.exteriorWalls,
    'Interior Walls and Plasterboard': schedule.projectTotals.interiorWallsAndPlasterboard,
    'Windows': schedule.projectTotals.windows,
    'Doors': schedule.projectTotals.doors,
    'Rooms': schedule.projectTotals.rooms,
    'Pillars, Posts & Columns': schedule.projectTotals.pillars,
    'Roof and Eaves': schedule.projectTotals.roofAndEaves,
    'Roof Areas': schedule.projectTotals.roofAreas,
    'Floor Finishes': schedule.projectTotals.floorFinishes,
    'Custom Takeoffs': schedule.projectTotals.customTakeoffs
  };

  const xmlEscape = (value) => String(value ?? '').replace(/[<>&"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[char]));
  const objectToRows = (rows) => {
    const normalRows = rows.length ? rows : [{}];
    const headers = Array.from(new Set(normalRows.flatMap((row) => Object.keys(row))));
    return [
      `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`).join('')}</Row>`,
      ...normalRows.map((row) => `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(row[header])}</Data></Cell>`).join('')}</Row>`)
    ].join('');
  };

  return `<?xml version="1.0"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n${Object.entries(sheets).map(([name, rows]) => `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${objectToRows(rows || [])}</Table></Worksheet>`).join('\n')}\n</Workbook>`;
}

export function createQuotePreviewRows(schedule, quoteSheetRows = [], mappings = {}) {
  const rows = flattenScheduleRows(schedule, 'projectTotals')
    .filter((row) => row.section !== 'Windows' && row.section !== 'Doors')
    .filter((row) => Number(row.quantity) !== 0)
    .map((row) => {
      const mappedRowId = mappings[row.itemId];
      const mappedRow = quoteSheetRows.find((quoteRow) => quoteRow.id === mappedRowId)
        || quoteSheetRows.find((quoteRow) => (quoteRow.category || '').toLowerCase() === (row.category || '').toLowerCase());
      const existingQuantity = mappedRow?.quantity;
      const status = !mappedRow
        ? 'unmapped'
        : Number(existingQuantity) === Number(row.quantity)
          ? 'unchanged'
          : existingQuantity === undefined || existingQuantity === null
            ? 'new'
            : 'changed';
      return {
        takeoffCategory: row.category,
        itemId: row.itemId,
        measuredQuantity: row.quantity,
        unit: row.unit,
        destinationRowId: mappedRow?.id || '',
        destinationQuoteSheetRow: mappedRow?.description || '',
        existingQuantity,
        newQuantity: row.quantity,
        status
      };
    });

  return rows;
}

export function applyQuotePreviewRows(quoteSheetRows, previewRows) {
  return quoteSheetRows.map((quoteRow) => {
    const preview = previewRows.find((row) => row.destinationRowId === quoteRow.id && row.status !== 'unmapped');
    if (!preview) return quoteRow;
    return { ...quoteRow, quantity: preview.newQuantity };
  });
}

function sumRows(rows = [], predicate = () => true, valueField = 'quantity') {
  return round((rows || []).filter(predicate).reduce((sum, row) => sum + (Number(row[valueField]) || 0), 0));
}

export function createJobSetupPayload(schedule, options = {}) {
  if (!options.reviewOnly) assertTakeoffImportable(schedule.aiAnalysis, signatureFromSchedule(schedule));
  const sheetLevels = { ...(schedule.sheetLevels || {}), ...(options.sheetLevels || {}) };
  const fields = {};
  const mappingPreview = [];
  const unsupported = [];
  const warnings = [];
  const editableRows = new Map(INPUT_DATA_SHEET_TEMPLATE.rows.filter((row) => row.editable && !row.calculated && !row.heading).map((row) => [row.key, row]));
  // Same single calibration factor createMeasurementRecords used to build these records in the
  // first place (calibratedScaleBySheet holds that one pixelsPerMm value per page, never a
  // different one per sheet) - re-deriving it here keeps opening<->wall geometric linking working
  // the same way it did when the schedule was generated, instead of silently losing it on reimport.
  const pixelsPerMm = schedule.project?.calibratedScaleBySheet?.[0]?.pixelsPerMm || undefined;
  const measurements = associateTakeoffMeasurements((schedule.measurementRecords || []).map((item) => ({
    ...item,
    level: resolveTakeoffLevel(item, sheetLevels),
  })), pixelsPerMm);
  const add = (key, value, source, unit = '') => {
    const destination = editableRows.get(key);
    if (!destination || value === null || value === undefined || value === '' || (typeof value === 'number' && !Number.isFinite(value))) return;
    fields[key] = typeof value === 'number' ? round(value, 4) : value;
    mappingPreview.push({ destinationKey: key, value: fields[key], source, status: 'ready', unit: destination.unit || unit, label: destination.label });
  };
  const report = (items, reason) => {
    if (!items.length) return;
    unsupported.push(...items.map((item) => ({ itemId: item.id, page: item.page, level: item.level, category: item.label || item.category || item.kind, quantity: item.quantity, unit: item.unit, reason })));
  };
  const total = (items, valueField = 'quantity') => items.reduce((sum, row) => sum + Number(row[valueField] || 0), 0);
  const addTotal = (key, items, source, valueField = 'quantity') => {
    if (items.length && items.every((item) => item[valueField] !== null && Number.isFinite(Number(item[valueField])))) add(key, total(items, valueField), source, items[0].unit);
  };
  const incomplete = measurements.filter((item) => item.quantity === null);
  report(incomplete, 'This measurement needs a calibrated scale or valid geometry.');
  if (incomplete.length) warnings.push(`${incomplete.length} measurement(s) need calibration or valid geometry before import.`);
  const usable = measurements.filter((item) => item.quantity !== null);
  const unassigned = usable.filter((item) => item.level === 'Unassigned' && ['floorArea', 'wall', 'roofArea', 'eave', 'pillar'].includes(item.kind));
  report(unassigned, 'Assign this plan sheet to a building level before importing level quantities.');
  if (unassigned.length) warnings.push('Assign the measured plan sheets to building levels. A PDF sheet number does not identify a storey.');
  if (!schedule.measurementRecords) warnings.push('Reopen the saved takeoff to rebuild its measurements before importing this older summary.');

  add('projectName', schedule.project?.projectName, 'Takeoff project name');
  add('clientName', schedule.project?.clientName, 'Takeoff client');
  add('projectAddress', schedule.project?.siteAddress, 'Takeoff site address');

  const highestMeasuredLevel = Math.max(0, ...measurements.filter((item) => ['wall', 'floorArea'].includes(item.kind)).map((item) => Object.keys(IMPORT_LEVELS).indexOf(item.level) + 1));
  if (highestMeasuredLevel > 1) add('floorCount', highestMeasuredLevel === 3 ? 'Three storey' : 'Two storey', 'Highest assigned measured building level');

  for (const { key, candidates, conflict } of documentedInputCandidates(schedule.aiAnalysis)) {
    if (conflict) { warnings.push(`Conflicting drawing values for ${editableRows.get(key)?.label || key}; confirm before importing.`); continue; }
    const item = candidates[0];
    add(key, item.value, `Sheet ${item.page}: ${item.evidence}`, item.unit);
  }
  for (const item of schedule.projectTotals?.customTakeoffs || []) {
    if (item.section === 'Custom Takeoffs') unsupported.push({ ...item, reason: 'Saved in the Takeoff Schedule and basic project measurements. No matching Job Setup Data Input field exists; use the existing quotation schedule mapping.' });
  }
  // Only AI findings a person has to settle belong with the import warnings. The rest of what the
  // analysis recorded travels separately as diagnostics and is never a "needs attention" item.
  const aiReview = schedule.aiAnalysis?.review || [];
  const resolvedDecisions = schedule.aiAnalysis?.resolvedDecisions || {};
  warnings.push(...aiReview.filter((item) => reviewAudience(item) === 'decision' && !resolvedDecisions[`analysis:${item.code}`]).map(reviewText));

  const finishes = { Tiles: 'floorFinishTilesM2', Carpets: 'floorFinishCarpetsM2', Hybrid: 'floorFinishHybridM2', 'Polished Concrete': 'floorFinishPolishedConcreteM2', 'exposed Agg': 'floorFinishExposedAggM2' };
  Object.entries(finishes).forEach(([category, key]) => addTotal(key, measurements.filter((item) => item.kind === 'floorFinish' && item.category === category), `Measured ${category} area after exclusions`));
  report(usable.filter((item) => item.kind === 'floorFinish' && !finishes[item.category]), 'This finish has no matching Job Setup input.');
  report(usable.filter((item) => item.kind === 'measurement'), 'This general measurement has no classified Job Setup destination.');

  const walls = measurements.filter((item) => item.kind === 'wall' && item.category !== 'unclassified');
  report(usable.filter((item) => item.kind === 'wall' && item.category === 'unclassified'), 'Classify this wall as exterior or interior before importing its quantities.');
  // Construction class -> Job Setup field stem. Face Brick Veneer keeps the existing BrickVeneer
  // fields because that is what those rows have always measured; Rendered Brick Veneer is a new
  // construction type and needs its own destination rather than being folded into either
  // BrickVeneer or RenderedMasonry, which would misstate brick and render quantities.
  const wallClasses = Object.fromEntries(
    Object.entries(EXTERIOR_WALL_SYSTEM_FIELD_KEYS)
      .filter(([, category]) => category !== 'Other')
      .map(([key, category]) => [category, key]),
  );
  const exteriorOfClass = (category) => walls.filter((item) => item.category === 'exterior' && item.exteriorClassification === category);
  Object.entries(wallClasses).forEach(([category, key]) => addTotal(`total${key}ExternalWallsLm`, exteriorOfClass(category), `All measured ${category} exterior wall lengths`));
  // A class with measured length but no destination row would be dropped by add() without a trace,
  // and an absent field is indistinguishable from a zero quantity once it reaches Job Setup.
  Object.entries(wallClasses).forEach(([category, key]) => {
    const measured = exteriorOfClass(category);
    if (!measured.length || editableRows.has(`total${key}ExternalWallsLm`)) return;
    warnings.push(`${category} exterior walls were measured but Job Setup has no ${key}ExternalWallsLm inputs. Review wall type mapping.`);
  });
  // A legacy exteriorClassification of Other is not itself proof of no classification: a wall
  // classified only under the newer canonical system (core-filled blockwork, double brick, custom)
  // carries no legacy exteriorType at all and would otherwise be misreported here as unclassified
  // even though it has a real, reviewed construction. classificationStatus is the single source of
  // truth for what genuinely has no evidence.
  const unclassifiedWalls = walls.filter((item) => item.category === 'exterior' && item.classificationStatus === 'unclassified');
  addTotal('totalUnclassifiedExteriorWallsLm', unclassifiedWalls, 'Unclassified measured exterior wall lengths');
  if (unclassifiedWalls.length) warnings.push('Some exterior walls have no material classification. Review these walls.');

  // Phase 2B: canonical LEVEL x CONSTRUCTION SYSTEM x FRAME Job Setup destinations. Every physical
  // wall above is grouped into exactly one of these buckets from that same single measurement -
  // never a second, independently imported source - so the visible wall-system rows on the sheet,
  // the legacy per-finish rows above and the derived cross-level totals can never disagree. Core-
  // filled Blockwork and Double Brick get their own dedicated destinations here, remaining separate
  // from Brick Veneer, Lightweight Cladding and Timber Framing, exactly as required.
  const CANONICAL_EXTERNAL_SYSTEM_ROWS = [
    { system: 'brick_veneer', frame: 70, key: 'BrickVeneer70mmWallsLm' },
    { system: 'brick_veneer', frame: 90, key: 'BrickVeneer90mmWallsLm' },
    { system: 'lightweight_cladding', frame: 70, key: 'LightweightCladding70mmWallsLm' },
    { system: 'lightweight_cladding', frame: 90, key: 'LightweightCladding90mmWallsLm' },
    { system: 'core_filled_blockwork', frame: null, key: 'CoreFilledBlockworkLm' },
    { system: 'double_brick', frame: null, key: 'DoubleBrickLm' },
    { system: 'custom', frame: null, key: 'CustomExternalLm' },
  ];
  Object.entries(IMPORT_LEVELS).forEach(([level, prefix]) => {
    const levelExternalWalls = walls.filter((item) => item.category === 'exterior' && item.level === level);
    CANONICAL_EXTERNAL_SYSTEM_ROWS.forEach(({ system, frame, key }) => {
      const measured = levelExternalWalls.filter((item) => item.constructionSystem === system && (frame === null || item.frameThicknessMm === frame));
      addTotal(`${prefix}${key}`, measured, `${level}: measured ${CONSTRUCTION_SYSTEM_LABELS[system]}${frame ? ` ${frame}mm frame` : ''} exterior wall lengths`);
    });
    const levelUnclassifiedExternal = levelExternalWalls.filter((item) => item.classificationStatus === 'unclassified');
    addTotal(`${prefix}UnclassifiedExternalLm`, levelUnclassifiedExternal, `${level}: measured unclassified exterior wall lengths (review required)`);
    const levelInternalWalls = walls.filter((item) => item.category === 'interior' && item.level === level);
    addTotal(`${prefix}CustomInternalLm`, levelInternalWalls.filter((item) => item.constructionSystem === 'custom'), `${level}: measured custom internal wall lengths`);
    const levelUnclassifiedInternal = levelInternalWalls.filter((item) => item.classificationStatus === 'unclassified');
    addTotal(`${prefix}UnclassifiedInternalLm`, levelUnclassifiedInternal, `${level}: measured unclassified internal wall lengths (review required)`);
  });
  // Cross-level canonical totals - written directly from the full measured set, exactly like the
  // legacy total${system}ExternalWallsLm / totalUnclassifiedExteriorWallsLm rows already are, so
  // there is only ever one authoritative source per system, never a sheet formula duplicating it.
  const exteriorOfSystem = (system, frame) => walls.filter((item) => item.category === 'exterior' && item.constructionSystem === system && (frame === null || item.frameThicknessMm === frame));
  addTotal('totalBrickVeneer70mmWallsLm', exteriorOfSystem('brick_veneer', 70), 'All measured 230mm Brick Veneer — 70mm frame exterior wall lengths');
  addTotal('totalBrickVeneer90mmWallsLm', exteriorOfSystem('brick_veneer', 90), 'All measured 250mm Brick Veneer — 90mm frame exterior wall lengths');
  addTotal('totalLightweightCladding70mmWallsLm', exteriorOfSystem('lightweight_cladding', 70), 'All measured Lightweight Cladding — 70mm frame exterior wall lengths');
  addTotal('totalLightweightCladding90mmWallsLm', exteriorOfSystem('lightweight_cladding', 90), 'All measured Lightweight Cladding — 90mm frame exterior wall lengths');
  addTotal('totalCoreFilledBlockworkLm', exteriorOfSystem('core_filled_blockwork', null), 'All measured 200mm Core-filled Blockwork exterior wall lengths');
  addTotal('totalDoubleBrickLm', exteriorOfSystem('double_brick', null), 'All measured 230mm Double Brick exterior wall lengths');
  addTotal('totalCustomExternalLm', exteriorOfSystem('custom', null), 'All measured custom exterior wall lengths (review)');
  const interiorOfSystem = (system) => walls.filter((item) => item.category === 'interior' && item.constructionSystem === system);
  addTotal('totalCustomInternalLm', interiorOfSystem('custom'), 'All measured custom internal wall lengths (review)');
  const unclassifiedInternalWalls = walls.filter((item) => item.category === 'interior' && item.classificationStatus === 'unclassified');
  addTotal('totalUnclassifiedInternalLm', unclassifiedInternalWalls, 'All measured unclassified internal wall lengths (review required)');
  if (unclassifiedInternalWalls.length) warnings.push('Some internal walls have no material classification. Review these walls before pricing.');

  const openingGroups = [
    ['window', usable.filter((item) => item.kind === 'opening' && item.openingClass === 'Window')],
    ['door', usable.filter((item) => item.kind === 'opening' && /Door/.test(item.openingClass))],
  ];
  openingGroups.forEach(([type, items]) => {
    addTotal(`${type}OpeningsQty`, items, `Measured ${type} openings`);
    addTotal(`${type}OpeningsAreaM2`, items, `Measured ${type} opening width x height`, 'openingAreaM2');
    if (items.some((item) => item.openingAreaM2 === null)) warnings.push(`Some ${type} openings need width and height. Review openings.`);
  });
  report(usable.filter((item) => item.kind === 'opening' && item.openingClass === 'Other Opening'), 'This opening needs a window or door classification.');

  // Architraves. Every piece is cut longer than its opening to carry its mitres, and the whole job
  // is packed from one pool of stock so the offcut left by a wide window trims a narrower one.
  const openings = usable.filter((item) => item.kind === 'opening');
  const doorClasses = { 'Internal Door': 'internalDoor', 'External Door': 'externalDoor', 'Large Glazed/Stacker/Sliding Door': 'slidingDoor', 'Garage Door': 'garageDoor', Window: 'window' };
  Object.entries(doorClasses).forEach(([openingClass, prefix]) => {
    if (prefix !== 'window') addTotal(`${prefix}OpeningsQty`, openings.filter((item) => item.openingClass === openingClass), `Measured ${openingClass.toLowerCase()}s`);
  });
  const architrave = packOpenings(openings);
  if (openings.length && !architrave.unmeasured.length && !architrave.oversized) {
    add('architraveLengthsQty', architrave.lengths, `${ARCHITRAVE_DEFAULTS.stockLengthM}m lengths after cutting the whole job, offcuts reused`, 'EACH');
    add('architraveMeasuredLm', architrave.requiredM, 'Architrave actually cut, including mitre allowances', 'LM');
    add('architraveWasteLm', architrave.wasteM, 'Offcut that no remaining piece could use', 'LM');
    Object.entries(doorClasses).forEach(([openingClass, prefix]) => {
      if (architrave.perClass[openingClass]) add(`${prefix}ArchitraveLm`, architrave.perClass[openingClass], `${openingClass}: ${ARCHITRAVE_RULES[openingClass].faces === 2 ? 'both faces' : 'inside face'}, mitres included`, 'LM');
    });
  }
  if (architrave.unmeasured.length) warnings.push(`${architrave.unmeasured.length} opening(s) have no width and height, so no architrave could be cut for the job. Review openings.`);
  if (architrave.oversized) warnings.push(`Some openings need a piece longer than a ${ARCHITRAVE_DEFAULTS.stockLengthM}m length. Review openings.`);
  const sills = openings.map((item) => ({ ...item, quantity: brickSillLength(item), unit: 'lm' })).filter((item) => item.quantity > 0);
  addTotal('totalBrickSillLengthLm', sills, 'Widths of windows requiring brick sills, excluding full height windows');

  const plasterRows = [];
  Object.entries(IMPORT_LEVELS).forEach(([level, prefix]) => {
    const floorplans = measurements.filter((item) => item.kind === 'floorArea' && item.level === level);
    const floorTypes = { Patio: `${prefix}PatioAreaM2`, Garage: `${prefix}GarageAreaM2`, Alfresco: `${prefix}AlfrescoAreaM2`, Porch: `${prefix}PorchAreaM2` };
    if (prefix !== 'third') Object.assign(floorTypes, { Deck: `${prefix}OtherAreaM2`, Other: `${prefix}OtherAreaM2` });
    if (prefix === 'lower') floorTypes.Balcony = 'lowerOtherAreaM2';
    if (prefix === 'upper') floorTypes.Balcony = 'balconyAreaM2';
    if (prefix === 'third') floorTypes.Balcony = 'upperBalconyAreaM2';
    new Set(Object.values(floorTypes)).forEach((key) => {
      const items = floorplans.filter((item) => floorTypes[item.category] === key);
      addTotal(key, items, `${level}: ${[...new Set(items.map((item) => item.category))].join(', ')} area`);
    });
    if (prefix !== 'third' && floorplans.some((item) => item.category === 'Patio') && !floorplans.some((item) => floorTypes[item.category] === `${prefix}OtherAreaM2`)) add(`${prefix}OtherAreaM2`, 0, `${level}: Patio is mapped separately; no Other area was measured`, 'm2');
    const living = floorplans.filter((item) => item.category === 'Living');
    const footprints = floorplans.filter((item) => item.category === 'Footprint');
    // A level with no traced outline still has its areas when the plan's own area table states
    // them clearly. Measured geometry always wins; a printed figure only fills a gap.
    const stated = (schedule.aiAnalysis?.documentedAreas || []).filter((item) => item.level === level && Number(item.valueM2) > 0);
    const statedArea = (type) => {
      const matches = stated.filter((item) => item.type === type);
      return matches.length && new Set(matches.map((item) => item.valueM2)).size === 1 ? matches[0] : null;
    };
    if (!living.length && !footprints.length && statedArea('Living')) {
      const item = statedArea('Living');
      add(`${prefix}FloorAreaM2`, item.valueM2, `${level}: "${item.label}" as printed on plan sheet ${item.page} (no outline was traced)`, 'm2');
    }
    Object.entries(floorTypes).forEach(([type, key]) => {
      const item = statedArea(type);
      if (item && !Object.hasOwn(fields, key) && !floorplans.some((area) => floorTypes[area.category] === key)) add(key, item.valueM2, `${level}: "${item.label}" as printed on plan sheet ${item.page} (no outline was traced)`, 'm2');
    });
    const deductions = floorplans.filter((item) => !['Footprint', 'Living'].includes(item.category));
    if (living.length) addTotal(`${prefix}FloorAreaM2`, living, `${level}: measured living area`);
    else if (footprints.length && floorplans.every((item) => item.quantity !== null)) {
      const livingArea = total(footprints) - total(deductions);
      if (livingArea >= 0) add(`${prefix}FloorAreaM2`, livingArea, `${level}: gross footprint less ${deductions.length ? 'separately measured areas' : 'no measured deductions'}`, 'm2');
      else warnings.push(`${level}: the measured deductions exceed the footprint. Review floor area boundaries.`);
    }
report(floorplans.filter((item) => !['Footprint', 'Living'].includes(item.category) && !floorTypes[item.category]), 'This area category has no matching editable input on this level.');
 
     const levelWalls = walls.filter((item) => item.level === level);
      const externalWalls = levelWalls.filter((item) => item.category === 'exterior');
      const internalWalls = levelWalls.filter((item) => item.category === 'interior');
 
      // External walls total
     {
       const validExternalWalls = externalWalls.filter((item) => item.quantity !== null && Number.isFinite(Number(item.quantity)));
       if (validExternalWalls.length) {
         const total = validExternalWalls.reduce((sum, item) => sum + Number(item.quantity), 0);
         add(`${prefix}ExternalWallsLm`, total, `${level}: measured exterior wall lengths`, 'LM');
       }
     }

     // Internal walls total
     {
       const validInternalWalls = internalWalls.filter((item) => item.quantity !== null && Number.isFinite(Number(item.quantity)));
       if (validInternalWalls.length) {
         const total = validInternalWalls.reduce((sum, item) => sum + Number(item.quantity), 0);
         add(`${prefix}InternalWallsLm`, total, `${level}: measured internal wall lengths`, 'LM');
       }
     }

     // Wall class totals
     Object.entries(wallClasses).forEach(([category, key]) => {
       const wallsOfClass = levelWalls.filter((item) => item.category === 'exterior' && item.exteriorClassification === category);
       const validWallsOfClass = wallsOfClass.filter((item) => item.quantity !== null && Number.isFinite(Number(item.quantity)));
       if (validWallsOfClass.length) {
         const total = validWallsOfClass.reduce((sum, item) => sum + Number(item.quantity), 0);
         add(`${prefix}${key}ExternalWallsLm`, total, `${level}: measured ${category} exterior walls`, 'LM');
       }
     });
    const explicitHeights = levelWalls.map((item) => item.wallHeightM);
    if (explicitHeights.length && explicitHeights.every((value) => value > 0) && new Set(explicitHeights).size === 1) add(`${prefix}CeilingHeight`, explicitHeights[0] * 1000, `${level}: common measured wall height in millimetres`);
    ['exterior', 'interior'].forEach((category) => {
      const categoryWalls = levelWalls.filter((item) => item.category === category);
      const thicknesses = categoryWalls.map((item) => item.thicknessMm);
      if (thicknesses.length && thicknesses.every((value) => value > 0) && new Set(thicknesses).size === 1) add(`${prefix}${category === 'interior' ? 'Internal' : ''}WallThicknessMm`, thicknesses[0], `${level}: common ${category} wall thickness`, 'MM');
    });
    const interiorWalls = levelWalls.filter((item) => item.category === 'interior');
    const knownHeight = parseHeightM(schedule.jobSetupRows?.[`${prefix}CeilingHeight`]?.value ?? schedule.jobSetupRows?.[`${prefix}CeilingHeight`], null);
    if (levelWalls.some((item) => item.category === 'exterior' && !item.wallHeightM && !knownHeight)) warnings.push(`${level}: enter wall or ceiling heights.`);
    const plaster = interiorWalls.map((item) => {
      const height = item.wallHeightM || knownHeight;
      const gross = item.quantity !== null && height ? item.quantity * height * item.linedFaces : null;
      return { ...item, gross, net: gross === null ? null : Math.max(0, gross - (item.openingDeductionsEnabled ? item.linkedOpeningAreaM2 * item.linedFaces : 0)) };
    });
    addTotal(`${prefix}InternalWallGrossPlasterboardM2`, plaster, `${level}: internal wall lengths x known heights x lined faces`, 'gross');
    addTotal(`${prefix}InternalWallNetPlasterboardM2`, plaster, `${level}: internal wall lining less linked opening deductions`, 'net');
    plasterRows.push(...plaster);
    if (plaster.some((item) => item.gross === null)) warnings.push(`${level}: enter wall or ceiling heights.`);
    addTotal(`${prefix}BrickSillLengthLm`, sills.filter((item) => item.level === level), `${level}: measured brick sill widths`);
    addTotal(`${prefix}EavesLm`, measurements.filter((item) => item.kind === 'eave' && item.level === level), `${level}: measured eaves lengths`);
    addTotal(`${prefix}RoofPlanAreaM2`, measurements.filter((item) => item.kind === 'roofArea' && item.level === level), `${level}: measured roof plan area`);
  });
  const allInteriorWalls = walls.filter((item) => item.category === 'interior');
  if (plasterRows.length === allInteriorWalls.length) {
    addTotal('totalInternalWallGrossPlasterboardM2', plasterRows, 'Total measured internal wall plasterboard with known heights', 'gross');
    addTotal('totalInternalWallNetPlasterboardM2', plasterRows, 'Total measured internal wall plasterboard less linked openings', 'net');
  }
  const unlinked = openings.filter((item) => !item.linkedWallId);
  if (unlinked.length) warnings.push(`${unlinked.length} opening(s) need a wall assignment. Review openings.`);
  const unhostedDoors = openings.filter((item) => item.openingClass === 'Internal Door' && !item.wallThicknessMm && !item.thicknessMm);
  if (unhostedDoors.length) warnings.push(`${unhostedDoors.length} internal door opening(s) need a wall link or frame thickness. Review openings.`);
  Object.entries(takeoffMaterialFields(measurements, schedule.jobSetupRows)).forEach(([key, value]) => add(key, value, 'Associated takeoff wall/opening measurements'));
  const eaves = measurements.filter((item) => item.kind === 'eave');
  
  const widths = eaves.map((item) => item.widthMm);
  if (widths.length && widths.every((width) => width > 0) && new Set(widths).size === 1) add('eavesWidthM', widths[0] / 1000, 'Common measured eaves width in metres', 'M');
  else if (widths.length) warnings.push('Eaves have mixed or missing widths. Review the eaves width.');

  // ONE cavity sliding door = ONE canonical opening, which derives its own cavity slider
  // frame/cage requirement here - the builder never enters the cage as a second, independent
  // Takeoff item.
  const cavitySliderOpenings = usable.filter((item) => item.kind === 'opening' && isCavitySlider(item));
  const cavitySliderSchedule = buildCavitySliderSchedule(cavitySliderOpenings);
  Object.entries(IMPORT_LEVELS).forEach(([level, prefix]) => {
    addTotal(`${prefix}CavitySliderCagesEach`, cavitySliderOpenings.filter((item) => item.level === level), `${level}: cavity sliding doors, one frame/cage per door`);
  });
  // Unconditional (unlike addTotal, which only writes a field when at least one qualifying item
  // exists) for the same reason takeoffMaterialFields explicitly zeroes jamb90x19/jamb110x19
  // whenever there is any measured opening at all, rather than omitting them when neither jamb size
  // is needed: totalCavitySliderCagesEach is a persisted field (calculated: false, editable: true)
  // only updated by Apply Takeoff, and ALWAYS_TRUST_TAKEOFF_KEYS in jobSetupTakeoffImport.js relies
  // on this field actually being PRESENT in the payload to overwrite a stale prior count. addTotal's
  // "only write it if items.length" guard meant a Takeoff that used to have cavity sliders and now
  // has none would never emit this key at all, leaving an old non-zero count to survive every future
  // reapply forever - exactly the reported "stale 4 cages that should be 0" bug. usable.length (real
  // measured Takeoft data exists at all) is the guard, matching jamb's own "any opening exists" test.
  if (usable.length) add('totalCavitySliderCagesEach', total(cavitySliderOpenings, 'quantity'), 'All measured cavity sliding doors, one frame/cage per door');

  // Pillars, Posts & Columns: ONE physical column = ONE canonical Takeoff object, which derives
  // several downstream trade quantities here rather than requiring duplicate manual entries - a
  // post/column count for the frame order, and (only when a brick core or brick surround is
  // documented) a derived masonry face area for the SAME existing brick-order engine walls already
  // use (brickOrderQuantities), never a second, competing brick calculation.
  const pillars = usable.filter((item) => item.kind === 'pillar');
  const pillarSchedule = schedule.projectTotals?.pillars || [];
  Object.entries(IMPORT_LEVELS).forEach(([level, prefix]) => {
    addTotal(`${prefix}PostColumnsEach`, pillars.filter((item) => item.level === level), `${level}: measured posts/columns`);
  });
  addTotal('totalPostColumnsEach', pillars, 'All measured posts/columns');
  const unclassifiedPillars = pillars.filter((item) => item.classificationStatus === 'unclassified');
  addTotal('totalUnclassifiedPostColumnsEach', unclassifiedPillars, 'Unclassified posts/columns (review required)');
  if (unclassifiedPillars.length) warnings.push('Some posts/columns have no structural/core classification; review before pricing.');
  // Perimeter x height is the masonry FACE area a brick skin actually covers - never footprint x
  // height, which would misstate a slab/base area as a brick quantity. Uses whichever rectangle is
  // actually brick: the surround's outer footprint when one exists, or the core's own footprint for
  // a solid brick/masonry pillar with no separate core.
  const brickFaceNetM2 = (item) => {
    const hasBrickSurround = item.surroundType === 'brick' || item.surroundType === 'rendered_brick';
    const isBrickCore = item.coreType === 'brick' && (!item.surroundType || item.surroundType === 'none');
    if (!hasBrickSurround && !isBrickCore) return 0;
    const widthMm = hasBrickSurround ? item.surroundWidthMm : item.coreWidthMm;
    const depthMm = hasBrickSurround ? item.surroundDepthMm : item.coreDepthMm;
    if (!(widthMm > 0) || !(depthMm > 0) || !(item.heightMm > 0)) return 0;
    const perimeterM = 2 * (widthMm + depthMm) / 1000;
    return perimeterM * (item.heightMm / 1000) * (Number(item.quantity) || 1);
  };
  const isRenderedFinish = (item) => item.surroundType === 'rendered_brick' || (item.coreType === 'brick' && item.brickFinish === 'Rendered Brick');
  const facePillars = pillars.filter((item) => brickFaceNetM2(item) > 0 && !isRenderedFinish(item));
  const renderedPillars = pillars.filter((item) => brickFaceNetM2(item) > 0 && isRenderedFinish(item));
  const totalFaceNetM2 = round(facePillars.reduce((sum, item) => sum + brickFaceNetM2(item), 0), 4);
  const totalRenderedNetM2 = round(renderedPillars.reduce((sum, item) => sum + brickFaceNetM2(item), 0), 4);
  if (totalFaceNetM2 > 0) add('totalPostColumnFaceBrickNetM2', totalFaceNetM2, 'Derived from post/column brick surround or brick core geometry (perimeter x height), face finish', 'M2');
  if (totalRenderedNetM2 > 0) add('totalPostColumnRenderedBrickNetM2', totalRenderedNetM2, 'Derived from post/column brick surround or brick core geometry (perimeter x height), rendered finish', 'M2');
  if (totalFaceNetM2 > 0 || totalRenderedNetM2 > 0) {
    // Same engine, same waste/course-conversion rules as wall brick ordering - a post/column brick
    // quantity is never a second, competing calculation.
    const order = brickOrderQuantities(totalFaceNetM2, totalRenderedNetM2);
    add('totalPostColumnFaceBrickOrderEach', order.faceBrickOrderEach, 'Derived post/column face brick order quantity (same brick-order engine as walls)', 'EACH');
    add('totalPostColumnRenderedBrickOrderEach', order.renderedTwinOrderEach + order.renderedSingleOrderEach, 'Derived post/column rendered brick order quantity (same brick-order engine as walls)', 'EACH');
  }

  // One review for both screens: what was established, what a person must decide, and the
  // AI's own technical notes kept apart as diagnostics.
  const review = buildTakeoffReview({ records: measurements, analysis: schedule.aiAnalysis, jobSetupRows: schedule.jobSetupRows });
  return {
    review,
    diagnostics: review.diagnostics,
    projectName: schedule.project?.projectName || '', clientName: schedule.project?.clientName || '', siteAddress: schedule.project?.siteAddress || '',
    planFilename: schedule.project?.planFilename || '',
    floorAreas: schedule.projectTotals?.floorAreas || [], roomList: schedule.projectTotals?.rooms || [],
    basicProjectMeasurements: flattenScheduleRows(schedule, 'projectTotals'),
    schedule, sheetLevels, dataInputFields: fields, cavitySliderSchedule, pillarSchedule,
    ...(Array.isArray(schedule.measurementRecords) ? { absentMaterialFields: absentTakeoffMaterialFields(measurements).filter((key) => editableRows.has(key) && !Object.hasOwn(fields, key)) } : {}),
    mappingPreview: [...new Map(mappingPreview.map((row) => [row.destinationKey, row])).values()], unsupported,
    warnings: [...new Set(warnings)],
    provenance: { jobId: options.jobId || '', takeoffId: options.takeoffId || '', revision: Number(options.revision || 0), projectId: options.projectId || '', sheetLevels, transferredAt: new Date().toISOString() },
  };
}
export function getScheduleSignature(schedule) {
  return JSON.stringify(flattenScheduleRows(schedule, 'projectTotals').map((row) => [row.itemId, row.quantity, row.unit]));
}
