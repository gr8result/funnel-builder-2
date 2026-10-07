import fs from 'node:fs';
import {getEffectiveProductCatalogue} from '../../lib/product-library/catalogueService.js';
import {familyByKey, GENERIC_IMAGE_URLS, FAMILY_IMAGE_FALLBACKS} from '../../lib/product-library/catalogueModel.js';
import {applianceFallbackImage, productIsAppliance} from '../../lib/product-library/applianceCataloguePresentation.js';
import {productDisplayImage, productVerifiedImage} from '../../lib/product-library/productPresentation.js';

const GENERIC = new Set([...Object.values(GENERIC_IMAGE_URLS), ...Object.values(FAMILY_IMAGE_FALLBACKS)]);
const {products} = getEffectiveProductCatalogue({includeDisabled: true});

const gap = [];
for (const p of products) {
  const fam = familyByKey(p.familyKey);
  const verified = productVerifiedImage(p);
  const own = verified || p.primaryImageUrl || p.imageUrl || p.primaryImage || '';
  const famImage = fam?.image || '';
  // A product-specific image is one that is neither a family/generic fallback nor the appliance SVG.
  const isOwn = own && !GENERIC.has(own) && own !== famImage;
  if (isOwn) continue;
  gap.push({
    familyKey: p.familyKey || '', brand: p.brand || p.manufacturer || p.supplier || '',
    model: p.model || p.productCode || '', name: p.productName || '',
    rendered: productIsAppliance(p, fam) && !verified ? applianceFallbackImage(p, fam) : productDisplayImage(p, fam),
    productUrl: p.officialProductUrl || p.sourceUrl || p.productUrl || '',
  });
}
console.log('products showing something other than their own photo:', gap.length, 'of', products.length);
const by = (k) => { const m = new Map(); for (const g of gap) m.set(g[k] || '(none)', (m.get(g[k] || '(none)') || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
console.log('\n-- by family --'); for (const [f, n] of by('familyKey')) console.log(String(n).padStart(4), f);
console.log('\n-- by brand --'); for (const [b, n] of by('brand')) console.log(String(n).padStart(4), b);
console.log('\nwith an official product URL on record:', gap.filter(g => g.productUrl).length);
fs.writeFileSync('scripts/product-library/render-gap.json', JSON.stringify(gap, null, 2));
