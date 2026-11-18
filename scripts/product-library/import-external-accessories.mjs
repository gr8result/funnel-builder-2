// Explicit, repeatable import from manufacturer product feeds. No database writes.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const sources = [
  { brand: 'Hills', key: 'clothesline', type: 'Folding frame', model: 'Compact Folding Frame', finish: 'Powder coated galvanised steel', url: 'https://hillshome.com.au/products/compact-folding-frame-clothesline-strut' },
  { brand: 'Milkcan', key: 'letterbox', type: 'Parcel pillar', model: 'Monte Carlo', finish: 'Powder coat', url: 'https://www.milkcan.com.au/products/monte-carlo-parcel-pillar-letterbox-white' },
  { brand: 'Milkcan', key: 'letterbox', type: 'Parcel pillar', model: 'Monte Carlo', finish: 'Powder coat', url: 'https://www.milkcan.com.au/products/monte-carlo-parcel-pillar-letterbox' },
];
const products = [];
const verifiedAt = new Date().toISOString();
for (const source of sources) {
  const response = await fetch(`${source.url}.js`);
  assert(response.ok, `Manufacturer feed: ${response.status} ${source.url}`);
  const feed = await response.json();
  assert(feed.title && feed.variants?.length, 'Manufacturer product and variants required');
  for (const variant of feed.variants) {
    assert(variant.sku, 'Stable manufacturer SKU required');
    const code = `EXT-${source.brand.toUpperCase()}-${variant.sku}`;
    if (products.some(product => product.productCode === code)) continue;
    const imageSource = variant.featured_image?.src || feed.featured_image;
    assert(imageSource, `Manufacturer image required: ${code}`);
    const imageUrl = new URL(imageSource, source.url).href;
    const imageResponse = await fetch(imageUrl);
    assert(imageResponse.ok, `Manufacturer image: ${imageResponse.status}`);
    assert(imageResponse.headers.get('content-type')?.startsWith('image/'), 'Image response required');
    const extension = new URL(imageUrl).pathname.split('.').at(-1);
    assert(['jpg', 'jpeg', 'png', 'webp'].includes(extension), 'Supported image format required');
    const imagePath = `/images/catalogues/external-accessories/${code}.${extension}`;
    await fs.mkdir('public/images/catalogues/external-accessories', { recursive: true });
    await fs.writeFile(`public${imagePath}`, Buffer.from(await imageResponse.arrayBuffer()));
    products.push({ productCode: code, sku: variant.sku, model: source.model, manufacturer: source.brand, brand: source.brand, supplier: source.brand,
      productName: `${source.brand} ${source.model} ${source.key === 'clothesline' ? 'Clothesline' : 'Parcel Pillar Letterbox'} - ${variant.title}`,
      familyKey: source.key, requirementKeys: [source.key], categoryKey: 'external-accessories', subcategory: source.type, productType: source.type, topLevelArea: 'exterior',
      colour: variant.title, finish: source.finish, officialProductUrl: `${source.url}?variant=${variant.id}`, sourceUrl: source.url,
      sourceType: 'manufacturer_product_feed', sourceVerifiedAt: verifiedAt, sourceRetrievedAt: verifiedAt, lastImportedAt: verifiedAt,
      primaryImageUrl: imagePath, imageSourceUrl: imageUrl, imageStatus: 'verified_exact', imageVerifiedAt: verifiedAt,
      rrp: null, clientPrice: null, priceStatus: 'quote_required', priceUnit: 'EACH', currency: 'AUD', active: true,
      attributes: { clientSelectionRequirement: source.key, supplierAvailability: variant.available ? 'Confirm availability when ordering' : 'Supplier availability confirmation required',
        priceNote: 'Builder supply and installation quotation required. Retail product pricing is not an installed rate.',
        selectionFacets: { Type: source.type, Brand: source.brand, Colour: variant.title, Finish: source.finish } },
    });
  }
}
assert(products.some(p => p.familyKey === 'clothesline') && products.some(p => p.familyKey === 'letterbox'));
await fs.writeFile('data/product-library/catalogues/residential/AU-EXTERNAL-ACCESSORIES.json', `${JSON.stringify({ importedAt: verifiedAt, products }, null, 2)}\n`);
console.log(`Imported ${products.length} manufacturer variants with local images; installed prices require a quotation.`);
