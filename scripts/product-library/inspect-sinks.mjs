import {getEffectiveProductCatalogue} from '../../lib/product-library/catalogueService.js';
import {familyByKey} from '../../lib/product-library/catalogueModel.js';
import {productDisplayImage, productVerifiedImage} from '../../lib/product-library/productPresentation.js';
const {products} = getEffectiveProductCatalogue({includeDisabled: true});
for (const fam of ['kitchen-sinks','kitchen-sink-mixers','tapware']) {
  const rows = products.filter(p => p.familyKey === fam);
  console.log('='.repeat(70));
  console.log(fam, rows.length);
  for (const p of rows) {
    console.log('  ', (p.brand||'').padEnd(14), (p.model||p.productCode||'').padEnd(22),
      (p.clientPrice!=null?('$'+p.clientPrice):(p.priceStatus||'')).padEnd(12),
      'verified:', productVerifiedImage(p) ? 'Y' : 'n',
      '| renders:', (productDisplayImage(p, familyByKey(p.familyKey))||'(none)').slice(0,72));
  }
}
