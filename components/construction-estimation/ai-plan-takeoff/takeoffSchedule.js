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

function round(value, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}

function polygonAreaM2(nodes, pixelsPerMm) {
  if (!nodes || nodes.length < 3 || !pixelsPerMm) return 0;
  let areaPx = 0;
  for (let i = 0; i < nodes.length; i++) {
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
  for (let i = 1; i < run.nodes.length; i++) {
    lengthPx += Math.hypot(run.nodes[i].x - run.nodes[i - 1].x, run.nodes[i].y - run.nodes[i - 1].y);
  }
  return lengthPx / pixelsPerMm / 1000;
}

function openingAreaM2(opening) {
  return ((opening.widthMm || 0) * (opening.heightMm || 0)) / 1000000;
}

function normaliseWallType(category) {
  if (category === 'exterior') return 'External walls';
  if (category === 'interior') return 'Internal walls';
  return category || 'Custom walls';
}

function openingWallType(opening) {
  if (opening.type === 'window') return 'External walls';
  if ((opening.subType || '').toLowerCase().includes('internal')) return 'Internal walls';
  return 'External walls';
}

function makeRow(section, itemId, category, quantity, unit, extra = {}) {
  return { section, itemId, category, quantity: round(quantity), unit, ...extra };
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
  completedEaves = []
}) {
  const buildForPages = (pages) => {
    const include = (item) => pages.includes(item.page);
    const floorplans = completedFloorplans.filter(include);
    const walls = completedWallRuns.filter(include);
    const openings = placedOpenings.filter(include);
    const finishes = completedAreas.filter(include);
    const eaves = completedEaves.filter(include);

    const floorAreaRows = Object.keys(FLOOR_AREA_LABELS).map((type) => {
      const quantity = floorplans
        .filter((item) => item.type === type)
        .reduce((sum, item) => sum + polygonAreaM2(item.nodes, pixelsPerMm), 0);
      return makeRow('Floor Areas', `floor_${type}`, FLOOR_AREA_LABELS[type], quantity, 'm2');
    });

    const footprint = floorAreaRows.find((row) => row.itemId === 'floor_Footprint')?.quantity || 0;
    const garage = floorAreaRows.find((row) => row.itemId === 'floor_Garage')?.quantity || 0;
    const separatelyNamed = floorAreaRows
      .filter((row) => !['floor_Footprint', 'floor_Living'].includes(row.itemId))
      .reduce((sum, row) => sum + row.quantity, 0);
    const livingMeasured = floorAreaRows.find((row) => row.itemId === 'floor_Living')?.quantity || 0;
    const totalLiving = livingMeasured || Math.max(0, footprint - separatelyNamed);

    floorAreaRows.push(makeRow('Floor Areas', 'floor_total_living', 'Total living area', totalLiving, 'm2'));
    floorAreaRows.push(makeRow('Floor Areas', 'floor_total_under_roof', 'Total under-roof area', footprint, 'm2'));
    floorAreaRows.push(makeRow('Floor Areas', 'floor_garage_check', 'Garage', garage, 'm2'));

    const openingsByWallType = openings.reduce((acc, opening) => {
      const wallType = openingWallType(opening);
      acc[wallType] = (acc[wallType] || 0) + openingAreaM2(opening);
      return acc;
    }, {});

    const wallGroups = walls.reduce((acc, wall) => {
      const wallType = normaliseWallType(wall.category);
      const level = wall.level || `Sheet ${wall.page}`;
      const key = `${wallType}|${level}`;
      if (!acc[key]) acc[key] = { wallType, level, walls: [] };
      acc[key].walls.push(wall);
      return acc;
    }, {});

    const wallRows = Object.values(wallGroups).map((group) => {
      const lengthM = group.walls.reduce((sum, wall) => sum + runLengthM(wall, pixelsPerMm), 0);
      const wallHeightM = group.walls[0]?.heightM || group.walls[0]?.wallHeightM || DEFAULT_WALL_HEIGHT_M;
      const grossAreaM2 = lengthM * wallHeightM;
      const openingArea = openingsByWallType[group.wallType] || 0;
      return makeRow('Walls', `walls_${group.wallType}_${group.level}`, group.wallType, lengthM, 'lm', {
        level: group.level,
        wallHeightM,
        grossAreaM2: round(grossAreaM2),
        openingAreaM2: round(openingArea),
        netAreaM2: round(Math.max(0, grossAreaM2 - openingArea)),
        sectionCount: group.walls.length
      });
    });

    const wallRecords = walls.map((wall) => {
      const nodes = wall.nodes || [];
      const start = nodes[0] || null;
      const end = nodes[nodes.length - 1] || null;
      const lengthM = runLengthM(wall, pixelsPerMm);
      const wallHeightM = wall.heightM || wall.wallHeightM || DEFAULT_WALL_HEIGHT_M;
      const linkedOpenings = openings.filter((opening) => openingWallType(opening) === normaliseWallType(wall.category));
      const linkedOpeningArea = linkedOpenings.reduce((sum, opening) => sum + openingAreaM2(opening), 0);
      return {
        section: 'Wall Records',
        itemId: wall.id,
        wallType: normaliseWallType(wall.category),
        planSheet: wall.page,
        level: wall.level || `Sheet ${wall.page}`,
        start,
        end,
        lengthM: round(lengthM),
        wallHeightM,
        thicknessMm: wall.thicknessMm || 0,
        grossAreaM2: round(lengthM * wallHeightM),
        linkedOpenings: linkedOpenings.map((opening) => opening.id),
        netAreaM2: round(Math.max(0, lengthM * wallHeightM - linkedOpeningArea))
      };
    });

    const openingRows = Object.values(openings.reduce((acc, opening) => {
      const size = `${opening.widthMm || 0}x${opening.heightMm || 0}`;
      const typeLabel = `${opening.type || 'opening'} ${opening.subType || ''}`.trim();
      const key = `${typeLabel}|${size}`;
      if (!acc[key]) {
        acc[key] = makeRow('Openings', `opening_${key}`, typeLabel, 0, 'count', {
          widthMm: opening.widthMm || 0,
          heightMm: opening.heightMm || 0,
          totalOpeningAreaM2: 0
        });
      }
      acc[key].quantity += 1;
      acc[key].totalOpeningAreaM2 = round(acc[key].totalOpeningAreaM2 + openingAreaM2(opening));
      return acc;
    }, {}));

    const finishCategories = Array.from(new Set([
      ...Object.keys(FLOOR_FINISH_UNITS),
      ...finishes.map((area) => area.category).filter(Boolean)
    ]));

    const finishRows = finishCategories.map((category) => {
      const quantity = finishes
        .filter((area) => area.category === category)
        .reduce((sum, area) => {
          const exclusions = (area.exclusions || []).reduce((exclusionSum, exclusion) => exclusionSum + polygonAreaM2(exclusion.nodes, pixelsPerMm), 0);
          return sum + Math.max(0, polygonAreaM2(area.nodes, pixelsPerMm) - exclusions);
        }, 0);
      return makeRow('Floor Finishes', `finish_${category}`, category, quantity, FLOOR_FINISH_UNITS[category] || 'm2');
    });

    const eaveRows = Object.values(eaves.reduce((acc, eave) => {
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

    const roomRows = completedMeasurements.filter(include).map((measurement) => (
      makeRow('Rooms', measurement.id, 'Basic project measurement', measurement.lengthMm ? measurement.lengthMm / 1000 : 0, 'lm', {
        planSheet: measurement.page
      })
    ));

    return {
      floorAreas: floorAreaRows,
      walls: wallRows,
      wallRecords,
      openings: openingRows,
      floorFinishes: finishRows,
      roofAndEaves: eaveRows,
      rooms: roomRows,
      customTakeoffs: []
    };
  };

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
    currentSheet: { page: currentPage, ...buildForPages([currentPage]) },
    projectTotals: buildForPages(projectPages)
  };
}

export function flattenScheduleRows(schedule, scope = 'projectTotals') {
  const sectionData = schedule[scope] || {};
  return [
    ...(sectionData.floorAreas || []),
    ...(sectionData.walls || []),
    ...(sectionData.openings || []),
    ...(sectionData.roofAndEaves || []),
    ...(sectionData.floorFinishes || []),
    ...(sectionData.rooms || []),
    ...(sectionData.customTakeoffs || [])
  ];
}

export function exportRowsToCsv(rows) {
  const headers = ['section', 'itemId', 'category', 'quantity', 'unit', 'level', 'planSheet', 'grossAreaM2', 'openingAreaM2', 'netAreaM2', 'sectionCount'];
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
    Walls: schedule.projectTotals.walls,
    Openings: schedule.projectTotals.openings,
    Rooms: schedule.projectTotals.rooms,
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
      ...rows.map((row) => `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(row[header])}</Data></Cell>`).join('')}</Row>`)
    ].join('');
  };

  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${Object.entries(sheets).map(([name, rows]) => `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${objectToRows(rows)}</Table></Worksheet>`).join('')}
</Workbook>`;
}

export function createQuotePreviewRows(schedule, quoteSheetRows = [], mappings = {}) {
  const rows = flattenScheduleRows(schedule, 'projectTotals')
    .filter((row) => row.quantity !== 0)
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

export function createJobSetupPayload(schedule) {
  return {
    projectName: schedule.project.projectName,
    clientName: schedule.project.clientName,
    siteAddress: schedule.project.siteAddress,
    planFilename: schedule.project.planFilename,
    numberOfStoreys: schedule.project.numberOfPlanSheets,
    floorAreas: schedule.projectTotals.floorAreas,
    roomList: schedule.projectTotals.rooms,
    basicProjectMeasurements: flattenScheduleRows(schedule, 'projectTotals')
  };
}

export function getScheduleSignature(schedule) {
  return JSON.stringify(flattenScheduleRows(schedule, 'projectTotals').map((row) => [row.itemId, row.quantity, row.unit]));
}
