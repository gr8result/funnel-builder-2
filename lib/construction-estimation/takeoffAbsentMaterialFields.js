import { TAKEOFF_LEVELS, brickSillLength, EXTERIOR_WALL_SYSTEM_FIELD_KEYS } from './takeoffMaterialQuantities.js';

// A rebuilt schedule can distinguish a removed category from a missing measurement.
// These are candidates only: the importer applies them solely to this takeoff's prior inputs.
export function absentTakeoffMaterialFields(measurements) {
  if (!Array.isArray(measurements)) return [];
  const absent = new Set();
  const add = (...keys) => keys.forEach((key) => absent.add(key));
  const walls = measurements.filter((item) => item.kind === 'wall');
  const openings = measurements.filter((item) => item.kind === 'opening');
  const valid = (item) => item.quantity !== null && Number.isFinite(Number(item.quantity))
    && Object.hasOwn(TAKEOFF_LEVELS, item.level);
  const systems = EXTERIOR_WALL_SYSTEM_FIELD_KEYS;

  // Unassigned/unclassified or invalid runs may be the previous measurement; retain it.
  if (walls.every((item) => valid(item) && ['interior', 'exterior'].includes(item.category))) {
    for (const [level, prefix] of Object.entries(TAKEOFF_LEVELS)) {
      const levelWalls = walls.filter((item) => item.level === level);
      for (const [category, type] of [['interior', 'Internal'], ['exterior', 'External']]) {
        if (levelWalls.some((item) => item.category === category)) continue;
        add(`${prefix}${type}WallsLm`, `${prefix}${type}70mmWallsLm`, `${prefix}${type}90mmWallsLm`);
        if (category === 'interior') add(`${prefix}CavitySlider90mmWallsLm`, `${prefix}CavitySlider90mmStudsEach`,
          `${prefix}InternalWallGrossPlasterboardM2`, `${prefix}InternalWallNetPlasterboardM2`);
      }
      for (const [key, category] of Object.entries(systems)) {
        if (levelWalls.some((item) => item.category === 'exterior' && item.exteriorClassification === category)) continue;
        add(`${prefix}${key}ExternalWallsLm`, `${prefix}${key}GrossWallM2`, `${prefix}${key}OpeningM2`, `${prefix}${key}NetWallM2`);
      }
    }
    if (!walls.some((item) => item.category === 'interior')) add('totalInternalWallGrossPlasterboardM2', 'totalInternalWallNetPlasterboardM2');
    for (const [key, category] of Object.entries(systems)) {
      if (!walls.some((item) => item.category === 'exterior' && item.exteriorClassification === category)) {
        add(key === 'Other' ? 'totalUnclassifiedExteriorWallsLm' : `total${key}ExternalWallsLm`);
      }
    }
  }

  // Invalid dimensions and unknown classifications/levels are not deleted openings.
  const classes = { Window: 'window', 'Internal Door': 'internalDoor', 'External Door': 'externalDoor',
    'Large Glazed/Stacker/Sliding Door': 'slidingDoor', 'Garage Door': 'garageDoor' };
  if (openings.every((item) => valid(item) && Object.hasOwn(classes, item.openingClass)
    && item.openingAreaM2 !== null && Number.isFinite(Number(item.openingAreaM2)))) {
    for (const [openingClass, prefix] of Object.entries(classes)) {
      if (openings.some((item) => item.openingClass === openingClass)) continue;
      add(`${prefix}OpeningsQty`, `${prefix}ArchitraveLm`);
      if (prefix === 'window') add('windowOpeningsAreaM2');
    }
    if (!openings.some((item) => /Door/.test(item.openingClass))) add('doorOpeningsQty', 'doorOpeningsAreaM2');
    if (!openings.some((item) => item.openingClass === 'Internal Door')) add('jamb90x19StockLengthsEach', 'jamb110x19StockLengthsEach');
    if (!openings.length) add('architraveLengthsQty', 'architraveMeasuredLm', 'architraveWasteLm');
    for (const [level, prefix] of Object.entries(TAKEOFF_LEVELS)) {
      const levelOpenings = openings.filter((item) => item.level === level);
      if (!levelOpenings.some((item) => item.openingClass === 'Window')) add(`${prefix}WindowOpeningsAreaM2`);
      if (!levelOpenings.some((item) => /Door/.test(item.openingClass))) add(`${prefix}DoorOpeningsAreaM2`);
      if (!levelOpenings.length) add(`${prefix}ExternalOpeningAreaM2`);
      if (!levelOpenings.some((item) => brickSillLength(item) > 0)) add(`${prefix}BrickSillLengthLm`);
    }
    if (!openings.some((item) => brickSillLength(item) > 0)) add('brickVeneerSillsLm', 'totalBrickSillLengthLm');
  }
  return [...absent];
}
