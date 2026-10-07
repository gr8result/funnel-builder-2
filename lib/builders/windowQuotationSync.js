// Bridges the canonical AI Plan Takeoff Window Schedule (createJobSetupWindowSchedule -
// takeoffSchedule.js) into the Quotation Builder's WINDOWS section, following the exact
// import/match/unmatched/write-to-quotation pattern already proven by
// entryDoorFurnitureSelection.js's importedExteriorEntryDoors/resolveExteriorEntryDoors. This is
// the ONLY place windows/doors get matched against the window/door/screen catalogue - the
// calculation engine (estimateBuilderWorkbookCalculations.js) never re-derives a window quantity
// itself, it only reads whatever rows this module writes, the same way it reads any other
// quotation row.
import { createJobSetupWindowSchedule } from '../../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { windowCodeForOpening } from '../construction-estimation/takeoffMaterialQuantities.js';
import {
  loadTemplateWindowDoorScreenCatalogue,
  applyWindowCatalogueOverrides,
  OPENING_STYLE_TO_CATALOGUE_PRODUCT_TYPE,
} from '../construction-estimation/catalogues/windowDoorScreenCatalogue.js';

export const WINDOWS_QUOTATION_SUBSECTIONS = Object.freeze({
  'Sliding Window': 'WINDOWS - SLIDING',
  'Double Hung': 'WINDOWS - DOUBLE HUNG',
  Awning: 'WINDOWS - AWNING',
  Louvre: 'WINDOWS - LOUVRE',
  'Fixed Glass': 'WINDOWS - FIXED GLASS',
  Casement: 'WINDOWS - CASEMENT',
});
export const GLASS_SLIDING_DOORS_SECTION = 'GLASS SLIDING DOORS';
export const FLYSCREENS_SECTION = 'FLYSCREENS';
export const SECURITY_SCREENS_SECTION = 'SECURITY SCREENS';
export const WINDOWS_PARENT_SECTION = 'WINDOWS';
export const WINDOW_SYNC_ROW_SOURCE = 'ai-plan-takeoff-window-schedule';

// Display order of synced rows inside Section 53 WINDOWS: each window type, then glass sliding
// doors, then the separate flyscreen and security screen products.
const WINDOW_GROUP_ORDER = [...Object.values(WINDOWS_QUOTATION_SUBSECTIONS), GLASS_SLIDING_DOORS_SECTION, FLYSCREENS_SECTION, SECURITY_SCREENS_SECTION];
const WINDOW_GROUP_SECTION_NAMES = new Set(WINDOW_GROUP_ORDER.map((name) => name.toLowerCase()));

function quoteSectionBaseName(sectionName) {
  return String(sectionName || '').replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
}

// The active catalogue: template rows with any saved builder/supplier overrides merged in by
// code (see applyWindowCatalogueOverrides in windowDoorScreenCatalogue.js). Supplier overrides are
// expected at workbook.data.windowCatalogueOverrides (a plain {windows,flyscreens,securityScreens}
// object of the SAME row shape the template produces) - absent for every job today, so this is a
// no-op merge until a builder actually uploads a supplier CSV.
export function activeWindowDoorScreenCatalogue(workbook = {}) {
  const template = loadTemplateWindowDoorScreenCatalogue();
  const overrides = workbook?.data?.windowCatalogueOverrides;
  if (!overrides) return template;
  return applyWindowCatalogueOverrides(template, overrides);
}

// One canonical opening -> one style key: the takeoff's own openingStyle (windows) or doorStyle
// (doors), the exact live subType-derived label - never a value this module invents.
function openingStyleKey(row) {
  return row.openingType === 'Window' ? row.openingStyle : row.doorStyle;
}

// A window/door only enters this module's world when its style resolves to a catalogue product
// type the WINDOWS/GLASS SLIDING DOORS sections cover. Anything else (internal doors, garage
// doors, entry doors already handled by entryDoorFurnitureSelection.js) is left alone - this is
// additive, not a replacement for those existing flows.
function isInScopeRow(row) {
  return Boolean(OPENING_STYLE_TO_CATALOGUE_PRODUCT_TYPE[openingStyleKey(row)]);
}

// Groups physically distinct openings into one quotation line ONLY when their product identity
// (style) AND dimensions are identical - two 1200x1800 sliding windows aggregate to qty 2; a
// 1200x1800 sliding window and a 1200x1800 fixed window never merge, even though their size matches.
function aggregationKey(row) {
  return `${openingStyleKey(row)}::${row.heightMm}x${row.widthMm}`;
}

