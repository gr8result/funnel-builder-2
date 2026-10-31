// Persisted quotation ordering.
//
// The order of quotation sections and of the lines inside each section is user data. It used to
// live only in array / object-key position, so anything that rebuilt a rows array (a template
// migration, a required-row insert, a Client Selections or Window Schedule sync) could silently
// move lines the estimator had arranged by hand. Every section and every line now carries an
// explicit, saved order:
//
//   section.sortOrder                 1-based position of the section in the quotation
//   row.sortOrder + row.sortSection   1-based position of the line inside that section
//
// stampQuotationOrder() records the order currently in state (after a move, and on every job /
// template save and export). applyPersistedQuotationOrder() restores it on open and after any
// regeneration: lines with a saved position keep it exactly; a line with no saved position (newly
// generated) stays beside the line it was inserted after, and never displaces a saved line.
// Rows are matched by their stable id - never by description.

// Older display renumbering removed the trailing number from section keys. That is still the
// same section: retain its line positions when hydrating an older numbered sortSection value.
const sectionIdentity = (name) => String(name || '').replace(/\s*\(\d+\)\s*$/, '').trim();
const sectionSlug = (name) => sectionIdentity(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unnamed';
const validOrder = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;

export function quotationSectionId(name, section = {}) {
  return String(section.sectionId || `quote-section:${sectionSlug(name)}`);
}

export function ensureQuotationSectionIds(quotation = {}) {
  if (!quotation || typeof quotation !== 'object' || Array.isArray(quotation)) return quotation;
  const used = new Set();
  let changed = false;
  const result = Object.fromEntries(Object.entries(quotation).map(([name, section]) => {
    if (!section || typeof section !== 'object') return [name, section];
    const baseId = quotationSectionId(name, section);
    let sectionId = baseId;
    let suffix = 2;
    while (used.has(sectionId)) sectionId = `${baseId}:${suffix++}`;
    used.add(sectionId);
    if (section.sectionId === sectionId) return [name, section];
    changed = true;
    return [name, { ...section, sectionId }];
  }));
  return changed ? result : quotation;
}

export function quotationSectionOrderIds(quotation = {}, sectionOrder = []) {
  const sections = ensureQuotationSectionIds(quotation);
  const byId = new Map(Object.entries(sections).map(([name, section]) => [section.sectionId, name]));
  const names = Array.isArray(sectionOrder) && sectionOrder.length
    ? sectionOrder.map((value) => Object.hasOwn(sections, value) ? value : byId.get(value)).filter(Boolean)
    : Object.keys(sections);
  return [...new Set(names)].map((name) => sections[name].sectionId);
}

export function quotationNamesForSectionIds(quotation = {}, sectionIds = []) {
  const byId = new Map(Object.entries(quotation || {}).map(([name, section]) => [section?.sectionId, name]));
  return [...new Set((Array.isArray(sectionIds) ? sectionIds : []).map((id) => byId.get(id)).filter(Boolean))];
}

const sameSection = (row, sectionName, sectionId = '') => Boolean(validOrder(row?.sortOrder))
  && (row?.sortSectionId && sectionId
    ? row.sortSectionId === sectionId
    : Boolean(row?.sortSection) && sectionIdentity(row.sortSection) === sectionIdentity(sectionName));

export function stampQuotationOrder(quotation = {}, sectionOrder = null) {
  if (!quotation || typeof quotation !== "object") return quotation;
  const withIds = ensureQuotationSectionIds(quotation);
  const names = Array.isArray(sectionOrder) && sectionOrder.length
    ? [...sectionOrder.filter((name) => Object.hasOwn(withIds, name)), ...Object.keys(withIds).filter((name) => !sectionOrder.includes(name))]
    : Object.keys(withIds);
  const position = new Map(names.map((name, index) => [name, index + 1]));
  let changed = false;
  const next = Object.fromEntries(Object.entries(withIds).map(([name, section]) => {
    if (!section || typeof section !== "object") return [name, section];
    const rows = Array.isArray(section.rows) ? section.rows : null;
    let rowsChanged = false;
    const stampedRows = rows ? rows.map((row, index) => {
      if (!row || typeof row !== "object") return row;
      if (row.sortOrder === index + 1 && row.sortSection === name && row.sortSectionId === section.sectionId) return row;
      rowsChanged = true;
      return { ...row, sortOrder: index + 1, sortSection: name, sortSectionId: section.sectionId };
    }) : rows;
    const sortOrder = position.get(name);
    if (!rowsChanged && section.sortOrder === sortOrder) return [name, section];
    changed = true;
    return [name, { ...section, sortOrder, ...(rows ? { rows: rowsChanged ? stampedRows : rows } : {}) }];
  }));
  return changed ? next : withIds;
}

// Restores one section's saved line order. Unstamped rows keep their place relative to the
// stamped row that precedes them in the incoming array.
export function applyPersistedRowOrder(rows = [], sectionName = "", sectionId = "") {
  if (!Array.isArray(rows) || rows.length < 2) return rows;
  if (!rows.some((row) => sameSection(row, sectionName, sectionId))) return rows;
  const anchored = [];
  const leading = [];
  let current = null;
  rows.forEach((row, index) => {
    if (sameSection(row, sectionName, sectionId)) {
      current = { row, index, followers: [] };
      anchored.push(current);
    } else if (current) current.followers.push(row);
    else leading.push(row);
  });
  anchored.sort((left, right) => Number(left.row.sortOrder) - Number(right.row.sortOrder) || left.index - right.index);
  const ordered = [...leading, ...anchored.flatMap((item) => [item.row, ...item.followers])];
  return ordered.every((row, index) => row === rows[index]) ? rows : ordered;
}

export function applyPersistedQuotationOrder(quotation = {}) {
  if (!quotation || typeof quotation !== "object") return quotation;
  const withIds = ensureQuotationSectionIds(quotation);
  let changed = false;
  const next = Object.fromEntries(Object.entries(withIds).map(([name, section]) => {
    const rows = section?.rows;
    const ordered = applyPersistedRowOrder(rows, name, section?.sectionId || "");
    if (ordered === rows) return [name, section];
    changed = true;
    return [name, { ...section, rows: ordered }];
  }));
  return changed ? next : withIds;
}

// The saved section order, from section.sortOrder. Sections without one keep their existing
// relative position after the saved ones they followed.
export function persistedSectionOrder(quotation = {}, fallbackOrder = []) {
  const sections = ensureQuotationSectionIds(quotation);
  const names = Array.isArray(fallbackOrder) && fallbackOrder.length
    ? [...fallbackOrder.map((value) => Object.hasOwn(sections, value) ? value : quotationNamesForSectionIds(sections, [value])[0]).filter(Boolean), ...Object.keys(sections).filter((name) => !fallbackOrder.includes(name) && !fallbackOrder.includes(sections[name]?.sectionId))]
    : Object.keys(sections);
  if (Array.isArray(fallbackOrder) && fallbackOrder.length) return [...new Set(names)];
  return names.map((name, index) => ({ name, index, order: sections[name]?.sortOrder }))
    .filter((entry) => validOrder(entry.order))
    .sort((left, right) => Number(left.order) - Number(right.order) || left.index - right.index)
    .map((entry) => entry.name)
    .concat(names.filter((name) => !validOrder(sections[name]?.sortOrder)));
}

// { sections: [name...], rows: { section: [id...] } } - what tests and diagnostics compare.
export function quotationOrderSnapshot(quotation = {}, sectionOrder = null) {
  const sections = Array.isArray(sectionOrder) && sectionOrder.length ? sectionOrder : Object.keys(quotation || {});
  return {
    sections,
    rows: Object.fromEntries(Object.entries(quotation || {}).map(([name, section]) => [name, (section?.rows || []).map((row) => row?.id)])),
  };
}
