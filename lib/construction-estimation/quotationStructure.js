import { UNDERSLAB_PROGRESS_DEFAULT } from "./progressAllocation.js";

const REQUIRED_QUOTATION_SECTIONS = [
  "PLUMBING",
  "PLUMBING FIXTURES & HOT WATER",
  "AIR CONDITIONING",
  "SHOWER SCREENS, MIRRORS & SLIDING DOORS",
  "STAIRS & BALUSTRADES",
  "TILING",
  "FLOORCOVERINGS",
  "CABINETRY",
  "ENTRY DOORS",
  "FIX OUT",
  "ELECTRICAL",
  "APPLIANCES & WHITE GOODS",
];

const sectionBase = (name) => String(name || "").replace(/\s*\(\d+\)\s*$/, "").trim();
export const sectionSlug = (name) => sectionBase(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Fixture, tapware and hot water categories; installation labour stays in PLUMBING.
const PLUMBING_FIXTURE_CATEGORIES = /^(kitchen sinks|kitchen taps|vanity basins|wall mixers|bath spouts|toilets|baths|spa baths|laundry tubs|laundry taps|washing machine taps|projix|lucerne|singulier|filtered water taps|insinkerators|hot water)$/;
const HEADING_LABELS = [
  [/^pivot doors?$/i, "PIVOT DOORS"], [/^laundry.*door/i, "LAUNDRY DOORS"], [/^side ?lights?$/i, "SIDELIGHTS"], [/^door furniture$/i, "DOOR FURNITURE"],
  [/^garage doors? - sectional/i, "SECTIONAL DOORS"], [/^garage doors? - (manual )?roll/i, "ROLLER DOORS"],
];

export function canonicalQuotationSectionName(name = "") {
  const base = sectionBase(name);
  const text = base.toLowerCase().replace(/\s+/g, " ");
  if (/stage labour/.test(text)) return String(name || "").trim();
  // Structural floor framing / subfloor trades are not finished floor coverings.
  if (/^(ground|upper|second|third)( level)? timber flooring$|^flooring$/.test(text)) return String(name || "").trim();
  if (text === "plumbing") return "PLUMBING";
  if (/door jamb/.test(text)) return "FIX OUT";
  // Door trades that belong inside their main section as subheadings.
  if (/^pivot doors?$|^laundry.*door|^side ?lights?$|^door furniture$/.test(text)) return "ENTRY DOORS";
  if (/^garage doors?\b/.test(text)) return "GARAGE DOORS";
  if (PLUMBING_FIXTURE_CATEGORIES.test(text)) return "PLUMBING FIXTURES & HOT WATER";
  if (/^(softline|grange)\b|sliding doors?|linen.*slid/.test(text)) return "SHOWER SCREENS, MIRRORS & SLIDING DOORS";
  if (/shower screen|\bmirror\b|\bmirrors\b|wardrobe.*slid|robe.*door|linen.*door/.test(text)) return "SHOWER SCREENS, MIRRORS & SLIDING DOORS";
  if (/^plumbing\s*$/.test(text)) return "PLUMBING";
  if (/plumbing.*(fixture|fit off.*client selection|fitting|tapwear|tapware|hot water|floor waste|drain)|^showers?$/.test(text)) return "PLUMBING FIXTURES & HOT WATER";
  if (/air condition|\bhvac\b/.test(text)) return "AIR CONDITIONING";
  if (/\b(electrical|electrician)\b/.test(text)) return "ELECTRICAL";
  if (/\b(stair|stairs|balustrade|balustrades)\b/.test(text)) return "STAIRS & BALUSTRADES";
  if (/\b(tile|tiles|tiling)\b/.test(text)) return "TILING";
  if (/floor ?cover|flooring|carpet/.test(text)) return "FLOORCOVERINGS";
  if (/cabinet|benchtop|bench top|wardrobe fit.?out/.test(text)) return "CABINETRY";
  if (/appliance|white ?goods|whitegoods/.test(text)) return "APPLIANCES & WHITE GOODS";
  if (/entry door furniture|entry doors?|double entry doors?/.test(text) || text === "doors") return "ENTRY DOORS";
  if (/fix.?out|jamb/.test(text)) return "FIX OUT";
  return String(name || "").trim();
}

export function quotationSubheadingRow(sectionName, id, label, sourceSectionName = "") {
  return {
    id,
    item: label,
    section: sectionName,
    lineType: "Heading",
    quotationSubgroupHeadingLevel: 1,
    sourceSectionName,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit: "",
    excelRate: "",
    manualRate: "",
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    formulas: {},
    values: [label, "", "", "", "", "", ""],
    active: false,
    cost: 0,
  };
}

function sourceHeading(name) {
  const base = sectionBase(name);
  const tilingRoom = base.match(/^TILING\s*-\s*(.+)$/i);
  if (tilingRoom) return tilingRoom[1].trim().toUpperCase();
  const applianceBrand = base.match(/^APPLIANCES\s*&\s*WHITE GOODS\s*-\s*(.+)$/i);
  if (applianceBrand) return applianceBrand[1].trim().toUpperCase();
  if (/\s*-\s*CLIENT SELECTIONS$/i.test(base)) return "CLIENT SELECTIONS";
  const labelled = HEADING_LABELS.find(([pattern]) => pattern.test(base));
  if (labelled) return labelled[1];
  return base.toUpperCase();
}

function sectionMetadata(section = {}) {
  const { rows, ...metadata } = section;
  return metadata;
}

export function normalizeQuotationStructure(quotation = {}, { migrateDerivedRows = true } = {}) {
  if (!quotation || typeof quotation !== "object" || Array.isArray(quotation)) return quotation;
  const result = {};
  const headingIds = new Set();
  const usedRowIdsBySection = new Map();
  const uniqueRows = (rows, sourceName, targetName) => {
    const usedRowIds = usedRowIdsBySection.get(targetName) || new Set();
    usedRowIdsBySection.set(targetName, usedRowIds);
    return rows.map((row) => {
    const id = String(row?.id || "");
    if (!id) return row;
    if (!usedRowIds.has(id)) {
      usedRowIds.add(id);
      return row;
    }
    const suffix = `:from-${sectionSlug(sourceName)}`;
    let uniqueId = `${id}${suffix}`;
    let duplicate = 2;
    while (usedRowIds.has(uniqueId)) uniqueId = `${id}${suffix}-${duplicate++}`;
    usedRowIds.add(uniqueId);
    return { ...row, id: uniqueId, legacyRowId: row.legacyRowId || id, legacySectionName: row.legacySectionName || sourceName };
    });
  };

  for (const [sourceName, sourceSection] of Object.entries(quotation)) {
    const targetName = canonicalQuotationSectionName(sourceName);
    const sourceRows = Array.isArray(sourceSection?.rows) ? sourceSection.rows : [];
    const current = result[targetName];
    const headingKey = sourceHeading(sourceName) === "CLIENT SELECTIONS" ? "client-selections" : sectionSlug(sourceName);
    const headingId = `quotation-subheading:${sectionSlug(targetName)}:${headingKey}`;
    const addHeading = sectionBase(sourceName).toUpperCase() !== sectionBase(targetName).toUpperCase() && sourceRows.length > 0
      && !(targetName === "APPLIANCES & WHITE GOODS" && sourceRows.some((row) => row.applianceHeading));
    const additions = uniqueRows(sourceRows.map((row) => row.section === targetName ? row : { ...row, section: targetName }), sourceName, targetName);

    if (!current) {
      result[targetName] = {
        ...sourceSection,
        rows: [...(addHeading ? [quotationSubheadingRow(targetName, headingId, sourceHeading(sourceName), sourceName)] : []), ...additions],
        ...(sourceName !== targetName ? { legacySectionNames: [sourceName], legacySectionMetadata: { [sourceName]: sectionMetadata(sourceSection) } } : {}),
      };
      if (addHeading) {
        headingIds.add(headingId);
        usedRowIdsBySection.get(targetName)?.add(headingId);
      }
      continue;
    }

    let rows = current.rows || [];
    let newHeading = [];
    if (addHeading && !headingIds.has(headingId) && !usedRowIdsBySection.get(targetName)?.has(headingId)) {
      headingIds.add(headingId);
      usedRowIdsBySection.get(targetName)?.add(headingId);
      newHeading = [quotationSubheadingRow(targetName, headingId, sourceHeading(sourceName), sourceName)];
    }
    // A merged trade goes before the section's Client Selections group, which stays last so synced selection rows keep landing in it.
    const clientGroupAt = headingKey === "client-selections" ? -1 : rows.findIndex((row) => row?.lineType === "Heading" && /:client-selections$/.test(String(row.id || "")));
    rows = clientGroupAt >= 0 ? [...rows.slice(0, clientGroupAt), ...newHeading, ...additions, ...rows.slice(clientGroupAt)] : [...rows, ...newHeading, ...additions];
    const priorNames = current.legacySectionNames || [];
    const priorMetadata = current.legacySectionMetadata || {};
    result[targetName] = {
      ...current,
      ...(Number.isFinite(Number(sourceSection?.sortOrder)) && !(Number(current.sortOrder) <= Number(sourceSection.sortOrder)) ? { sortOrder: sourceSection.sortOrder } : {}),
      rows,
      ...(sourceName !== targetName ? {
        legacySectionNames: [...priorNames, sourceName],
        legacySectionMetadata: { ...priorMetadata, [sourceName]: sectionMetadata(sourceSection) },
      } : {}),
    };
  }

  for (const name of REQUIRED_QUOTATION_SECTIONS) {
    if (!result[name]) result[name] = { collapsed: true, columns: [], rows: [] };
  }

  const entries = Object.entries(result);
  const moveAfter = (movingName, anchorName) => {
    const movingIndex = entries.findIndex(([name]) => name === movingName);
    const anchorIndex = entries.findIndex(([name]) => name === anchorName);
    if (movingIndex < 0 || anchorIndex < 0 || movingIndex === anchorIndex + 1) return;
    const [moving] = entries.splice(movingIndex, 1);
    const adjustedAnchorIndex = entries.findIndex(([name]) => name === anchorName);
    entries.splice(adjustedAnchorIndex + 1, 0, moving);
  };
  moveAfter("PLUMBING FIXTURES & HOT WATER", "PLUMBING");
  const lastPlaster = entries.map(([name]) => name).filter((name) => /plaster/i.test(name)).at(-1);
  if (lastPlaster) moveAfter("STAIRS & BALUSTRADES", lastPlaster);

  return Object.fromEntries(resolveDuplicateRowIds(entries).map(([name, section]) => [
    name,
    migrateDerivedRows ? migrateDerivedSectionRows(name, section) : section,
  ]));
}

// Row ids are the stable identity that selections, history and schedules point at, so two rows in different sections must never share one.
// The row whose id matches its own source row keeps it; the other takes the id of its own source row (quote-<excelRow>), else a section suffix.
function resolveDuplicateRowIds(entries) {
  const owners = new Map();
  const used = new Set();
  for (const [, section] of entries) for (const row of section.rows || []) { if (row?.id) used.add(String(row.id)); }
  for (const [name, section] of entries) for (const row of section.rows || []) {
    const id = String(row?.id || "");
    if (!id) continue;
    const own = id === `quote-${row.excelRow}`;
    const held = owners.get(id);
    if (!held || (own && !held.own)) owners.set(id, { row, own, name });
  }
  return entries.map(([name, section]) => {
    let changed = false;
    const rows = (section.rows || []).map((row) => {
      const id = String(row?.id || "");
      if (!id) return row;
      if (owners.get(id).row === row) return row;
      const own = `quote-${row.excelRow}`;
      let nextId = Number.isFinite(Number(row.excelRow)) && row.excelRow !== "" && !used.has(own) ? own : `${id}:from-${sectionSlug(name)}`;
      for (let duplicate = 2; used.has(nextId); duplicate += 1) nextId = `${id}:from-${sectionSlug(name)}-${duplicate}`;
      used.add(nextId);
      changed = true;
      return { ...row, id: nextId, legacyRowId: row.legacyRowId || id, legacySectionName: row.legacySectionName || name };
    });
    return [name, changed ? { ...section, rows } : section];
  });
}

// Underslab drainage is the plumber's underslab progress claim: a share of the whole PLUMBING contract (drainage allowances included),
// not an extra charge. The old hard-coded charge is kept as history only.
function migrateDerivedSectionRows(name, section) {
  if (sectionBase(name).toLowerCase() !== "underslab and drainage") return section;
  const rows = section.rows || [];
  const costed = rows.filter((row) => row?.lineType !== "Heading");
  if (costed.length !== 1 || costed[0].progressAllocation) return section;
  const [row] = costed;
  const { derivedFromSection, derivedStatus, derivedFormula, derivedAmount, derivedSourceTotal, derivedQuantityFormula, derivedQuantityExplanation, derivedRateHistory, ...rest } = row;
  const superseded = String(row.manualRate ?? "").trim() !== "" ? [{ kind: "SUPERSEDED_CHARGE", value: row.manualRate, reason: "Underslab is a progress allocation of the PLUMBING contract, not an additional charge" }] : [];
  const migrated = {
    ...rest,
    progressAllocation: { ...UNDERSLAB_PROGRESS_DEFAULT },
    progressAllocationHistory: [...(row.progressAllocationHistory || []), ...(derivedRateHistory || []), ...superseded],
    manualRate: "", quantity: "", sourceOfRate: "progress allocation",
  };
  return { ...section, rows: rows.map((entry) => (entry === row ? migrated : entry)) };
}
// The user's saved section order, re-expressed in the normalised section names. Legacy names take the
// place of the canonical section they merged into; sections the job never had follow their normalised predecessor.
export function quotationSectionOrderAfterNormalize(savedOrder = [], normalized = {}) {
  const keys = Object.keys(normalized || {});
  const seen = new Set();
  const order = [];
  for (const name of Array.isArray(savedOrder) ? savedOrder : []) {
    const target = normalized[name] ? name : canonicalQuotationSectionName(name);
    if (normalized[target] && !seen.has(target)) { seen.add(target); order.push(target); }
  }
  keys.forEach((key, index) => {
    if (seen.has(key)) return;
    seen.add(key);
    const previous = keys.slice(0, index).reverse().find((candidate) => order.includes(candidate));
    order.splice(previous ? order.indexOf(previous) + 1 : 0, 0, key);
  });
  return order;
}