function findCatalogueMatch(row, catalogue) {
  const target = OPENING_STYLE_TO_CATALOGUE_PRODUCT_TYPE[openingStyleKey(row)];
  if (!target) return null;
  const pool = target.category === 'Glass Door' ? catalogue.windows.filter((p) => p.category === 'Glass Door') : catalogue.windows;
  // Tier 1: exact catalogue code, only ever true if a prior manual/import mapping already stamped
  // the takeoff opening with the supplier's own code (row.catalogueCode) - the takeoff's own
  // windowCode uses a different, height-first digit convention and is never itself a catalogue code.
  if (row.catalogueCode) {
    const exact = pool.find((p) => p.code === row.catalogueCode);
    if (exact) return exact;
  }
  // Tier 2: product type + exact height + exact width - the primary, deterministic tier.
  const sized = pool.find((p) => p.productType === target.productType && p.heightMm === row.heightMm && p.widthMm === row.widthMm);
  if (sized) return sized;
  return null;
}

function findScreenMatch(windowCatalogueCode, screenPool) {
  return screenPool.find((p) => p.windowCode === windowCatalogueCode) || null;
}

// Reads the canonical Window Schedule (createJobSetupWindowSchedule) straight from the same
// takeoff job inputs Job Setup/Client Selections already use - never a second measurement or a
// second wall/opening geometry pass.
export function importedTakeoffWindowsAndDoors(takeoffJobInputs) {
  const schedule = createJobSetupWindowSchedule(takeoffJobInputs);
  return (schedule.rows || []).filter(isInScopeRow);
}

// The full sync: takeoff rows -> aggregated groups -> catalogue-matched quotation line items,
// separated into the window-type subsections, GLASS SLIDING DOORS, and (only where the takeoff
// opening itself says so) FLYSCREENS/SECURITY SCREENS. Anything that cannot be matched by size
// comes back in `unmatched` rather than being guessed - the caller decides how to surface that
// ("Catalogue Match Required").
export function syncWindowsFromTakeoff(takeoffJobInputs, workbook = {}) {
  const catalogue = activeWindowDoorScreenCatalogue(workbook);
  const rows = importedTakeoffWindowsAndDoors(takeoffJobInputs);
  const groups = new Map();
  rows.forEach((row) => {
    const key = aggregationKey(row);
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += Number(row.quantity) || 0;
      existing.sourceOpeningIds.push(row.itemId);
      existing.flyscreenRequiredCount += row.flyscreenRequired ? (Number(row.quantity) || 0) : 0;
      existing.securityScreenRequiredCount += row.securityScreenRequired ? (Number(row.quantity) || 0) : 0;
    } else {
      groups.set(key, {
        openingStyle: openingStyleKey(row),
        openingType: row.openingType,
        heightMm: row.heightMm,
        widthMm: row.widthMm,
        quantity: Number(row.quantity) || 0,
        sourceOpeningIds: [row.itemId],
        flyscreenRequiredCount: row.flyscreenRequired ? (Number(row.quantity) || 0) : 0,
        securityScreenRequiredCount: row.securityScreenRequired ? (Number(row.quantity) || 0) : 0,
      });
    }
  });

  const matched = [];
  const unmatched = [];
  groups.forEach((group) => {
    const target = OPENING_STYLE_TO_CATALOGUE_PRODUCT_TYPE[group.openingStyle];
    const product = findCatalogueMatch({ openingType: group.openingType, openingStyle: group.openingType === 'Window' ? group.openingStyle : '', doorStyle: group.openingType !== 'Window' ? group.openingStyle : '', heightMm: group.heightMm, widthMm: group.widthMm }, catalogue);
    const sectionName = target?.category === 'Glass Door' ? GLASS_SLIDING_DOORS_SECTION : (WINDOWS_QUOTATION_SUBSECTIONS[target?.productType] || null);
    if (!product || !sectionName) {
      unmatched.push({ ...group, reason: !target ? 'unsupported-opening-style' : 'no-size-match' });
      return;
    }
    matched.push({ group, product, sectionName });
    if (group.flyscreenRequiredCount > 0) {
      const flyscreen = findScreenMatch(product.code, catalogue.flyscreens);
      if (flyscreen) matched.push({ group: { ...group, quantity: group.flyscreenRequiredCount }, product: flyscreen, sectionName: FLYSCREENS_SECTION });
      else unmatched.push({ ...group, quantity: group.flyscreenRequiredCount, reason: 'no-flyscreen-match', forProductCode: product.code });
    }
    if (group.securityScreenRequiredCount > 0) {
      const securityScreen = findScreenMatch(product.code, catalogue.securityScreens);
      if (securityScreen) matched.push({ group: { ...group, quantity: group.securityScreenRequiredCount }, product: securityScreen, sectionName: SECURITY_SCREENS_SECTION });
      else unmatched.push({ ...group, quantity: group.securityScreenRequiredCount, reason: 'no-security-screen-match', forProductCode: product.code });
    }
  });

  return { matched, unmatched };
}

