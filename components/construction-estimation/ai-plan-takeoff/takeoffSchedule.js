const DEFAULT_WALL_HEIGHT_M = 2.4;

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

const EXTERIOR_WALL_CLASSES = ['Brick Veneer', 'Lightweight Cladding', 'Rendered Masonry', 'Other'];
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

function runLengthM(run, pixelsPerMm) {
  if (run.lengthMm) return run.lengthMm / 1000;
  if (!run.nodes || run.nodes.length < 2 || !pixelsPerMm) return 0;
  let lengthPx = 0;
  for (let i = 1; i < run.nodes.length; i += 1) {
    lengthPx += Math.hypot(run.nodes[i].x - run.nodes[i - 1].x, run.nodes[i].y - run.nodes[i - 1].y);
  }
  return lengthPx / pixelsPerMm / 1000;
}

function openingAreaM2(opening) {
  return ((Number(opening.widthMm) || 0) * (Number(opening.heightMm) || 0)) / 1000000;
}

function floorFromPage(page = 1) {
  const pageNumber = Number(page) || 1;
  if (pageNumber === 1) return { key: 'lower', label: 'Ground Floor' };
  if (pageNumber === 2) return { key: 'upper', label: 'Second Level' };
  if (pageNumber === 3) return { key: 'third', label: 'Third Level' };
  return { key: `sheet${pageNumber}`, label: `Sheet ${pageNumber}` };
}

function parseHeightM(value, fallback = DEFAULT_WALL_HEIGHT_M) {
  const num = Number(value);
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

function normaliseExteriorClass(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text.includes('brick')) return 'Brick Veneer';
  if (text.includes('lightweight') || text.includes('cladding')) return 'Lightweight Cladding';
  if (text.includes('render')) return 'Rendered Masonry';
  if (text.includes('other')) return 'Other';
  return 'Other';
}

