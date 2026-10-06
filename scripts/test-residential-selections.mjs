import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';
import { clientSelectionCategoryProducts, filterPlumbingFixtureProducts, plumbingFixtureFilterOptions } from '../lib/product-library/plumbingFixtureCatalogue.js';
import { plumbingLocationsForRequirement, plumbingLineFromProduct, plumbingLineWithTotals } from '../lib/builders/plumbingFixtureAllocation.js';
import { connectAllocatedSelectionsToQuotation } from '../lib/builders/allocatedSelectionQuotation.js';
import { serviceProjectRequirement } from '../lib/builders/residentialServices.js';
import { paintSchemeComplete, newPaintScheme, resolvePaintChoice, snapshotPaintScheme, connectPaintSchemeToQuotation, paintLitres, paintMaterialOrder, paintSchemeFromInclusions } from '../lib/builders/paintScheme.js';
const read = n => JSON.parse(fs.readFileSync(`data/product-library/catalogues/residential/${n}.json`, 'utf8'));
const catalogue = getMasterProducts('residential-regression');
// Electrical points are a quantity schedule (test-electrical-schedule.mjs), not catalogue products.
const keys = ['interior-lighting','ceiling-fan'];
for (const key of keys) {
  const products = clientSelectionCategoryProducts({ requirementKey: key }, { products: catalogue });
  assert(products.length >= 5, `${key}: usable imported catalogue`);
  assert(products.some(p => p.primaryImageUrl && p.rrp > 0), `${key}: official image and price`);
}
for (const name of ['AU-BEACON-LIGHTING-FANS','AU-DULUX-PAINT']) {
  const p = read(name).products;
  assert.equal(new Set(p.map(x => x.productCode)).size, p.length, 'stable unique identities');
  assert(p.every(x => x.sourceUrl && x.sourceRetrievedAt && x.attributes.externalProductId));
}
const beacon = read('AU-BEACON-LIGHTING-FANS').products;
assert(beacon.filter(p => p.requirementKeys.includes('ceiling-fan')).length > 50);
for (const p of beacon) { assert.equal(p.clientPrice, p.attributes.regularPrice); assert.equal(p.rrp, p.attributes.regularPrice); }
const fans = catalogue.filter(p => p.supplier === 'Beacon Lighting' && p.familyKey === 'ceiling-fans');
const facets = plumbingFixtureFilterOptions(fans).facets;
assert(facets.Current.includes('AC') && facets.Current.includes('DC'));
assert(filterPlumbingFixtureProducts(fans, { facets: { Current: 'DC' } }).every(p => p.attributes.selectionFacets.Current === 'DC'));
const rooms = plumbingLocationsForRequirement('ceiling-fan', ['Master Bedroom', 'Bedroom 2', 'Living', 'Alfresco']);
assert.equal(rooms.length, 4); assert(rooms.every(r => r.suggested));

const initial = { quotation: { ELECTRICAL: { rows: [{ id: 'lights', item: 'DOWNLIGHTS', qty: 24, unit: 'EACH', excelRate: 80, manualRate: '', materialRate: 10, labourRate: 70 }] } }, procurement: { items: [{ id: 'existing-order', orderStatus: 'Ordered' }] } };
assert.equal(serviceProjectRequirement(initial, 'interior-lighting').quantity, 24);
const line = plumbingLineWithTotals({ ...plumbingLineFromProduct(beacon[0]), lineId: 'light-spec', quantity: 24, unitPrice: 22, priceBasis: 'Retail inc GST', unitAllowance: 11,
  quotationRowId: 'lights', quotationSection: 'ELECTRICAL', allocations: [{ locationKey:'living', location:'Living', quantity:16 }, { locationKey:'bedroom', location:'Bedroom', quantity:8 }] });
const book = { rooms: [{ rows: [{ guidedSelection: { requirementKey: 'interior-lighting', plumbingAllocation: { lines: [line] } } }] }] };
let updated = connectAllocatedSelectionsToQuotation(initial, book);
assert.equal(updated.quotation.ELECTRICAL.rows.length, 1);
assert.equal(updated.quotation.ELECTRICAL.rows[0].manualRate, 90);
assert.equal(updated.quotation.ELECTRICAL.rows[0].labourRate, 70);
assert.equal(updated.quotation.ELECTRICAL.rows[0].materialVariation, 240);
assert.equal(updated.procurement.items.length, 2);
assert.equal(updated.procurement.items[0].orderStatus, 'Ordered');
line.unitPrice = 33;
updated = connectAllocatedSelectionsToQuotation(updated, book);
assert.equal(updated.quotation.ELECTRICAL.rows.length, 1);
assert.equal(updated.quotation.ELECTRICAL.rows[0].manualRate, 100);
assert.equal(updated.procurement.items.length, 2);
updated = connectAllocatedSelectionsToQuotation(updated, { rooms: [] });
assert.equal(updated.quotation.ELECTRICAL.rows[0].manualRate, '');
assert.equal(updated.quotation.ELECTRICAL.rows[0].excelRate, 80);
assert.equal(updated.procurement.items.length, 1);
const unrelated = { id: 'allocated-selection:basin:keep', source: 'client-selections-allocated-product' };
const scoped = connectAllocatedSelectionsToQuotation({ ...initial, quotation: { ...initial.quotation, PLUMBING: { rows: [unrelated] } }, procurement: { items: [unrelated] } }, book, { servicesOnly: true });
assert.equal(scoped.quotation.PLUMBING.rows[0].id, unrelated.id);
assert(scoped.procurement.items.some(i => i.id === unrelated.id));
assert.equal(scoped.quotation.ELECTRICAL.rows[0].labourRate, 70);

