// Guard: every Product Library / selection card resolves to a real image src.
// Run: node --import ./scripts/register-json-loader.mjs scripts/test-product-library-image-coverage.mjs
//
// Cards render through ProductLibraryProductImage. Before this guard existed,
// appliances without a verified shot fell through to a text-only tile, so 96
// products (20 of the 31 cooktops among them) showed no image at all.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getEffectiveProductCatalogue} from '../lib/product-library/catalogueService.js';
import {familyByKey} from '../lib/product-library/catalogueModel.js';
import {applianceFallbackImage, productIsAppliance} from '../lib/product-library/applianceCataloguePresentation.js';
import {productDisplayImage, productVerifiedImage} from '../lib/product-library/productPresentation.js';

// Mirrors the branch order in components/product-library/ProductLibraryProductImage.jsx.
function renderedImageSrc(product) {
  const family = familyByKey(product.familyKey);
  const verified = productVerifiedImage(product);
  if (product.attributes?.internalAreasCatalogue) return verified || productDisplayImage(product, family);
  if (verified) return verified;
  if (productIsAppliance(product, family)) return applianceFallbackImage(product, family);
  return productDisplayImage(product, family);
}

const products = getEffectiveProductCatalogue({includeDisabled: true}).products;
assert(products.length > 2000, 'catalogue did not load');

const localPaths = new Set();
for (const product of products) {
  const src = renderedImageSrc(product);
  assert(src, `no image src for ${product.familyKey} / ${product.productCode} / ${product.productName}`);
  if (src.startsWith('/')) localPaths.add(src.split('?')[0]);
}
for (const path of localPaths) assert(fs.existsSync(`public${decodeURI(path)}`), `missing file public${path}`);

// Every appliance family must own a category illustration; none may collapse to
// the generic tile by accident, and the files must ship in public/.
for (const familyKey of ['ovens', 'cooktops', 'rangehoods', 'dishwashers', 'freestanding-cookers', 'microwaves', 'fridges', 'appliance-packs']) {
  const src = applianceFallbackImage({familyKey});
  assert(src.endsWith(`/${familyKey === 'fridges' ? 'refrigerator' : familyKey.replace(/s$/, '')}.svg`) || src.includes(familyKey), `${familyKey} has no category illustration`);
  assert(fs.existsSync(`public${src}`), `missing file public${src}`);
}

// components/product-library/InternalCataloguePicker.jsx renders the interior
// selection cards straight from the record, so its src must resolve too.
const internalProducts = products.filter((p) => p.attributes?.internalAreasCatalogue);
assert(internalProducts.length > 500, 'internal-areas catalogue did not load');
for (const product of internalProducts) {
  const src = product.imageUrl || product.primaryImageUrl || productDisplayImage(product, familyByKey(product.familyKey));
  assert(src, `internal picker has no image src for ${product.productCode} / ${product.productName}`);
  if (src.startsWith('/')) assert(fs.existsSync(`public${decodeURI(src.split('?')[0])}`), `missing file public${src}`);
}

const applianceFallbacks = products.filter((p) => !productVerifiedImage(p) && !p.attributes?.internalAreasCatalogue && productIsAppliance(p, familyByKey(p.familyKey)));
console.log(JSON.stringify({passed: true, products: products.length, localImages: localPaths.size, internalPickerProducts: internalProducts.length, applianceCategoryFallbacks: applianceFallbacks.length}));
