import assert from 'node:assert/strict';
import { getMasterProducts, toCanonicalProductContract } from '../lib/product-library/catalogueService.js';
import { EXTERIOR_CATALOGUE_SECTIONS, exteriorSectionForProduct } from '../lib/product-library/exteriorCatalogueSections.js';
import { getProductLibraryRoomCategories, getProductLibraryRoomCategory, productBelongsToRoomCategory, resolveQuotationBuilderMappingForProduct, resolveProductLibrarySectionForQuotationRow } from '../lib/product-library/productLibraryTaxonomy.js';

const master = getMasterProducts();
const before = JSON.stringify(master);
const exterior = getProductLibraryRoomCategories('exterior');
for (const key of ['gutters', 'fascia', 'downpipes', 'external-door-furniture', 'door-furniture']) assert(!exterior.some(c => c.key === key));
assert.equal(exterior.filter(c => c.key === 'roofing').length, 1);
assert.equal(exterior.find(c => c.key === 'entry-doors').name, 'Entry Doors & Door Furniture');
const counts = {};
for (const [parent, sections] of Object.entries(EXTERIOR_CATALOGUE_SECTIONS)) {
  const products = master.filter(p => productBelongsToRoomCategory(p, getProductLibraryRoomCategory(parent)));
  const grouped = sections.slice(1).flatMap(([key]) => {
    const records = products.filter(p => exteriorSectionForProduct(p, parent) === key);
    counts[`${parent}/${key}`] = records.length;
    for (const p of records) {
      assert.equal(resolveQuotationBuilderMappingForProduct(p).quotationSubsectionId, key);
      assert.equal(toCanonicalProductContract(p).quotationSubsectionId, key);
    }
    return records;
  });
  assert(products.length > 0);
  assert.equal(grouped.length, products.length);
  assert.equal(new Set(grouped.map(p => p.productId)).size, products.length);
}
for (const p of master.filter(p => p.familyKey === 'entry-door-furniture')) {
  assert(productBelongsToRoomCategory(p, getProductLibraryRoomCategory('entry-doors')));
  assert(!productBelongsToRoomCategory(p, getProductLibraryRoomCategory('door-furniture')));
  assert(!productBelongsToRoomCategory(p, getProductLibraryRoomCategory('cabinet-handles')));
}
for (const p of master.filter(p => productBelongsToRoomCategory(p, getProductLibraryRoomCategory('cabinet-handles')))) assert(!exteriorSectionForProduct(p, 'entry-doors'));
assert.equal(exteriorSectionForProduct({familyKey:'roofing',configuration:'gutters',productName:'Gutter for fascia system'},'roofing'),'gutters');
for (const [name, expected] of [['Smart entrance lock','smart-digital-locks'],['Mortice lock','mortice-locks'],['Deadbolt','deadbolts'],['Trilock entrance set','entrance-locksets'],['Pull handle','entrance-handles'],['Hinge','hinges'],['Door closer','door-closers']]) assert.equal(exteriorSectionForProduct({familyKey:'entry-door-furniture',productName:name},'entry-doors'),expected);
assert.equal(resolveProductLibrarySectionForQuotationRow({current_description:'Entrance door handle'}),'doors-door-furniture');
assert.equal(resolveProductLibrarySectionForQuotationRow({current_description:'Cabinet handle'}),'cabinetry-joinery');
assert.equal(JSON.stringify(master), before, 'Browsing must not mutate canonical products');
console.log(JSON.stringify({passed:true,counts}, null, 2));