// Turns one matched {group, product, sectionName} into the exact field shape
// isPhysicalProductQuoteRow (EstimateBuilderWorkbook.js) already recognises - modelled directly on
// connectEntryDoorFurnitureSchedules' row shape in entryDoorFurnitureSelection.js, so these rows
// render with the same image/brand/supplier/SKU columns any other physical-product quote row gets,
// with no new rendering rules needed.
export function windowQuotationRow({ group, product, sectionName }, parentSectionName = WINDOWS_PARENT_SECTION) {
  const stableId = `quote-window-${product.code}-${group.heightMm}x${group.widthMm}`;
  const rate = Number(product.price) || 0;
  // The takeoff's own height-first size code (1200H x 1800W -> "1218"), then product type and size,
  // e.g. "1218 Sliding Window - 1200H x 1800W".
  const sizeCode = windowCodeForOpening({ openingClass: 'Window', heightMm: group.heightMm, widthMm: group.widthMm });
  const sizeDescription = product.sizeDescription || `${group.heightMm}H x ${group.widthMm}W`;
  return {
    id: stableId,
    // Rows live directly in Section 53 WINDOWS; windowGroup keeps the window type / glass sliding
    // door / flyscreen / security screen grouping for ordering.
    section: parentSectionName,
    windowGroup: sectionName,
    item: `${[sizeCode, product.productType].filter(Boolean).join(' ')} - ${sizeDescription}`,
    // Shown in Section 53's Description column: window code, type, height and width.
    productDescription: [
      sizeCode ? `Window code ${sizeCode}` : '',
      product.windowCode ? `For ${product.windowCode}` : '',
      product.productType,
      `H ${group.heightMm} mm x W ${group.widthMm} mm`,
    ].filter(Boolean).join(' · '),
    productCode: product.code,
    productName: product.productType,
    brand: product.brand,
    supplier: product.supplier,
    sku: product.code,
    unit: product.unit || 'EACH',
    quantity: String(group.quantity),
    // Deliberately NO quantityKey: normalizedQuoteQuantityKey() (estimateBuilderWorkbookCalculations.js)
    // treats ANY truthy quantityKey as a "linked" row and overwrites its displayed quantity from
    // quantities[quantityKey] - a key this module never registers there would silently resolve to
    // 0 and zero out the real takeoff-sourced quantity set above. This row's quantity/rate are the
    // resolved values themselves (matching entryDoorFurnitureSelection.js's row shape), read as-is.
    quantityKey: '',
    manualRate: '',
    excelRate: rate ? `$${rate.toFixed(2)}` : '',
    sourceOfRate: rate ? 'catalogue' : '',
    priceStatus: product.priceStatus,
    priceBasis: product.priceBasis,
    source: WINDOW_SYNC_ROW_SOURCE,
    sourceOpeningIds: group.sourceOpeningIds,
    active: true,
    notes: product.priceStatus || '',
  };
}

// The job's existing Section 53 WINDOWS quote section key (e.g. "WINDOWS (46)" in an imported
// workbook), or plain "WINDOWS" when the job has none yet.
export function windowsParentSectionName(quotation = {}) {
  return Object.keys(quotation || {}).find((name) => quoteSectionBaseName(name) === 'windows') || WINDOWS_PARENT_SECTION;
}

function windowGroupRank(row) {
  const index = WINDOW_GROUP_ORDER.indexOf(row.windowGroup || row.section);
  return index < 0 ? WINDOW_GROUP_ORDER.length : index;
}

// Section 53 lists: every window type under one WINDOW SCHEDULE heading, then GLASS SLIDING DOORS,
// FLYSCREENS and SECURITY SCREENS each under their own heading.
function windowListHeading(row) {
  const group = row.windowGroup || row.section;
  if (group === GLASS_SLIDING_DOORS_SECTION || group === FLYSCREENS_SECTION || group === SECURITY_SCREENS_SECTION) return group;
  return 'WINDOW SCHEDULE';
}

