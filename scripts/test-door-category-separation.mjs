import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getMasterProducts, getEffectiveProductCatalogue, addBuilderProduct, setCatalogueStorage} from '../lib/product-library/catalogueService.js';
import {getProductLibraryRoomCategory, productBelongsToRoomCategory, resolveQuotationBuilderMappingForProduct} from '../lib/product-library/productLibraryTaxonomy.js';
import {masterProductMatchesFilters} from '../lib/product-library/productLibraryFilters.js';
import {filterProductsForProductLibraryExchange, productToExchangeRow, PRODUCT_LIBRARY_EXCHANGE_COLUMNS} from '../lib/product-library/productLibraryExchange.js';
import {exteriorSectionForProduct} from '../lib/product-library/exteriorCatalogueSections.js';

const master = getMasterProducts();
const snapshot = JSON.stringify(master);
const doors = master.filter(p => p.familyKey === 'entry-doors');
const hardwareCategory = getProductLibraryRoomCategory('external-door-furniture');
const doorCategory = getProductLibraryRoomCategory('entry-doors');
const hardware = master.filter(p => productBelongsToRoomCategory(p, hardwareCategory));
assert.equal(doors.length, 148);
assert.equal(doors.filter(p => p.attributes.recordType === 'entry_door_design').length, 142);
assert.equal(hardware.length, 306);
assert.equal(getProductLibraryRoomCategory('door-furniture', 'exterior'), hardwareCategory);
assert.notEqual(getProductLibraryRoomCategory('door-furniture', 'internal-areas'), hardwareCategory);

for (const product of doors) {
  assert(productBelongsToRoomCategory(product, doorCategory));
  assert(!productBelongsToRoomCategory(product, hardwareCategory), product.productName);
  assert.equal(exteriorSectionForProduct(product, 'external-door-furniture'), '');
  assert.equal(resolveQuotationBuilderMappingForProduct(product).quotationSubsectionId, 'entry-doors');
}
for (const product of hardware) {
  assert(!productBelongsToRoomCategory(product, doorCategory), product.productName);
  assert.equal(exteriorSectionForProduct(product, 'entry-doors'), '');
  assert(!/corinthian|hume|door leaf/i.test(`${product.productName} ${product.manufacturer}`));
  assert.notEqual(product.attributes.recordType, 'entry_door_design');
  const row = productToExchangeRow(product);
  assert.equal(row[PRODUCT_LIBRARY_EXCHANGE_COLUMNS.indexOf('category_id')], 'external-door-furniture');
}
for (const name of ['BAL 29 Rural PRU 21', 'Blonde Oak AWO 2', 'Blonde Oak AWO 2G', 'Blonde Oak AWO 5', 'Blonde Oak AWO 21', 'Classic PCL 1AG', 'Deco White Oak Entrance EXADECO 1S']) {
  const product = doors.find(p => p.productName === `Corinthian ${name}`);
  assert(product, name);
  assert(masterProductMatchesFilters(product, {category:'entry-doors', room:'exterior', search:name}));
  assert(!masterProductMatchesFilters(product, {category:'external-door-furniture', room:'exterior', search:name}));
  assert(!masterProductMatchesFilters(product, {category:'door-furniture', room:'exterior', search:name}));
}
const codes = products => products.map(p => p.productCode).sort();
for (const [category, expected] of [['entry-doors', doors], ['external-door-furniture', hardware]]) {
  assert.deepEqual(codes(master.filter(p => masterProductMatchesFilters(p,{category, room:'exterior'}))), codes(expected));
  assert.deepEqual(codes(getEffectiveProductCatalogue({categoryKey:category, roomKey:'exterior'}).products), codes(expected));
  assert.deepEqual(codes(filterProductsForProductLibraryExchange(master,{scope:'all',categoryId:category})), codes(expected));
}
assert.deepEqual(codes(getEffectiveProductCatalogue({categoryKey:'door-furniture',roomKey:'exterior'}).products), codes(hardware));
assert(hardware.some(p => /Gainsborough/i.test(p.brand) && /pull/i.test(p.productName)));
assert.equal(new Set([...doors,...hardware].map(p => p.productId)).size, doors.length + hardware.length);

// Imports with a broad/stale category label still query by their actual family.
const memory = new Map();
setCatalogueStorage({getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)});
addBuilderProduct('door-category-test', {productCode:'TEST-EXTERIOR-LEAF',familyKey:'entry-doors',categoryKey:'external-door-furniture',productName:'Custom exterior door leaf',topLevelArea:'exterior',active:true});
addBuilderProduct('door-category-test', {productCode:'TEST-EXTERIOR-HINGE',familyKey:'door-hardware',categoryKey:'Entry Doors',productName:'Exterior door hinge',topLevelArea:'exterior',attributes:{handleUse:'entry-door'},active:true});
assert(getEffectiveProductCatalogue({organisationId:'door-category-test',categoryKey:'entry-doors'}).products.some(p=>p.productCode==='TEST-EXTERIOR-LEAF'));
assert(!getEffectiveProductCatalogue({organisationId:'door-category-test',categoryKey:'external-door-furniture'}).products.some(p=>p.productCode==='TEST-EXTERIOR-LEAF'));
assert(getEffectiveProductCatalogue({organisationId:'door-category-test',categoryKey:'external-door-furniture'}).products.some(p=>p.productCode==='TEST-EXTERIOR-HINGE'));
assert(!getEffectiveProductCatalogue({organisationId:'door-category-test',categoryKey:'entry-doors'}).products.some(p=>p.productCode==='TEST-EXTERIOR-HINGE'));
assert.equal(JSON.stringify(getMasterProducts()),snapshot,'No product data or IDs changed');
if (process.argv.includes('--compare-before')) {
  const before = JSON.parse(fs.readFileSync('tmp/door-category-before.json','utf8'));
  assert.deepEqual(master,before.master,'Every imported product field must remain unchanged');
}
console.log(JSON.stringify({passed:true,audited:master.length,entryDoorRecords:doors.length,completeDoorDesigns:142,hardware:hardware.length,overlap:0,duplicatesCreated:0,uncertain:[]},null,2));
