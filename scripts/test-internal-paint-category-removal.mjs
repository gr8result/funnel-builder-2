import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PRODUCT_LIBRARY_ROOM_CATEGORIES, PRODUCT_LIBRARY_ROOMS, getProductLibraryRoomCategory, getProductLibraryRoomCategories, productBelongsToRoom, resolveProductLibrarySectionForFamily } from '../lib/product-library/productLibraryTaxonomy.js';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';
import { normalizeMasterProductRecord } from '../lib/product-library/catalogueModel.js';
import { filterProductsForProductLibraryExchange } from '../lib/product-library/productLibraryExchange.js';
import { mapDbProductToEntity } from '../lib/product-library/productLibraryDbMapper.js';
import { previewBuilderCsv } from '../lib/product-library/builderCsvImport.js';
import { ALL_GUIDED_REQUIREMENTS, productsForRequirement } from '../lib/builders/clientSelectionWorkflow.js';
import { readJob, writeJob } from '../lib/jobFile.ts';

const products = getMasterProducts();
assert.equal(getProductLibraryRoomCategory('internal-paint-colours'), null);
assert(!PRODUCT_LIBRARY_ROOM_CATEGORIES.some(category => /internal.paint.colours/i.test(`${category.key} ${category.name}`)));
for (const room of PRODUCT_LIBRARY_ROOMS) {
  const categories = getProductLibraryRoomCategories(room.key);
  assert(categories.every(category => category.key && category.name));
  assert(!categories.some(category => category.key === 'internal-paint-colours'));
}
for (const category of ['flooring', 'internal-doors', 'lighting', 'exterior-paint-colours', 'tiles']) assert(getProductLibraryRoomCategory(category));
console.log('PASS category, room tiles, navigation/filter/export options removed; adjacent categories remain');

const raw = JSON.parse(await fs.readFile('data/product-library/catalogues/residential/AU-DULUX-PAINT.json', 'utf8')).products;
for (const record of raw) {
  const product = products.find(product => product.productCode === record.productCode);
  assert(product, record.productCode);
  assert.deepEqual(product.attributes.variants, record.attributes.variants);
  if (record.familyKey === 'paint') {
    assert.equal(product.categoryKey, 'Painting Materials');
    assert(!product.requirementKeys.includes('interior-paint'));
    for (const room of ['bedrooms', 'living-areas', 'internal-areas']) assert.equal(productBelongsToRoom(product, room), false);
  }
}
assert.equal(resolveProductLibrarySectionForFamily('paint').key, 'painting');
assert.deepEqual(filterProductsForProductLibraryExchange(products, { categoryId: 'internal-paint-colours' }), []);
assert.equal(normalizeMasterProductRecord({ productCode: 'legacy', familyKey: 'paint', categoryKey: 'Internal Paint Colours' }).categoryKey, 'Painting Materials');
assert.equal(mapDbProductToEntity({ id: 'legacy', metadata: { productEntity: { category: 'Internal Paint Colours' } } }).category, 'Painting Materials');
assert.equal(previewBuilderCsv({ workspaceId: 'builder-a', csv: 'Supplier,SKU,Product,Category,Selection Slot\nDulux,white,White,Internal Paint Colours,wall_tile' }).rows[0].action, 'INVALID');
console.log(`PASS ${raw.length} Dulux material records and package pricing retained; legacy category mapped safely; obsolete CSV category rejected`);

const requirement = ALL_GUIDED_REQUIREMENTS.find(row => row.requirementKey === 'interior-paint');
assert.equal(requirement.label, 'Internal Paint Colours');
assert.deepEqual(productsForRequirement(products, requirement), []);
const scheme = { defaults: { walls: { productCode: 'old-paint-id', colourName: 'Natural White', colourCode: 'SW1F4', hex: '#eeeadd', finish: 'Low Sheen' } }, featureWalls: [{ location: 'Ensuite', wall: 'North wall', choice: { colourName: 'Blue', colourCode: 'BLUE1', finish: 'Low Sheen' } }] };
const workbook = { jobId: '33333333-3333-4333-8333-333333333333', workspaceId: 'builder-a', clientSelectionsBook: { rooms: [{ rows: [{ guidedSelection: { requirementKey: 'interior-paint', paintScheme: scheme, categoryKey: 'internal-paint-colours' } }] }] }, quotation: { PAINTING: { rows: [{ id: 'paint', quantity: 100, excelRate: 25 }] } } };
let bytes;
const handle = { name: 'legacy-paint.gr8job', getFile: async () => new File(bytes ? [bytes] : [], 'legacy-paint.gr8job'), createWritable: async () => ({ write: async blob => { bytes = await blob.arrayBuffer(); }, close: async () => {} }) };
assert.equal((await writeJob(handle, { jobId: workbook.jobId, jobName: 'Legacy paint', workbook })).ok, true);
const saved = (await readJob(handle)).workbook;
assert.deepEqual(saved.clientSelectionsBook, workbook.clientSelectionsBook);
assert.deepEqual(saved.quotation, workbook.quotation);

const require = createRequire(import.meta.url), ts = require('typescript');
const source = await fs.readFile('components/client-selections/InternalPaintColourSpecification.jsx', 'utf8');
assert(!source.includes('catalogueService'));
const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const module = { exports: {} };
// The page reads colours from the colour library and its rules from the paint colour model.
const pageLibraries = { '../../lib/builders/duluxColourLibrary.js': await import('../lib/builders/duluxColourLibrary.js'), '../../lib/builders/internalPaintColours.js': await import('../lib/builders/internalPaintColours.js'),
  '../../lib/builders/paintStandards.js': await import('../lib/builders/paintStandards.js') };
new Function('require', 'module', 'exports', output)(name => pageLibraries[name] || require(name), module, module.exports);
const html = require('react-dom/server').renderToStaticMarkup(require('react').createElement(module.exports.default, { selection: { selected_details: { paintScheme: scheme } } }));
for (const text of ['Internal Paint Colours', 'Natural White', 'SW1F4', 'Ensuite', 'BLUE1']) assert(html.includes(text));
assert(!html.includes('old-paint-id')); assert(!html.includes('Paint product'));
assert(!/will be added here next/i.test(html), 'the page is the colour selection module, not a placeholder');
require('react-dom/server').renderToStaticMarkup(require('react').createElement(module.exports.default, {}));
console.log('PASS Client Selections opens without products; saved swatches/specifications and .gr8job painting prices survive');
