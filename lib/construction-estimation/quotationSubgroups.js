// Collapsible subgroups inside one quotation section.
//
// A large section (CABINETRY has ~870 rows) is divided by heading rows: level 1 for a major area
// (KITCHEN CABINETRY) and level 2 for a group inside it (STANDARD COLOURBOARD). This module turns
// those heading rows into groups, summarises each group from the rows that are actually in the
// quote, and says which rows are visible for a given open / closed state.
//
// It is DISPLAY ONLY. Nothing here reads or writes quantities, prices, formulas, selections or row
// order; a collapsed row is still a full row of the quotation and is calculated exactly as before.
// It knows nothing about cabinetry: the caller says how to recognise a heading, a spacer and an
// active row, so any section built with heading rows can use it.

const money = value => Math.round((Number(value) || 0) * 100) / 100;

// options: headingLevel(row) -> 1 | 2 | 0, isSpacer(row), isActive(row), cost(row), label(row), key(row)
export function buildQuotationSubgroups(rows = [], options = {}) {
  const { headingLevel = () => 0, isSpacer = () => false, isActive = row => Number(row.qty) > 0, cost = row => row.cost, label = row => row.item, key = row => row.id } = options;
  const groups = new Map();
  const placement = new Map();
  let area = null, group = null;
  for (const row of rows) {
    const level = headingLevel(row);
    if (level === 1) {
      area = { key: key(row), level: 1, parentKey: null, label: String(label(row) || ''), items: 0, total: 0, activeGroups: [] };
      group = null; groups.set(area.key, area); placement.set(key(row), { heading: area.key });
    } else if (level === 2) {
      group = { key: key(row), level: 2, parentKey: area?.key || null, label: String(label(row) || ''), items: 0, total: 0 };
      groups.set(group.key, group); placement.set(key(row), { heading: group.key, area: area?.key || null });
    } else {
      placement.set(key(row), { area: area?.key || null, group: group?.key || null, spacer: isSpacer(row) });
      if (isSpacer(row) || !isActive(row)) continue;
      for (const target of [area, group]) if (target) { target.items += 1; target.total = money(target.total + (Number(cost(row)) || 0)); }
      if (area && group && !area.activeGroups.includes(group.label)) area.activeGroups.push(group.label);
    }
  }
  return { groups, placement, list: [...groups.values()] };
}

// status: what the rest of the application already knows about a major area, keyed by its label:
//   { confirmed: boolean, selected: [labels of the level-2 groups chosen for it] }
// The defaults: a confirmed area is closed; an area in progress is open with only its chosen or
// active groups open; an area nothing has been done in stays closed until opened.
export function subgroupDefaultOpen(group, model, status = {}) {
  const area = group.level === 1 ? group : model.groups.get(group.parentKey);
  const known = status[area?.label] || {};
  if (group.level === 1) return !known.confirmed && (group.items > 0 || (known.selected || []).length > 0);
  return group.items > 0 || (known.selected || []).includes(group.label);
}

// A user's own open / close choice stands until the area's situation changes (it is confirmed,
// reopened, or a different group is chosen for it); then the defaults apply again. That is what
// collapses an area automatically the moment it is confirmed.
export function subgroupSignature(group, model, status = {}) {
  const area = group.level === 1 ? group : model.groups.get(group.parentKey);
  const known = status[area?.label] || {};
  return `${known.confirmed ? 1 : 0}|${(known.selected || []).join(',')}`;
}

export function isSubgroupOpen(group, model, status, overrides = {}) {
  const override = overrides[group.key];
  return override && override.signature === subgroupSignature(group, model, status) ? override.open : subgroupDefaultOpen(group, model, status);
}

// Rows to draw. A level-1 heading is always drawn; everything under a closed area or group is not.
export function visibleSubgroupRows(rows = [], model, isOpen, key = row => row.id) {
  return rows.filter(row => {
    const place = model.placement.get(key(row));
    if (!place) return true;
    if (place.heading) return !place.area || isOpen(model.groups.get(place.area));
    if (place.area && !isOpen(model.groups.get(place.area))) return false;
    return !place.group || isOpen(model.groups.get(place.group));
  });
}
