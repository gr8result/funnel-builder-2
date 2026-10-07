import { EXTERIOR_WALL_SYSTEM_FIELD_KEYS } from './takeoffMaterialQuantities.js';
import { CLADDING_PLANK_FORMULA } from './claddingPlankCalculation.js';
const input = (key, label, unit, sourceRow, section = 'Takeoff Mappings') => ({
  key, label, unit, sourceRow, section, value: '', formula: '', excelFormula: '', note: '', userNote: '',
  heading: false, calculated: false, editable: true, options: null, fill: 'FFFF00',
});

// Upsert canonical keys, never append another copy on regeneration or workbook hydration.
export function withTakeoffInputRows(sourceRows) {
  const rows = [...new Map(sourceRows.map((row) => [row.key, { ...row }])).values()];
  let mappingNumber = 600;
  let thicknessNumber = 101;
  const mappingRowNumber = () => Number(`119.${++mappingNumber}`);
  const upsert = (row, anchor) => {
    const index = rows.findIndex((item) => item.key === row.key);
    if (index >= 0) rows[index] = { ...rows[index], ...row };
    else {
      const after = rows.findIndex((item) => item.key === anchor);
      rows.splice(after < 0 ? rows.length : after + 1, 0, row);
    }
  };
  // Relocates a row that already exists (from the base Excel-derived template) to sit right
  // after another row, for cases upsert's own merge-in-place can't handle: reusing an existing
  // legacy key's identity for a differently-positioned row instead of leaving it stranded at
  // its original Excel row position while a new one is created elsewhere (which would be the
  // duplicate calculation this sheet's rows are meant to avoid).
  const moveRow = (key, afterKey) => {
    const index = rows.findIndex((item) => item.key === key);
    if (index < 0) return;
    const [row] = rows.splice(index, 1);
    const after = rows.findIndex((item) => item.key === afterKey);
    rows.splice(after < 0 ? rows.length : after + 1, 0, row);
  };
  // Patio sits with the other Floor / Slab Areas rows on each level, immediately after that
  // level's Alfresco area, matching both the section and the "<Level> <Name> area" label style
  // every sibling row on this sheet uses. It previously carried the bare label "PATIO", in a
  // section ("Floor areas") that did not match its neighbours ("Floor / Slab Areas"), and the
  // second/third rows were buried in "Takeoff Mappings" instead of sitting with their own
  // level's areas - three different symptoms of the same placement bug.
  const lowerPorch = rows.find((row) => row.key === 'lowerPorchAreaM2');
  if (lowerPorch) lowerPorch.sourceRow = 16.1;
  upsert(input('lowerPatioAreaM2', 'Ground Level Patio area', 'M2', 16, 'Floor / Slab Areas'), 'lowerAlfrescoAreaM2');
  const upperPorch = rows.find((row) => row.key === 'upperPorchAreaM2');
  if (upperPorch) upperPorch.sourceRow = 23.1;
  upsert(input('upperPatioAreaM2', 'Second level Patio area', 'M2', 23, 'Floor / Slab Areas'), 'upperAlfrescoAreaM2');
  const thirdPorch = rows.find((row) => row.key === 'thirdPorchAreaM2');
  if (thirdPorch) thirdPorch.sourceRow = 31.1;
  upsert(input('thirdPatioAreaM2', 'Third level Patio area', 'M2', 31, 'Floor / Slab Areas'), 'thirdAlfrescoAreaM2');
  // The section heading immediately after Item 60. Its old rows (a single manual LM entry per
  // level, superseded by the frame-thickness + wall-system breakdown below) are already hidden
  // from the visible Data Input Sheet; renaming the heading itself from the old "WALL LENGTHS" to
  // "WALL FRAMES" is what stops that now-empty heading looking like a gap.
  upsert({ key: 'heading_walls', section: 'WALL FRAMES', label: 'WALL FRAMES' }, null);
  let anchor = 'totalInternal70mmWallsLm';
  const levelDisplayLabels = { lower: 'Ground Floor', upper: 'Second Level', third: 'Third Level' };
  for (const [prefix, level] of [['lower', 'Ground'], ['upper', 'Second'], ['third', 'Third']]) {
    const levelLabel = levelDisplayLabels[prefix];
    for (const type of ['External', 'Internal']) for (const thickness of [70, 90]) {
      const key = `${prefix}${type}${thickness}mmWallsLm`;
      const existing = rows.find((row) => row.key === key);
      // WALL FRAMES (the visible Job Setup section, Item 60's replacement) shows exactly these
      // LEVEL+thickness aggregates for both External and Internal - the per-construction-system
      // breakdown below (Brick Veneer / Lightweight Cladding / Core-filled Blockwork / Double
      // Brick) still carries the same measured LM for framing-material and brick/cladding order
      // calculations, it is just hidden from this quick input sheet (HIDDEN_DATA_INPUT_ROW_KEYS
      // in useEstimateBuilderWorkbook.js) as the more detailed permutation view this sheet no
      // longer needs to show.
      const label = type === 'Internal'
        ? `${levelLabel} Internal Walls — ${thickness}mm frame`
        : `${levelLabel} External Wall Frames — ${thickness}mm`;
      upsert(input(key, label, 'LM', existing?.sourceRow ?? Number(`74.${thicknessNumber++}`), 'Wall frame thickness'), anchor);
      anchor = key;
      if (type === 'External' && thickness === 90) {
        // This level's own external-wall-frame total. A genuinely new key, not a reuse of
        // `${prefix}ExternalWallsLm` (the old Section 64 manual single-figure entry): that key is
        // still a live, tested Job Setup import destination in its own right (createJobSetupPayload/
        // applyJobSetupImport can write a measured value straight onto it), so repurposing it into a
        // calculated, non-editable row would silently break that import path. This new row reads
        // the identical already-computed total (estimateBuilderWorkbookCalculations.js aliases its
        // existing lower/upper/thirdExt variable onto this key - no second computation) without
        // touching the old key's own behaviour at all.
        const totalKey = `${prefix}ExteriorWallFramesLm`;
        upsert(input(totalKey, `${levelLabel} Total Exterior Wall Frames`, 'LM', Number(`74.${thicknessNumber++}`), 'Wall frame thickness'), anchor);
        upsert({ key: totalKey, formula: `${prefix}External70mmWallsLm + ${prefix}External90mmWallsLm`, note: 'FORMULAR', calculated: true, editable: false, fill: '00B0F0' }, null);
        anchor = totalKey;
        // The visible wall-length breakdown: LEVEL + CONSTRUCTION SYSTEM + FRAME THICKNESS (Phase
        // 2B). Inserted here, right after the now-hidden External aggregate rows and right before
        // Internal Framed Wall, so every canonical exterior system for this level reads as one
        // block. Core-filled Blockwork and Double Brick have no frame variant (masonry, not
        // timber-framed) and get a single LM row each; Custom keeps a single row regardless of its
        // own frame thickness since it is a review/catch-all bucket, not a framing calculation
        // input.
        for (const [wallSystemKey, wallSystemLabel] of [
          ['BrickVeneer70mmWallsLm', '230mm Brick Veneer — 70mm frame'],
          ['BrickVeneer90mmWallsLm', '250mm Brick Veneer — 90mm frame'],
          ['LightweightCladding70mmWallsLm', 'Lightweight Cladding — 70mm frame'],
          ['LightweightCladding90mmWallsLm', 'Lightweight Cladding — 90mm frame'],
          ['CoreFilledBlockworkLm', '200mm Core-filled Blockwork'],
          ['DoubleBrickLm', '230mm Double Brick'],
          ['CustomExternalLm', 'Custom exterior construction (review)'],
          ['UnclassifiedExternalLm', 'Unclassified exterior construction (review required)'],
        ]) {
          const rowKey = `${prefix}${wallSystemKey}`;
          const existingWallSystemRow = rows.find((row) => row.key === rowKey);
          upsert(input(rowKey, `${levelLabel} ${wallSystemLabel}`, 'LM', existingWallSystemRow?.sourceRow ?? Number(`74.${thicknessNumber++}`), 'Wall frame thickness'), anchor);
          anchor = rowKey;
        }
      }
    }
    // Internal construction systems outside the standard 70mm/90mm timber-framed buckets: a
    // custom internal wall (needs review) or one with no classification evidence at all.
    for (const [wallSystemKey, wallSystemLabel] of [
      ['CustomInternalLm', 'Internal Framed Wall — Custom construction (review)'],
      ['UnclassifiedInternalLm', 'Internal Framed Wall — Unclassified (review required)'],
    ]) {
      const rowKey = `${prefix}${wallSystemKey}`;
      const existingWallSystemRow = rows.find((row) => row.key === rowKey);
      upsert(input(rowKey, `${levelLabel} ${wallSystemLabel}`, 'LM', existingWallSystemRow?.sourceRow ?? Number(`74.${thicknessNumber++}`), 'Wall frame thickness'), anchor);
      anchor = rowKey;
    }
    for (const [suffix, unit] of [['CavitySlider90mmWallsLm', 'LM'], ['CavitySlider90mmStudsEach', 'EACH'], ['CavitySliderCagesEach', 'EACH'], ['PostColumnsEach', 'EACH'], ['WindowOpeningsAreaM2', 'M2'], ['DoorOpeningsAreaM2', 'M2'], ['ExternalOpeningAreaM2', 'M2']]) {
      upsert(input(`${prefix}${suffix}`, `${level} ${suffix.replace(/([A-Z])/g, ' $1').trim()}`, unit, mappingRowNumber()), 'heading_takeoff_mappings');
    }
    for (const system of Object.keys(EXTERIOR_WALL_SYSTEM_FIELD_KEYS)) {
      for (const suffix of ['GrossWallM2', 'OpeningM2', 'NetWallM2']) {
        const key = `${prefix}${system}${suffix}`;
        upsert(input(key, `${level} ${system.replace(/([A-Z])/g, ' $1').trim()} ${suffix.replace(/([A-Z])/g, ' $1').trim()}`, 'M2', mappingRowNumber()), 'heading_takeoff_mappings');
      }
      // A construction class with no length destination would be dropped on import without a trace.
      // Only create what the sheet is missing: the classes it already ships keep their own labels.
      for (const key of [`${prefix}${system}ExternalWallsLm`, `total${system}ExternalWallsLm`]) {
        if (rows.some((row) => row.key === key)) continue;
        const scope = key.startsWith('total') ? 'Total' : level;
        upsert(input(key, `${scope} ${system.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} external walls`, 'LM', mappingRowNumber()), 'heading_takeoff_mappings');
      }
    }
  }
  // TOTAL WALL FRAMES: closes the Wall Frames section (Item 60 -> WALL FRAMES -> Ground/Second/
  // Third Wall Frames rows -> this). heading_totals_2 and these five totals are the same rows the
  // old "TOTAL WALL LENGTHS" heading introduced (Excel rows 72-74.1) - reused, not duplicated, just
  // relabelled and moved from their original position (immediately after Item 60, before any level
  // had been measured) to after all three levels' Wall Frames rows, matching where a total belongs.
  // totalExternalWallsLm's existing formula ("lowerExternalWallsLm + upperExternalWallsLm +
  // thirdExternalWallsLm") already sums the right per-level total for each level - it only read as
  // stale while those three keys were still the old manual entry; now that they are this level's
  // own calculated Total Exterior Wall Frames, the same formula is correct again with no change.
  // totalInternalWallsLm (all-thickness internal total) has no row in the required TOTAL WALL
  // FRAMES list, so it is left exactly where it already was: hidden, unused.
  moveRow('heading_totals_2', 'thirdInternal90mmWallsLm');
  upsert({ key: 'heading_totals_2', section: 'TOTAL WALL FRAMES', label: 'TOTAL WALL FRAMES' }, null);
  let totalsAnchor = 'heading_totals_2';
  for (const key of ['totalExternal70mmWallsLm', 'totalExternal90mmWallsLm', 'totalExternalWallsLm', 'totalInternal70mmWallsLm', 'totalInternal90mmWallsLm']) {
    moveRow(key, totalsAnchor);
    totalsAnchor = key;
  }
  upsert({ key: 'totalExternal70mmWallsLm', label: 'Total External Wall Frames — 70mm' }, null);
  upsert({ key: 'totalExternal90mmWallsLm', label: 'Total External Wall Frames — 90mm' }, null);
  upsert({ key: 'totalExternalWallsLm', label: 'Total Exterior Wall Frames' }, null);
  upsert({ key: 'totalInternal70mmWallsLm', label: 'Total Internal Walls — 70mm frame' }, null);
  upsert({ key: 'totalInternal90mmWallsLm', label: 'Total Internal Walls — 90mm frame' }, null);
  // WALL AREAS BY SYSTEM: measured external wall area (LM x this level's own wall height, already
  // computed in takeoffMaterialFields - not a second computation here) split by construction
  // system, so downstream Quote/BOQ trades (cladding, brickwork, render, paint) can each read the
  // area that is actually theirs instead of one undifferentiated "external wall area" figure. Every
  // one of these keys already exists (Phase 2A's Gross/Net wall-area-by-system fields) and already
  // carries the right measured value; only their position/section/label move, from Takeoff Mappings
  // (hidden) onto this quick-input sheet, in the same place Item 78-80's own gross wall area total
  // sits. Gross AND Net are both kept visible (not just one) so a downstream net calculation is
  // never left guessing which figure - Gross before openings, Net after - a row actually means.
  let wallAreaAnchor = 'totalExternalWallAreaM2';
  upsert({ key: 'heading_wall_areas_by_system', sourceRow: 80.1, section: 'WALL AREAS BY SYSTEM', label: 'WALL AREAS BY SYSTEM', heading: true, calculated: false, editable: false, unit: '', value: '', formula: '', excelFormula: '', note: '', userNote: '', options: null, fill: '' }, wallAreaAnchor);
  wallAreaAnchor = 'heading_wall_areas_by_system';
  for (const [prefix, level] of [['lower', 'Ground Floor'], ['upper', 'Second Level'], ['third', 'Third Level']]) {
    for (const [system, systemLabel] of [['BrickVeneer', 'Brick Veneer'], ['LightweightCladding', 'Lightweight Cladding'], ['RenderedBrickVeneer', 'Rendered Brick Veneer']]) {
      for (const [suffix, variant] of [['GrossWallM2', 'Gross'], ['NetWallM2', 'Net']]) {
        const key = `${prefix}${system}${suffix}`;
        moveRow(key, wallAreaAnchor);
        upsert({ key, section: 'Wall areas by system', label: `${level} — ${systemLabel} Wall Area M² (${variant})` }, null);
        wallAreaAnchor = key;
      }
    }
  }
  // Cross-level canonical construction-system totals (Phase 2B). Populated the same way the
  // legacy total${system}ExternalWallsLm rows above are: written directly from the full set of
  // measured walls at import time (addTotal in createJobSetupPayload), not summed via a sheet
  // formula from the per-level rows - matching the existing total*ExternalWallsLm / total
  // UnclassifiedExteriorWallsLm convention already on this sheet.
  for (const [key, label] of [
    ['totalBrickVeneer70mmWallsLm', 'Total 230mm Brick Veneer — 70mm frame'],
    ['totalBrickVeneer90mmWallsLm', 'Total 250mm Brick Veneer — 90mm frame'],
    ['totalLightweightCladding70mmWallsLm', 'Total Lightweight Cladding — 70mm frame'],
    ['totalLightweightCladding90mmWallsLm', 'Total Lightweight Cladding — 90mm frame'],
    ['totalCoreFilledBlockworkLm', 'Total 200mm Core-filled Blockwork'],
    ['totalDoubleBrickLm', 'Total 230mm Double Brick'],
    ['totalCustomExternalLm', 'Total custom exterior construction (review)'],
    ['totalCustomInternalLm', 'Total custom internal construction (review)'],
    ['totalUnclassifiedInternalLm', 'Total unclassified internal walls (review required)'],
    ['totalPostColumnsEach', 'Total posts / columns'],
    ['totalUnclassifiedPostColumnsEach', 'Total unclassified posts / columns (review required)'],
    ['totalPostColumnFaceBrickNetM2', 'Total post/column brick surround area — face finish (derived)'],
    ['totalPostColumnRenderedBrickNetM2', 'Total post/column brick surround area — rendered finish (derived)'],
    ['totalPostColumnFaceBrickOrderEach', 'Total post/column face brick order quantity (derived)'],
    ['totalPostColumnRenderedBrickOrderEach', 'Total post/column rendered brick order quantity (derived)'],
  ]) {
    upsert(input(key, label, 'LM', mappingRowNumber()), 'heading_takeoff_mappings');
  }
  upsert(input('brickVeneerSillsLm', 'Brick veneer sills (wall-linked)', 'LM', mappingRowNumber()), 'heading_takeoff_mappings');
  upsert(input('jamb90x19StockLengthsEach', '90 x 19 door jamb — 5.4m stock lengths', 'EACH', 119.01, 'Linings / Trim'), 'internalDoors');
  upsert(input('jamb110x19StockLengthsEach', '110 x 19 door jamb — 5.4m stock lengths (90mm framed internal doors)', 'EACH', 119.02, 'Linings / Trim'), 'jamb90x19StockLengthsEach');
  // Same key, same measured quantity (one cage per cavity sliding door, from associateTakeoffMeasurements
  // forcing every cavity-slider host wall to 90mm) - moved out of the generic cross-level-totals loop
  // above (which hard-codes unit 'LM' for every row in it) into its own explicit row here, right after
  // the door jambs it is framed alongside, with the correct unit and a label that says what it is
  // without needing the "(one per cavity sliding door)" aside the generic Takeoff Mappings label carried.
  upsert(input('totalCavitySliderCagesEach', '90mm Cavity Slider Cages', 'EACH', 119.03, 'Linings / Trim'), 'jamb110x19StockLengthsEach');
  // The one generic cladding-plank calculation (claddingPlankCalculation.js), shown once on the
  // Calculations page and evaluated per product against the job's Takeoff. Not in
  // V4_DEFAULT_FORMULAS, so this formula text is never evaluated as a second calculation.
  upsert({ key: 'claddingPlankQty', sourceRow: 119.1, section: 'Cladding', label: 'JH LINEA BOARD — PLANK QUANTITY', unit: 'EACH', value: '', formula: CLADDING_PLANK_FORMULA, excelFormula: '', note: '', userNote: '', heading: false, calculated: true, editable: false, options: null, fill: '00B0F0' }, null);
  for (const row of rows) {
    if (/WallPlatesNoggins90mmInternalLm$/.test(row.key)) row.formula = row.formula.replace('* 4', '* 3');
    if (/^(lower|upper|third)WindowDoorDeductionsM2$/.test(row.key)) row.label = `${({ lower: 'Ground', upper: 'Second', third: 'Third' })[row.key.match(/^(lower|upper|third)/)[0]]} external window / door openings`;
  }
  return rows;
}

// Older workbooks can contain saved copies of canonical template rows in customRows.
// Move their values into the keyed row store once; keep all unrelated custom inputs.
export function normalizeTakeoffInputSection(section, definitions) {
  const canonical = new Map(definitions.map((row) => [row.key, row]));
  const mappingDefinitions = definitions.filter((row) => /takeoff mappings/i.test(row.sectionLabel || row.section || '') || row.key === 'heading_takeoff_mappings');
  const rows = { ...(section.rows || {}) };
  const customRows = [];
  for (const custom of section.customRows || []) {
    const definition = canonical.get(custom.key) || mappingDefinitions.find((row) => row.label === custom.label && String(row.sourceRow) === String(custom.sourceRow));
    if (!definition) { customRows.push(custom); continue; }
    const saved = rows[custom.key] || custom;
    if ((rows[definition.key]?.value ?? '') === '' && (saved.value ?? '') !== '') rows[definition.key] = { ...saved };
    if (custom.key !== definition.key) delete rows[custom.key];
  }
  return { ...section, rows, customRows };
}
