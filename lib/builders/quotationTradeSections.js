// Finds the EXISTING construction trade section for a requirement by canonical trade identity.
// Never creates a section: a trade the builder's template does not have is reported for approval.

const baseName = (name) => String(name || "").replace(/\s*\(\d+\)\s*$/, "").trim().toLowerCase().replace(/\s+/g, " ");
const textOf = (identity) => `${identity.productName || ""} ${identity.model || ""} ${identity.searchText || ""}`.toLowerCase();

const ELECTRICAL = /^electrical$/;
// Ordered groups: the first applicable group that matches any section decides; two matches in one group are ambiguous.
export const TRADE_RULES = Object.freeze({
  "garage-door": { trade: "Garage doors", groups: [
    { when: (i) => /sectional|panel ?lift/.test(textOf(i)), patterns: [/^garage doors? - sectional/] },
    { when: (i) => /roll(er)?[ -]?a?[ -]?door|roller/.test(textOf(i)), patterns: [/^garage doors? - (manual )?roll/] },
    { patterns: [/^garage doors?/] },
  ] },
  driveway: { trade: "Concreting / driveway", groups: [{ patterns: [/driveway/] }, { patterns: [/^concrete and landscaping$/] }, { patterns: [/^concret/] }] },
  cladding: { trade: "External cladding", groups: [{ patterns: [/^external cladding$/] }, { patterns: [/^exterior cladding$/] }] },
  bricks: { trade: "Face brickwork", groups: [{ patterns: [/^face brickwork$/] }] },
  roofing: { trade: "Roofing", groups: [{ patterns: [/^roofing materials$/] }, { patterns: [/^roofing/] }] },
  "internal-doors": { trade: "Internal doors / fix-out", groups: [{ patterns: [/^internal doors?$|^interior doors?$/] }, { patterns: [/^fix out$/] }] },
  "door-hardware": { trade: "Door furniture", groups: [{ patterns: [/^door furniture$/] }] },
  skirting: { trade: "Fix-out", groups: [{ patterns: [/^fix out$/] }] },
  architraves: { trade: "Fix-out", groups: [{ patterns: [/^fix out$/] }] },
  robes: { trade: "Cabinetry (internal fit-out) / sliding doors", groups: [
    { when: (i) => /slid|mirror(ed)? door/.test(textOf(i)), patterns: [/sliding doors/] },
    { patterns: [/^cabinetry$/] },
  ] },
  "interior-lighting": { trade: "Light fittings", groups: [{ patterns: [/^light ?fittings?$/] }, { patterns: [ELECTRICAL] }] },
  "ceiling-fan": { trade: "Ceiling fans", groups: [{ patterns: [/^ceiling fans?$/] }, { patterns: [ELECTRICAL] }] },
  "external-lighting": { trade: "Light fittings", groups: [{ patterns: [/^light ?fittings?$/] }, { patterns: [ELECTRICAL] }] },
  "exterior-paint": { trade: "Painter", groups: [{ patterns: [/^painter$/] }] },
  "interior-paint": { trade: "Painter", groups: [{ patterns: [/^painter$/] }] },
});

// A builder's own template configuration beats the built-in rules: workbook.builderTradeSections[requirementKey] = section name.
export function resolveTradeSection({ workbook = {}, identity = {}, fallbackSectionNames = [] } = {}) {
  const names = Object.keys(workbook.quotation || {});
  const configured = workbook.builderTradeSections?.[identity.requirementKey];
  if (configured) return names.includes(configured) ? { status: "FOUND", section: configured, source: "builder-template-config" } : { status: "MISSING", trade: configured, reason: "Configured trade section is not in this quotation" };
  const rule = TRADE_RULES[identity.requirementKey];
  if (rule) {
    for (const group of rule.groups) {
      if (group.when && !group.when(identity)) continue;
      const hits = names.filter((name) => group.patterns.some((pattern) => pattern.test(baseName(name))));
      if (hits.length === 1) return { status: "FOUND", section: hits[0], source: "trade-identity", trade: rule.trade };
      if (hits.length > 1) return { status: "AMBIGUOUS", candidates: hits, trade: rule.trade };
    }
    return { status: "MISSING", trade: rule.trade, reason: `No existing "${rule.trade}" trade section in this quotation` };
  }
  const fallback = fallbackSectionNames.find((name) => names.includes(name));
  return fallback ? { status: "FOUND", section: fallback, source: "requirement-category" } : { status: "MISSING", trade: identity.requirementKey, reason: "No trade identity rule or category section matches an existing section" };
}