// A plain description-only row (no qty/rate/product fields), so it renders as the same full-width
// heading bar Section 53's existing "ITEM" row uses and never adds cost.
function windowListHeadingRow(heading, parentSectionName) {
  return {
    id: `quote-window-heading-${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    section: parentSectionName,
    item: heading,
    quantity: '',
    quantityKey: '',
    unit: '',
    manualRate: '',
    excelRate: '',
    source: WINDOW_SYNC_ROW_SOURCE,
    windowSyncHeading: true,
    active: true,
  };
}

function withWindowListHeadings(rows, parentSectionName) {
  const result = [];
  let current = null;
  rows.forEach((row) => {
    const heading = windowListHeading(row);
    if (heading !== current) {
      result.push(windowListHeadingRow(heading, parentSectionName));
      current = heading;
    }
    result.push(row);
  });
  return result;
}

// Writes a sync result into Section 53 WINDOWS itself, matched by the row's own stable id
// (windowQuotationRow's id is deterministic per product+size, never per-sync-run) so re-running
// this after a takeoff change UPDATES the existing row's quantity/rate in place instead of adding a
// duplicate - the same "match by id, replace in place" rule entryDoorFurnitureSelection.js uses.
// A row the estimator manually edited (row.quantityManualOverride === true) is left exactly as they
// left it. Rows an earlier version of this sync wrote into separate WINDOWS - <TYPE> / GLASS SLIDING
// DOORS / FLYSCREENS / SECURITY SCREENS sections are moved into Section 53 and those now-empty
// sections removed.
export function applyWindowQuotationSync(workbook, syncResult) {
  const quotation = { ...(workbook.quotation || {}) };
  const parentName = windowsParentSectionName(quotation);
  const parentSection = quotation[parentName] || { rows: [] };
  const newRows = syncResult.matched.map((entry) => windowQuotationRow(entry, parentName));
  const newRowIds = new Set(newRows.map((row) => row.id));

  const legacySyncedRows = [];
  Object.keys(quotation).forEach((sectionName) => {
    if (!WINDOW_GROUP_SECTION_NAMES.has(quoteSectionBaseName(sectionName))) return;
    const rows = quotation[sectionName]?.rows || [];
    const remaining = rows.filter((row) => row.source !== WINDOW_SYNC_ROW_SOURCE);
    rows.filter((row) => row.source === WINDOW_SYNC_ROW_SOURCE)
      .forEach((row) => legacySyncedRows.push({ ...row, section: parentName, windowGroup: row.windowGroup || sectionName }));
    if (remaining.length === rows.length) return;
    if (remaining.length) quotation[sectionName] = { ...quotation[sectionName], rows: remaining };
    else delete quotation[sectionName];
  });

  const existingRows = [...(parentSection.rows || []), ...legacySyncedRows];
  const otherRows = existingRows.filter((row) => row.source !== WINDOW_SYNC_ROW_SOURCE);
  // Keep previously-synced rows this sync isn't about to replace (products no longer in this sync
  // pass) plus every manually-overridden row even if this sync WOULD replace it - the estimator's
  // own edit wins.
  const preservedSynced = existingRows.filter((row) => row.source === WINDOW_SYNC_ROW_SOURCE && !row.windowSyncHeading && (!newRowIds.has(row.id) || row.quantityManualOverride === true));
  const preservedIds = new Set(preservedSynced.map((row) => row.id));
  const syncedRows = [...preservedSynced, ...newRows.filter((row) => !preservedIds.has(row.id))]
    .filter((row, index, rows) => rows.findIndex((other) => other.id === row.id) === index)
    .map((row, index) => ({ row, index }))
    .sort((a, b) => windowGroupRank(a.row) - windowGroupRank(b.row) || a.index - b.index)
    .map(({ row }) => row);
  quotation[parentName] = { ...parentSection, collapsed: false, rows: [...otherRows, ...withWindowListHeadings(syncedRows, parentName)] };
  return { ...workbook, quotation };
}

// One entry point: takeoff job inputs + workbook in, updated workbook out. unmatched items are
// returned alongside for the caller to surface as "Catalogue Match Required".
export function syncWindowQuotationFromTakeoff(takeoffJobInputs, workbook) {
  const result = syncWindowsFromTakeoff(takeoffJobInputs, workbook);
  return { workbook: applyWindowQuotationSync(workbook, result), unmatched: result.unmatched, matchedCount: result.matched.length };
}
