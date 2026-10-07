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
const sameSection = (row, sectionName) => Boolean(row?.sortSection) && sectionIdentity(row.sortSection) === sectionIdentity(sectionName) && Number.isFinite(Number(row?.sortOrder));

export function stampQuotationOrder(quotation = {}, sectionOrder = null) {
  if (!quotation || typeof quotation !== "object") return quotation;
  const names = Array.isArray(sectionOrder) && sectionOrder.length
    ? [...sectionOrder.filter((name) => Object.hasOwn(quotation, name)), ...Object.keys(quotation).filter((name) => !sectionOrder.includes(name))]
    : Object.keys(quotation);
  const position = new Map(names.map((name, index) => [name, index + 1]));
  let changed = false;
  const next = Object.fromEntries(Object.entries(quotation).map(([name, section]) => {
    if (!section || typeof section !== "object") return [name, section];
    const rows = Array.isArray(section.rows) ? section.rows : null;
    let rowsChanged = false;
    const stampedRows = rows ? rows.map((row, index) => {
      if (!row || typeof row !== "object") return row;
      if (row.sortOrder === index + 1 && row.sortSection === name) return row;
      rowsChanged = true;
      return { ...row, sortOrder: index + 1, sortSection: name };
    }) : rows;
    const sortOrder = position.get(name);
    if (!rowsChanged && section.sortOrder === sortOrder) return [name, section];
    changed = true;
    return [name, { ...section, sortOrder, ...(rows ? { rows: rowsChanged ? stampedRows : rows } : {}) }];
  }));
  return changed ? next : quotation;
}

// Restores one section's saved line order. Unstamped rows keep their place relative to the
// stamped row that precedes them in the incoming array.
export function applyPersistedRowOrder(rows = [], sectionName = "") {
  if (!Array.isArray(rows) || rows.length < 2) return rows;
  if (!rows.some((row) => sameSection(row, sectionName))) return rows;
  const anchored = [];
  const leading = [];
  let current = null;
  rows.forEach((row, index) => {
    if (sameSection(row, sectionName)) {
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
  let changed = false;
  const next = Object.fromEntries(Object.entries(quotation).map(([name, section]) => {
    const rows = section?.rows;
    const ordered = applyPersistedRowOrder(rows, name);
    if (ordered === rows) return [name, section];
    changed = true;
    return [name, { ...section, rows: ordered }];
  }));
  return changed ? next : quotation;
}

// The saved section order, from section.sortOrder. Sections without one keep their existing
// relative position after the saved ones they followed.
export function persistedSectionOrder(quotation = {}, fallbackOrder = []) {
  const names = Array.isArray(fallbackOrder) && fallbackOrder.length
    ? [...fallbackOrder.filter((name) => Object.hasOwn(quotation, name)), ...Object.keys(quotation).filter((name) => !fallbackOrder.includes(name))]
    : Object.keys(quotation || {});
  if (!names.some((name) => Number.isFinite(Number(quotation[name]?.sortOrder)))) return names;
  const anchored = [];
  const leading = [];
  let current = null;
  names.forEach((name, index) => {
    if (Number.isFinite(Number(quotation[name]?.sortOrder))) {
      current = { name, index, followers: [] };
      anchored.push(current);
    } else if (current) current.followers.push(name);
    else leading.push(name);
  });
  anchored.sort((left, right) => Number(quotation[left.name].sortOrder) - Number(quotation[right.name].sortOrder) || left.index - right.index);
  return [...leading, ...anchored.flatMap((item) => [item.name, ...item.followers])];
}

// { sections: [name...], rows: { section: [id...] } } - what tests and diagnostics compare.
export function quotationOrderSnapshot(quotation = {}, sectionOrder = null) {
  const sections = Array.isArray(sectionOrder) && sectionOrder.length ? sectionOrder : Object.keys(quotation || {});
  return {
    sections,
    rows: Object.fromEntries(Object.entries(quotation || {}).map(([name, section]) => [name, (section?.rows || []).map((row) => row?.id)])),
  };
}
