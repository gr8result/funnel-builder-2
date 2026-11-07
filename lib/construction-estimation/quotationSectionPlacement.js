// Section placement repair for the Quotation Builder section order (hotfix 2026-11-07).
//
// Two kinds of section were being shown out of place, so the quotation appeared to stop at
// APPLIANCES & WHITE GOODS with whole trades missing from where the builder expects them:
//   1. A group heading saved AFTER all of its own sub-sections (APPLIANCES & WHITE GOODS was
//      appended at the very end while its brand sections sat after CABINETRY). The screen nests
//      sub-sections under their heading, so the whole group moved to the end.
//   2. Client Selections sections ("TILING - ENSUITE", "ELECTRICAL - CLIENT SELECTIONS", ...) that
//      the selection sync appends to the end of the order instead of beside their trade.
// Only sections still in that automatically appended position are moved: a section the builder
// placed somewhere else with Manage Section Order stays where it is. Nothing is added or removed.

const base = (name) => String(name || "").toLowerCase().replace(/['’]/g, "").replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim();

const GROUP_PARENTS = [
  { parents: ["appliances & white goods", "appliance package"], child: /^(appliances & white goods|appliance package) - / },
];

// Client Selections section -> the trade heading(s) it belongs beside, most specific first.
const CLIENT_SELECTION_TRADES = [
  [/^tiling - /, ["tiling"]],
  [/^electrical - client selections$/, ["electrical"]],
  [/^plumbing fit off - client selections$/, ["plumbing fittings & tapwear", "plumbing fixtures & hot water", "plumbing"]],
  [/^entry door furniture - client selections$/, ["entry doors", "doors"]],
  [/^door jamb materials$/, ["fix out", "fix out materials", "skirting & architraves"]],
  [/^stairs & balustrades - client selections$/, ["stairs & balustrades", "stairs"]],
  [/^fix out - bathroom accessories - client selections$/, ["fix out", "fix out materials", "skirting & architraves"]],
  [/^shower screens & mirrors - client selections$/, ["mirrors & shower screens", "shower screens, mirrors & sliding doors"]],
  [/^(.+) - client selections$/, null],
];

function tradeFor(name, present) {
  const text = base(name);
  for (const [pattern, trades] of CLIENT_SELECTION_TRADES) {
    const match = text.match(pattern);
    if (!match) continue;
    const candidates = trades || [match[1]];
    const found = candidates.map((trade) => present.get(trade)).find(Boolean);
    if (found) return found;
  }
  return "";
}

export function isClientSelectionSectionName(name) {
  return CLIENT_SELECTION_TRADES.some(([pattern]) => pattern.test(base(name)));
}

export function placeDisplacedQuoteSections(order = []) {
  let sections = [...order];
  // 1. A group heading saved after all of its sub-sections goes back in front of the first one.
  for (const { parents, child } of GROUP_PARENTS) {
    const parent = sections.find((name) => parents.includes(base(name)));
    if (!parent) continue;
    const children = sections.filter((name) => child.test(base(name)));
    if (!children.length) continue;
    const parentAt = sections.indexOf(parent);
    const firstChildAt = Math.min(...children.map((name) => sections.indexOf(name)));
    if (parentAt < firstChildAt) continue;
    if (parentAt < Math.max(...children.map((name) => sections.indexOf(name)))) continue;
    sections.splice(parentAt, 1);
    sections.splice(firstChildAt, 0, parent);
  }
  // 2. Client Selections sections in the trailing appended run move beside their trade heading.
  let tailStart = sections.length;
  while (tailStart > 0 && (isClientSelectionSectionName(sections[tailStart - 1]) || GROUP_PARENTS.some(({ parents }) => parents.includes(base(sections[tailStart - 1]))))) tailStart -= 1;
  const tail = sections.slice(tailStart).filter((name) => isClientSelectionSectionName(name));
  if (!tail.length) return sections;
  const present = new Map();
  sections.slice(0, tailStart).forEach((name) => { if (!isClientSelectionSectionName(name) && !present.has(base(name))) present.set(base(name), name); });
  const moving = tail.map((name) => [name, tradeFor(name, present)]).filter(([, trade]) => trade);
  if (!moving.length) return sections;
  const movingNames = new Set(moving.map(([name]) => name));
  sections = sections.filter((name) => !movingNames.has(name));
  const lastPlaced = new Map();
  for (const [name, trade] of moving) {
    const anchor = lastPlaced.get(trade) || trade;
    sections.splice(sections.indexOf(anchor) + 1, 0, name);
    lastPlaced.set(trade, name);
  }
  return sections;
}