function classifyOpening(opening = {}) {
  const explicit = String(opening.openingClass || '').trim();
  if (OPENING_CLASSES.includes(explicit)) return explicit;
  const type = String(opening.type || '').toLowerCase();
  const subType = String(opening.subType || opening.windowStyle || opening.doorType || '').toLowerCase();
  if (type === 'window') return 'Window';
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
  const livingMeasured = rows.find((row) => row.itemId === 'floor_Living')?.quantity || 0;
  const totalLiving = livingMeasured || Math.max(0, footprint - separatelyNamed);

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

function createEaveRows(eaves = []) {
  return Object.values(eaves.reduce((acc, eave) => {
    const widthLabel = eave.widthOption === 'Special' ? `${eave.widthMm}mm Special` : `${eave.widthMm || eave.widthOption}mm`;
    const key = `${eave.level || 'Unassigned'}|${widthLabel}`;
    const lengthM = (eave.lengthMm || 0) / 1000;
    if (!acc[key]) {
      acc[key] = makeRow('Roof and Eaves', `eaves_${key}`, 'Eaves area', 0, 'm2', {
        level: eave.level || 'Unassigned',
        eavesWidth: widthLabel,
        eavesLengthLm: 0,
        fasciaLengthLm: 0,
        gutterLengthLm: 0,
        downpipeQuantity: eave.downpipeQuantity || 0
      });
    }
    acc[key].eavesLengthLm = round(acc[key].eavesLengthLm + lengthM);
    acc[key].fasciaLengthLm = round(acc[key].fasciaLengthLm + lengthM);
    acc[key].gutterLengthLm = round(acc[key].gutterLengthLm + lengthM);
    acc[key].quantity = round(acc[key].quantity + lengthM * ((eave.widthMm || 0) / 1000));
    return acc;
  }, {}));
}

function createRoomRows(measurements = []) {
  return measurements.map((measurement) => (
    makeRow('Rooms', measurement.id, 'Basic project measurement', measurement.lengthMm ? measurement.lengthMm / 1000 : 0, 'lm', {
      planSheet: measurement.page
    })
  ));
}

function createWindowAndDoorSchedules(openings = []) {
  const windows = [];
  const doors = [];

  const windowBuckets = new Map();
  const doorBuckets = new Map();

  openings.forEach((opening) => {
    const openingClass = classifyOpening(opening);
    const floor = floorFromPage(opening.page);
    const widthMm = Number(opening.widthMm) || 0;
    const heightMm = Number(opening.heightMm) || 0;
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
      const existing = windowBuckets.get(key) || {
        floor: floor.label,
        location: String(opening.location || opening.room || '').trim() || 'Unspecified',
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
        brickSillLengthLm: 0
      };
      existing.quantity += 1;
      existing.totalOpeningAreaM2 = round(existing.totalOpeningAreaM2 + areaM2);
      const fullHeight = heightMm >= 2100;
      const eligibleBrickSill = existing.brickSillRequired && !fullHeight && widthMm > 0;
      if (eligibleBrickSill) {
        existing.brickSillLengthLm = round(existing.brickSillLengthLm + (widthMm / 1000));
      }
      windowBuckets.set(key, existing);
      return;
    }

    const externalOrInternal = openingClass === 'Internal Door' ? 'Internal' : 'External';
    const key = [
      floor.label,
      String(opening.location || opening.room || '').trim() || 'Unspecified',
      externalOrInternal,
      openingClass,
      widthMm,
      heightMm,
      String(opening.glassType || '').trim(),
      String(opening.frameJambDetails || opening.frameMaterial || '').trim()
    ].join('|');
    const existing = doorBuckets.get(key) || {
      floor: floor.label,
      location: String(opening.location || opening.room || '').trim() || 'Unspecified',
      internalExternal: externalOrInternal,
      doorType: openingClass,
      quantity: 0,
      widthMm,
      heightMm,
      totalOpeningAreaM2: 0,
      frameJambDetails: String(opening.frameJambDetails || opening.frameMaterial || '').trim(),
      glassType: String(opening.glassType || '').trim()
    };
    existing.quantity += 1;
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
      windowStyle: row.windowStyle,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
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
      internalExternal: row.internalExternal,
      doorType: row.doorType,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
      totalOpeningAreaM2: row.totalOpeningAreaM2,
      frameJambDetails: row.frameJambDetails,
      glassType: row.glassType
    });
  });

  const brickSillSubtotals = windows.reduce((acc, row) => {
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

function createWallSchedules(walls = [], openings = [], pixelsPerMm, jobSetupRows = {}) {
  const heights = wallHeightByFloor(jobSetupRows);
  const openingsByWallId = openings.reduce((acc, opening) => {
    const host = String(opening.hostWallId || '').trim();
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
    const floor = floorFromPage(wall.page);
    const lengthM = runLengthM(wall, pixelsPerMm);
    const isExterior = String(wall.category || '').toLowerCase() === 'exterior';
    const className = isExterior ? normaliseExteriorClass(wall.exteriorType) : 'Internal';
    const wallHeightM = parseHeightM(wall.wallHeightM || wall.heightM, heights[floor.key] || DEFAULT_WALL_HEIGHT_M);
    const linedFaces = Number(wall.linedFaces || 2) === 1 ? 1 : 2;
    const linkedOpenings = openingsByWallId[String(wall.id)] || [];
    const linkedOpeningArea = linkedOpenings.reduce((sum, opening) => sum + openingAreaM2(opening), 0);

    wallRecords.push({
      section: 'Wall Records',
      itemId: String(wall.id || `wall_${index + 1}`),
      wallType: isExterior ? 'External walls' : 'Internal walls',
      planSheet: wall.page,
      level: floor.label,
      lengthM: round(lengthM),
      wallHeightM: round(wallHeightM, 3),
      thicknessMm: wall.thicknessMm || 0,
      exteriorClassification: isExterior ? className : '',
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
      netPlasterboardAreaM2: round(Math.max(0, grossAreaM2 - openingDeductionM2))
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
    interiorTotals
  };
}

function buildForPages({ pages, completedFloorplans, completedWallRuns, placedOpenings, completedAreas, completedMeasurements, completedEaves, pixelsPerMm, jobSetupRows }) {
  const include = (item) => pages.includes(item.page);
  const floorplans = completedFloorplans.filter(include);
  const walls = completedWallRuns.filter(include);
  const openings = placedOpenings.filter(include);
  const finishes = completedAreas.filter(include);
  const eaves = completedEaves.filter(include);
  const measurements = completedMeasurements.filter(include);

  const floorAreas = createFloorAreaRows(floorplans, pixelsPerMm);
  const wallSchedules = createWallSchedules(walls, openings, pixelsPerMm, jobSetupRows);
  const openingSchedules = createWindowAndDoorSchedules(openings);
  const floorFinishes = createFloorFinishRows(finishes, pixelsPerMm);
  const roofAndEaves = createEaveRows(eaves);
  const rooms = createRoomRows(measurements);

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
    openings: [...openingSchedules.windows, ...openingSchedules.doors],
    windows: [...openingSchedules.windows, ...brickSillRows, {
      section: 'Windows',
      itemId: 'brick_sill_total',
      mark: '',
      category: 'Total brick-veneer window-sill length',
      floor: 'All Floors',
      quantity: openingSchedules.totalBrickSillLengthLm,
      unit: 'lm',
      brickSillRequired: 'Yes'
    }],
    doors: openingSchedules.doors,
    floorFinishes,
    roofAndEaves,
    rooms,
    customTakeoffs: []
  };
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
  jobSetupRows = {}
}) {
  const projectPages = Array.from({ length: totalPages || 1 }, (_, index) => index + 1);
  return {
    generatedAt: new Date().toISOString(),
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
        pages: [currentPage],
        completedFloorplans,
        completedWallRuns,
        placedOpenings,
        completedAreas,
        completedMeasurements,
        completedEaves,
        pixelsPerMm,
        jobSetupRows
      })
    },
    projectTotals: buildForPages({
      pages: projectPages,
      completedFloorplans,
      completedWallRuns,
      placedOpenings,
      completedAreas,
      completedMeasurements,
      completedEaves,
      pixelsPerMm,
      jobSetupRows
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
    ...(sectionData.floorFinishes || []),
    ...(sectionData.rooms || []),
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
    'Roof and Eaves': schedule.projectTotals.roofAndEaves,
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
  const floorAreas = schedule.projectTotals.floorAreas || [];
  const exteriorWalls = schedule.projectTotals.exteriorWalls || [];
  const interiorWalls = schedule.projectTotals.interiorWallsAndPlasterboard || [];
  const windows = (schedule.projectTotals.windows || []).filter((row) => String(row.mark || '').startsWith('W'));
  const doors = schedule.projectTotals.doors || [];
  const floorFinishes = schedule.projectTotals.floorFinishes || [];
  const eaves = schedule.projectTotals.roofAndEaves || [];

  const floorAreaByName = (name, floor = '') => sumRows(floorAreas, (row) => row.category === name && (!floor || row.floor === floor));
  const extByClass = (className, floor = '') => sumRows(exteriorWalls, (row) => row.category === className && (!floor || row.floor === floor));
  const intByFloor = (floor = '') => sumRows(interiorWalls, (row) => row.category === 'Internal wall' && (!floor || row.floor === floor));

  const fields = {
    projectName: schedule.project.projectName,
    clientName: schedule.project.clientName,
    projectAddress: schedule.project.siteAddress,

    lowerFloorAreaM2: floorAreaByName('Total living area', 'Ground Floor'),
    upperFloorAreaM2: floorAreaByName('Total living area', 'Second Level'),
    thirdFloorAreaM2: floorAreaByName('Total living area', 'Third Level'),

    lowerExternalWallsLm: sumRows(exteriorWalls, (row) => row.floor === 'Ground Floor'),
    upperExternalWallsLm: sumRows(exteriorWalls, (row) => row.floor === 'Second Level'),
    thirdExternalWallsLm: sumRows(exteriorWalls, (row) => row.floor === 'Third Level'),
    totalExternalWallsLm: sumRows(exteriorWalls),

    lowerInternalWallsLm: intByFloor('Ground Floor'),
    upperInternalWallsLm: intByFloor('Second Level'),
    thirdInternalWallsLm: intByFloor('Third Level'),
    totalInternalWallsLm: intByFloor(),

    lowerBrickVeneerExternalWallsLm: extByClass('Brick Veneer', 'Ground Floor'),
    upperBrickVeneerExternalWallsLm: extByClass('Brick Veneer', 'Second Level'),
    thirdBrickVeneerExternalWallsLm: extByClass('Brick Veneer', 'Third Level'),
    totalBrickVeneerExternalWallsLm: extByClass('Brick Veneer'),

    lowerLightweightCladdingExternalWallsLm: extByClass('Lightweight Cladding', 'Ground Floor'),
    upperLightweightCladdingExternalWallsLm: extByClass('Lightweight Cladding', 'Second Level'),
    thirdLightweightCladdingExternalWallsLm: extByClass('Lightweight Cladding', 'Third Level'),
    totalLightweightCladdingExternalWallsLm: extByClass('Lightweight Cladding'),

    lowerRenderedMasonryExternalWallsLm: extByClass('Rendered Masonry', 'Ground Floor'),
    upperRenderedMasonryExternalWallsLm: extByClass('Rendered Masonry', 'Second Level'),
    thirdRenderedMasonryExternalWallsLm: extByClass('Rendered Masonry', 'Third Level'),
    totalRenderedMasonryExternalWallsLm: extByClass('Rendered Masonry'),

    totalUnclassifiedExteriorWallsLm: extByClass('Other'),

    lowerInternalWallGrossPlasterboardM2: sumRows(interiorWalls, (row) => row.floor === 'Ground Floor', 'grossPlasterboardAreaM2'),
    upperInternalWallGrossPlasterboardM2: sumRows(interiorWalls, (row) => row.floor === 'Second Level', 'grossPlasterboardAreaM2'),
    thirdInternalWallGrossPlasterboardM2: sumRows(interiorWalls, (row) => row.floor === 'Third Level', 'grossPlasterboardAreaM2'),
    totalInternalWallGrossPlasterboardM2: sumRows(interiorWalls, () => true, 'grossPlasterboardAreaM2'),

    lowerInternalWallNetPlasterboardM2: sumRows(interiorWalls, (row) => row.floor === 'Ground Floor', 'netPlasterboardAreaM2'),
    upperInternalWallNetPlasterboardM2: sumRows(interiorWalls, (row) => row.floor === 'Second Level', 'netPlasterboardAreaM2'),
    thirdInternalWallNetPlasterboardM2: sumRows(interiorWalls, (row) => row.floor === 'Third Level', 'netPlasterboardAreaM2'),
    totalInternalWallNetPlasterboardM2: sumRows(interiorWalls, () => true, 'netPlasterboardAreaM2'),

    windowOpeningsQty: sumRows(windows),
    windowOpeningsAreaM2: sumRows(windows, () => true, 'totalOpeningAreaM2'),
    doorOpeningsQty: sumRows(doors),
    doorOpeningsAreaM2: sumRows(doors, () => true, 'totalOpeningAreaM2'),

    lowerBrickSillLengthLm: sumRows(windows, (row) => row.floor === 'Ground Floor', 'brickSillLengthLm'),
    upperBrickSillLengthLm: sumRows(windows, (row) => row.floor === 'Second Level', 'brickSillLengthLm'),
    thirdBrickSillLengthLm: sumRows(windows, (row) => row.floor === 'Third Level', 'brickSillLengthLm'),
    totalBrickSillLengthLm: sumRows(windows, () => true, 'brickSillLengthLm'),

    lowerEavesLm: sumRows(eaves, (row) => row.level === 'Ground Floor', 'eavesLengthLm'),
    upperEavesLm: sumRows(eaves, (row) => row.level === 'Second Level', 'eavesLengthLm'),
    thirdEavesLm: sumRows(eaves, (row) => row.level === 'Third Level', 'eavesLengthLm'),
    totalEavesLm: sumRows(eaves, () => true, 'eavesLengthLm'),
    eavesAreaM2: sumRows(eaves, () => true, 'quantity'),

    floorFinishTilesM2: sumRows(floorFinishes, (row) => row.category === 'Tiles'),
    floorFinishCarpetsM2: sumRows(floorFinishes, (row) => row.category === 'Carpets'),
    floorFinishHybridM2: sumRows(floorFinishes, (row) => row.category === 'Hybrid'),
    floorFinishPolishedConcreteM2: sumRows(floorFinishes, (row) => row.category === 'Polished Concrete'),
    floorFinishExposedAggM2: sumRows(floorFinishes, (row) => row.category === 'exposed Agg')
  };

  const mappingPreview = Object.entries(fields).map(([destinationKey, value]) => ({
    destinationKey,
    value,
    source: 'AI Plan Takeoff schedule',
    status: value === '' || value === null || value === undefined ? 'missing' : 'ready'
  }));

  const warnings = [
    ...mappingPreview.filter((row) => row.status === 'missing').map((row) => `${row.destinationKey} is missing.`),
    ...exteriorWalls.filter((row) => row.category === 'Other').map(() => 'Some exterior walls are unclassified and are included under Other.')
  ];

  return {
    projectName: schedule.project.projectName,
    clientName: schedule.project.clientName,
    siteAddress: schedule.project.siteAddress,
    planFilename: schedule.project.planFilename,
    numberOfStoreys: schedule.project.numberOfPlanSheets,
    floorAreas: schedule.projectTotals.floorAreas,
    roomList: schedule.projectTotals.rooms,
    basicProjectMeasurements: flattenScheduleRows(schedule, 'projectTotals'),
    dataInputFields: fields,
    mappingPreview,
    warnings,
    provenance: {
      takeoffId: options.takeoffId || '',
      revision: Number(options.revision || 0),
      transferredAt: new Date().toISOString()
    }
  };
}

export function getScheduleSignature(schedule) {
  return JSON.stringify(flattenScheduleRows(schedule, 'projectTotals').map((row) => [row.itemId, row.quantity, row.unit]));
}
