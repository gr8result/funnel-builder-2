import fs from 'node:fs';
import {getEffectiveProductCatalogue} from '../../lib/product-library/catalogueService.js';
import {familyByKey} from '../../lib/product-library/catalogueModel.js';
import {productVerifiedImage} from '../../lib/product-library/productPresentation.js';
const {products} = getEffectiveProductCatalogue({includeDisabled: true});
const rows = [];
for (const p of products.filter(p => ['cooktops','rangehoods'].includes(p.familyKey))) {
  const v = productVerifiedImage(p);
  rows.push({fam:p.familyKey, brand:p.brand||p.manufacturer, model:p.model||p.productCode, name:p.productName,
    img: v || p.primaryImageUrl || p.primaryImage || '', code:p.productCode, src:p.sourceName||p.approvedSourceKey||''});
}
const missing = rows.filter(r=>!r.img);
console.log('cooktops+rangehoods:',rows.length,'| missing image:',missing.length);
for (const r of missing) console.log(`${r.fam.padEnd(11)} ${String(r.brand).padEnd(14)} ${String(r.model).padEnd(20)} ${r.name}`);
fs.writeFileSync('scripts/product-library/ck-rh-gap.json', JSON.stringify(missing,null,2));
