import { plumbingLineFromProduct, plumbingLineWithTotals, plumbingLocationKey } from './plumbingFixtureAllocation.js';
import { serviceQuoteRequirements } from './residentialServices.js';

export const STANDARD_RANGE_KEYS = ['interior-lighting', 'ceiling-fan', 'air-conditioning', 'external-lighting'];
const entity = p => p?.metadata?.productEntity || p || {};
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const patterns = {
  'interior-lighting': /downlight|pendant|light fitting|wall light|ceiling light|strip light/i,
  downlight: /downlight/i, 'ceiling-fan': /ceiling fan/i, 'smoke-alarm': /smoke alarm|smoke detector/i,
  pendant: /pendant/i, 'wall-light': /wall light/i, 'ceiling-light': /ceiling light/i,
  'strip-light': /strip light|led strip/i, 'step-light': /step light/i,
  'exhaust-fan': /exhaust|heat.*light|tastic/i, 'external-lighting': /exterior light|external light|outdoor light/i,
  'air-conditioning': /air.?condition|ducted|split system/i,
};
export function standardFixtureKey(key, label = '') {
  return key === 'interior-lighting' ? Object.entries(patterns).find(([k, re]) => k !== key && re.test(label))?.[0] || key : key;
}
function inclusionSources(workbook) {
  const inclusions = workbook.standardInclusions || {};
  const packageId = inclusions.selectedPackageId || inclusions.selected_standard_inclusions_package_id;
  const selected = inclusions.packages?.find(p => p.id === packageId);
  const raw = inclusions.sections || [];
  const sections = Array.isArray(raw) ? raw : Object.entries(raw).map(([title, bullets]) => ({ title, bullets }));
  return { structured: selected?.standardProducts || inclusions.standardProducts || {},
    bullets: sections.filter(s => s.active !== false && (!s.package_id || s.package_id === packageId)).flatMap(s => s.bullets || []).filter(s => typeof s === 'string') };
}
// The caller supplies the current builder's effective library. Never pick a global catalogue
// product merely because it is first/cheapest. Free-text inclusions remain honest specifications.
export function resolveBuilderStandard(workbook = {}, products = [], key, target = {}) {
  const fixture = standardFixtureKey(key, target.label);
  const sources = inclusionSources(workbook);
  const pattern = patterns[fixture];
  const match = value => products.find(p => [entity(p).productCode, p.productCode, p.productId, entity(p).model, entity(p).productName].filter(Boolean).some(id => norm(id) === norm(value)));
  const resolve = value => {
    if (!value) return null;
    const spec = typeof value === 'string' ? { productCode: value } : value;
    const product = match(spec.productCode || spec.productId || spec.model || spec.productName);
    if (!product && !spec.productName && !spec.description && !spec.productCode && !spec.productId) return null;
    return { ...spec, product: product || { ...spec, productName: spec.productName || spec.description || `Builder specified product (${spec.productCode || spec.productId})`, productCode: spec.productCode || `builder-standard:${fixture}` } };
  };
  const configured = Array.isArray(sources.structured) ? sources.structured.find(p=>(p.fixtureKey || p.requirementKey)===fixture) : sources.structured[fixture] || sources.structured[key];
  let result = resolve(configured);
  if (result) return { ...result, source: 'Builder Standard Inclusions', fixture };
  const bullet = sources.bullets.find(b => pattern?.test(b) && !/not included|excluded|by owner|no allowance/i.test(b));
  if (bullet) {
    const product = products.find(p => [entity(p).model, entity(p).productCode, entity(p).productName].filter(v => v && String(v).length > 3).some(v => norm(bullet).includes(norm(v))));
    return { product: product || { productCode: `builder-standard:${fixture}`, productName: bullet, description: bullet }, source: 'Builder Standard Inclusions', fixture };
  }
  const preferred = products.find(p => {
    const e = entity(p);
    return (e.selectionMode === 'standard_included' || e.customFields?.selectionMode === 'standard_included' || e.attributes?.isBuilderStandard === true)
      && (!pattern || pattern.test(`${e.productName} ${e.productType}`));
  });
  if (preferred) return { product: preferred, source: 'Builder Product Library', fixture };
  result = resolve(workbook.builderDefaults?.standardProducts?.[fixture] || workbook.builderDefaults?.standardProducts?.[key] || workbook.productCategoryDefaults?.[fixture]);
  return result ? { ...result, source: 'Builder default configuration', fixture } : null;
}