const colours = read('AU-DULUX-COLOURS').colours;
const paints = catalogue.filter(p => p.supplier === 'Dulux');
assert(colours.length > 1000); assert(colours.every(c => /^#[a-f0-9]{6}$/i.test(c.hex) && c.code && c.sourceUrl));
const wall = paints.find(p => /Wash&Wear.*Low Sheen/.test(p.productName));
const white = colours.find(c => /Natural White/.test(c.name));
assert(wall && white);
const choice = { productCode: wall.productCode, colourId: white.id, finish: wall.attributes.availableFinishes[0] };
const scheme = newPaintScheme(); for (const s of ['walls','ceilings','skirting','doors']) scheme.defaults[s] = { ...choice };
assert(paintSchemeComplete(scheme, paints, colours));
scheme.overrides.push({ surface: 'walls', location: 'Study', choice: { ...choice, colourId: colours.find(c => /Domino/.test(c.name)).id } });
assert.equal(resolvePaintChoice(scheme,'walls','Bedroom').colourId, white.id);
assert.notEqual(resolvePaintChoice(scheme,'walls','Study').colourId, white.id);
const snapshot = JSON.parse(JSON.stringify(snapshotPaintScheme(scheme, paints, colours)));
assert(snapshot.defaults.walls.colourCode && snapshot.defaults.walls.productName);
assert.equal(paintLitres(100, 16, 2, 10), 13.76);
assert.equal(paintLitres(100, null, 2, 10), null);
const paintBook = { rooms:[{ rows:[{ guidedSelection:{ paintScheme:snapshot } }] }] };
const paintWorkbook = { quotation:{ 'PAINTING':{ rows:[{ id:'p1', item:'Internal wall painting', qty:100, unit:'M2', excelRate:25, labourRate:20, location:'Ground' }, { id:'p2', item:'Internal wall painting', qty:80, unit:'M2', excelRate:25, labourRate:20, location:'Upper' }] } } };
const painted = connectPaintSchemeToQuotation(paintWorkbook, paintBook);
assert.equal(painted.paintSchedule.reduce((n,r) => n+r.quantity,0),180);
assert.equal(painted.quotation.PAINTING.rows[1].labourRate,20);
assert.equal(painted.quotation.PAINTING.rows[1].excelRate,25);
assert.equal(connectPaintSchemeToQuotation(painted,paintBook).procurement.items.length,2);
const pricedChoice = { ...snapshot.defaults.walls, coverage: 10, coats: 2, wastePercent: 0, packageSku: 'test-10L',
  productSnapshot: { attributes: { variants: [{ sku: 'test-10L', size: '10L', price: { value: 110 } }] } } };
assert.equal(paintMaterialOrder(pricedChoice, 100).materialCostExGst, 200);
assert.equal(paintMaterialOrder(pricedChoice, 100, 'LM'), null);
const featureScheme = { ...snapshot, overrides: [], defaults: { walls: pricedChoice }, featureWalls: [{ id: 'study-feature', location: 'House', wall: 'North wall', areaM2: 10, choice: pricedChoice }] };
const featureBook = { rooms: [{ rows: [{ guidedSelection: { paintScheme: featureScheme } }] }] };
const featureWorkbook = { quotation: { PAINTING: { rows: [{ id: 'walls', item: 'Internal wall painting', qty: 100, unit: 'M2', excelRate: 25, materialRate: 5, labourRate: 20 }] } } };
const featured = connectPaintSchemeToQuotation(featureWorkbook, featureBook);
assert.equal(featured.paintSchedule[0].materialArea, 90);
assert.equal(featured.quotation.PAINTING.rows[0].manualRate, 22);
assert.equal(featured.quotation.PAINTING.rows[0].labourRate, 20);
assert.equal(featured.quotation.PAINTING.rows[1].labourRate, 0);
assert.equal(connectPaintSchemeToQuotation(featured, featureBook).quotation.PAINTING.rows.length, 2);
const inclusions = { selectedPackageId: 'base', packages: [{ id: 'base', paintScheme: { defaults: { walls: choice } } }] };
assert.equal(paintSchemeFromInclusions(inclusions, paints, colours).defaults.walls.productCode, wall.productCode);
const exterior = connectPaintSchemeToQuotation({ quotation: { PAINTING: { rows: [{ id: 'ext', item: 'External wall painting', qty: 80, unit: 'M2' }] } } }, featureBook);
assert.equal(exterior.paintSchedule[0].surface, 'external-walls');
console.log('PASS: catalogue discovery, regular pricing, fan filters, project rooms, quantities, quote replacement, labour, procurement, paint persistence and all-level areas');