export function standardRangeDefaults(workbook = {}, products = [], key) {
  return serviceQuoteRequirements(workbook, key).filter(t => t.quantity > 0).flatMap(target => {
    const standard = resolveBuilderStandard(workbook, products, key, target);
    if (!standard || standard.included === false) return [];
    const allowanceEx = target.materialAllowance ?? standard.unitAllowanceExGst ?? null;
    const allowance = allowanceEx == null ? Number(standard.unitAllowance) || 0 : Number(allowanceEx) * 1.1;
    const allowanceExGst = allowanceEx == null ? null : Number(allowanceEx);
    const p = standard.product;
    const location = target.location || 'Project default';
    const baseline = { productCode: entity(p).productCode || p.productCode, productName: p.productName || entity(p).productName,
      source: standard.source, fixture: standard.fixture, unitAllowance: allowanceExGst, originalMaterialAllowance: allowanceExGst,
      allowanceKnown: allowanceExGst !== null,
      imageUrl: p.imageUrl || entity(p).primaryImageUrl || '', brand: p.brand || entity(p).brand || '', model: entity(p).model || '', colour: p.colour || entity(p).colour || '', specifications: entity(p).attributes?.selectionFacets || {} };
    return [plumbingLineWithTotals({ ...plumbingLineFromProduct(p), lineId: `standard:${key}:${target.section}:${target.rowId}`,
      unitPrice: allowance, unitAllowance: allowanceExGst ?? 0, priceIncludesGst: true, priceBasis: 'Included allowance inc GST', allowancePending: allowanceExGst === null, isBuilderStandard: true,
      standardBaseline: baseline, quotationRowId: target.rowId, quotationSection: target.section, originalMaterialAllowance: allowanceEx,
      allocations: [{ locationKey: plumbingLocationKey(location), location, quantity: target.quantity }],
      ...(key === 'air-conditioning' ? { hvac: { systemType: entity(p).attributes?.systemType || (/ducted/i.test(baseline.productName) ? 'Ducted' : 'Split'), confirmationStatus: 'Supplier / Design Confirmation Required' } } : {}) })];
  });
}

export function standardRangeOrder(products = [], standardCodes = []) {
  return [...products].sort((a,b) => {
    const rank = p => standardCodes.includes(entity(p).productCode) ? 0 : entity(p).attributes?.commonUpgrade ? 1 : 2;
    return rank(a) - rank(b) || (entity(a).displayPriority ?? entity(a).attributes?.displayPriority ?? 100) - (entity(b).displayPriority ?? entity(b).attributes?.displayPriority ?? 100);
  });
}

export function restoreStandardLocation(lines, defaultLine, locationKey) {
  const matching = l => l.quotationRowId === defaultLine.quotationRowId && l.quotationSection === defaultLine.quotationSection;
  const returned = lines.filter(l=>matching(l)&&!l.isBuilderStandard).flatMap(l=>l.allocations.filter(a=>a.locationKey===locationKey));
  if (!returned.length) return lines;
  const standard = lines.find(l=>matching(l)&&l.isBuilderStandard) || {...defaultLine,allocations:[],quantity:0};
  const next = lines.filter(l=>l!==standard).map(l=>matching(l)&&!l.isBuilderStandard ? plumbingLineWithTotals({...l,allocations:l.allocations.filter(a=>a.locationKey!==locationKey)}) : l);
  return [...next,plumbingLineWithTotals({...standard,allocations:[...standard.allocations,...returned]})].filter(l=>l.quantity>0);
}

// Keep the house default as one line and move only the requested room quantity into an override.
// The baseline belongs to the quotation requirement and never comes from the upgrade's price.
export function overrideStandardLocation(lines, defaultLine, product, location, quantity, { unitPrice = null, hvac } = {}) {
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  if (!qty || !location) throw new Error('Choose a project room and quantity.');
  const targetLines = lines.filter(l => l.quotationRowId === defaultLine.quotationRowId && l.quotationSection === defaultLine.quotationSection);
  const baseline = defaultLine.standardBaseline;
  const locationKey = plumbingLocationKey(location);
  const prior = targetLines.filter(l => !l.isBuilderStandard && l.allocations.some(a => a.locationKey === locationKey));
  const returned = prior.reduce((n,l) => n + l.allocations.filter(a => a.locationKey === locationKey).reduce((sum,a) => sum + a.quantity,0),0);
  const standard = targetLines.find(l => l.isBuilderStandard) || { ...defaultLine, allocations: [], quantity: 0 };
  let available = standard.quantity + returned;
  if (qty > available) throw new Error(`Only ${available} included items remain. Adjust the project quantity before adding more.`);
  let remaining = qty;
  const allocations = [...standard.allocations.map(a => ({...a}))];
  if (returned) allocations.push({ locationKey: 'project-default', location: 'Project default', quantity: returned });
  // Consume the room's own allowance first, then the unassigned project default.
  allocations.sort((a,b) => Number(b.locationKey === locationKey) - Number(a.locationKey === locationKey));
  for (const a of allocations) { const used = Math.min(a.quantity,remaining); a.quantity -= used; remaining -= used; }
  const next = lines.filter(l => l !== standard).map(l => prior.includes(l) ? plumbingLineWithTotals({...l, allocations:l.allocations.filter(a => a.locationKey !== locationKey)}) : l).filter(l => l.quantity > 0);
  next.push(plumbingLineWithTotals({...standard, allocations}));
  const code = entity(product).productCode || product.productCode || product.id;
  const id = `override:${defaultLine.quotationSection}:${defaultLine.quotationRowId}:${code}`;
  const existing = next.find(l => l.lineId === id);
  const line = plumbingLineWithTotals({ ...plumbingLineFromProduct(product), lineId: id, standardBaseline: baseline,
    unitPrice, unitAllowance: baseline.unitAllowance ?? 0, priceIncludesGst: true, originalMaterialAllowance: baseline.originalMaterialAllowance,
    allowancePending: baseline.allowanceKnown === false,
    quotationRowId: defaultLine.quotationRowId, quotationSection: defaultLine.quotationSection, priceBasis: 'Retail inc GST',
    allocations: [...(existing?.allocations || []), { locationKey, location, quantity: qty }], ...(hvac ? { hvac } : {}) });
  return [...next.filter(l => l.lineId !== id),line].filter(l => l.quantity > 0);
}
