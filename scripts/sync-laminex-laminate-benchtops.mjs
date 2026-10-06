import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Read-only manufacturer import. This writes local catalogue files only.
// A colour is one product; physical HPL sheet SKUs are variants. Sheet thickness
// must never be interpreted as the fabricated benchtop thickness.
const ORIGIN = 'https://www.laminex.com.au';
const LISTING = `${ORIGIN}/browse/product-application/benchtops`;
const EXTRA_SOURCES = ['https://www.laminex.com.au/products/carrara-bianco/Natural/p/AU1001548'];
const OUTPUT = path.resolve('data/product-library/catalogues/benchtops/AU-LAMINEX-LAMINATE-BENCHTOPS');
const CACHE = path.resolve('artifacts/catalogue-sources/laminex-laminate-benchtops');
const VERIFIED_AT = new Date().toISOString().slice(0, 10);
const offline = process.argv.includes('--offline');
const resume = process.argv.includes('--resume');
const decode = (value = '') => String(value).replace(/&amp;/g, '&').replace(/&quot;|&#034;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
const plain = (value = '') => decode(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')).trim();
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const absolute = (value) => new URL(decode(value), ORIGIN).href;
const unique = (values) => [...new Set(values)];
const digests = [];

async function get(url) {
  const cacheFile = path.join(CACHE, `${crypto.createHash('sha256').update(url).digest('hex')}.html`);
  let html;
  if (offline) html = await fs.readFile(cacheFile, 'utf8');
  else if (resume) html = await fs.readFile(cacheFile, 'utf8').catch(() => null);
  if (!html) {
    let failure;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, { headers: { 'user-agent': 'GR8-Result-verified-catalogue-import/1.0' }, signal: AbortSignal.timeout(45000) });
        if (!response.ok) throw new Error(`Manufacturer source returned HTTP ${response.status}: ${url}`);
        html = await response.text();
        break;
      } catch (error) { failure = error; }
    }
    if (!html) throw failure;
    await fs.mkdir(CACHE, { recursive: true });
    await fs.writeFile(cacheFile, html);
  }
  digests.push({ url, sha256: crypto.createHash('sha256').update(html).digest('hex') });
  return html;
}

function field(block, className) {
  return plain(block.match(new RegExp(`<[^>]+class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`))?.[1] || '');
}

function input(block, name) {
  return decode(block.match(new RegExp(`<input[^>]*name="${name}"[^>]*value="([^"]*)"`))?.[1] || '').trim();
}

function parseProduct(html, url) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const positions = [...clean.matchAll(/id="updateVariantDiv_(\d+)_([^"\s]+)"/g)];
  const hplPositions = positions.filter((match) => match[2] === 'PT_LXHLAMINATE');
  if (!hplPositions.length) throw new Error(`No manufacturer HPL SKU data: ${url}`);
  const canonicalUrl = decode(clean.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || url);
  const pageProductCode = canonicalUrl.match(/\/p\/([^/?]+)/)?.[1] || '';
  const colourCode = plain(clean.match(/class="product-color-code"[^>]*>Colour Code:\s*([^<]+)/)?.[1] || '');
  // Scope application evidence to the product content, after the site navigation.
  if (!/href="\/browse\/product-application\/benchtops"[^>]*>Benchtops<\/a>/.test(clean.slice(positions[0].index))) {
    throw new Error(`Product page does not confirm benchtop application: ${url}`);
  }
  const variants = [];
  for (const match of hplPositions) {
    const end = positions.find((next) => next.index > match.index)?.index ?? clean.length;
    const block = clean.slice(match.index, end);
    const sku = field(block, 'new-product-skucode');
    const brand = field(block, 'new-product-brand');
    const colourName = field(block, 'new-product-color');
    const finish = field(block, 'new-product-finish');
    const range = field(block, 'new-product-range');
    const size = input(block, 'sizeVal');
    const sheetThickness = input(block, 'thicknessVal');
    const substrate = input(block, 'substrateVal');
    const imageUrl = absolute(block.match(/<img src="([^"]+)"[^>]*alt=/)?.[1] || '');
    if (sku !== match[1] || brand !== 'Laminex' || !colourName || !finish || !size || !/^\d+(\.\d+)?$/.test(sheetThickness)) {
      throw new Error(`Incomplete or mismatched manufacturer SKU ${match[1]}: ${url}`);
    }
    // No prices are publicly published for these trade sheets. Sample/cart $0.00
    // is not a sheet price and is deliberately ignored.
    variants.push({
      id: `laminex-hpl-${sku}`, sku, productCode: sku, manufacturerProductId: pageProductCode,
      colourName, colourCode, range, finish, size, thickness: `${sheetThickness} mm`,
      thicknessMm: Number(sheetThickness), thicknessKind: 'laminate_sheet', substrate,
      face: input(block, 'faceVal'), imageUrl, officialImageUrl: imageUrl,
      sourceUrl: canonicalUrl, officialProductUrl: canonicalUrl,
      active: true, status: 'active', availabilityStatus: 'active',
      price: null, priceStatus: 'quote_required', verifiedAt: VERIFIED_AT,
    });
  }
  return variants;
}

async function main() {
  const listingHtml = await get(LISTING);
  const tiles = [...listingHtml.matchAll(/<a class="product__list--thumb" href="([^"]+)" title="([^"]+)"/g)];
  const urls = unique([...tiles.filter((match) => /Laminex Laminate \(HPL\)/.test(decode(match[2]))).map((match) => absolute(match[1])), ...EXTRA_SOURCES]);
  if (!urls.length) throw new Error('Manufacturer listing contains no Laminex HPL product links');
  const variants = [];
  // Limit concurrent reads and fail closed if any candidate source cannot verify.
  for (let offset = 0; offset < urls.length; offset += 3) {
    const result = await Promise.allSettled(urls.slice(offset, offset + 3).map(async (url) => parseProduct(await get(url), url)));
    for (const entry of result) {
      if (entry.status === 'rejected') throw entry.reason;
      variants.push(...entry.value);
    }
    console.log(`Verified ${Math.min(offset + 3, urls.length)}/${urls.length} Laminex HPL product pages`);
  }
  const bySku = new Map();
  for (const variant of variants) {
    if (bySku.has(variant.sku)) {
      const before = bySku.get(variant.sku);
      if (['colourName', 'finish', 'size', 'thickness'].some((key) => before[key] !== variant[key])) throw new Error(`Conflicting manufacturer SKU ${variant.sku}`);
    } else bySku.set(variant.sku, variant);
  }
  const groups = new Map();
  for (const variant of bySku.values()) {
    const key = `${variant.colourCode}|${variant.colourName}`;
    groups.set(key, [...(groups.get(key) || []), variant]);
  }
  const products = [...groups.values()].map((sheets) => {
    sheets.sort((a, b) => `${a.finish}|${a.size}|${a.sku}`.localeCompare(`${b.finish}|${b.size}|${b.sku}`));
    const first = sheets[0];
    const id = `LAMINEX-LAMINATE-BENCHTOP-${slug(first.colourName).toUpperCase()}`;
    return {
      id, productId: id, supplier: 'Laminex', brand: 'Laminex',
      productName: first.colourName, colourName: first.colourName, colourCode: first.colourCode,
      range: first.range, productRange: 'Laminex Laminate (HPL)', productFamily: 'Laminex Laminate (HPL)',
      material: 'laminate', materialType: 'High Pressure Laminate (HPL)', benchtopSuitability: true,
      application: 'Benchtops', applicableRooms: ['kitchen', 'butlers-pantry', 'laundry', 'bathroom', 'ensuite', 'powder-room', 'kitchenette'],
      finish: first.finish, finishes: unique(sheets.map((variant) => variant.finish)),
      // A colour does not have a universal physical-sheet SKU. Choose a variant
      // to save its exact SKU, sheet size and finish together.
      productCode: '', sku: '', manufacturerProductIds: unique(sheets.map((variant) => variant.manufacturerProductId)),
      sizes: unique(sheets.map((variant) => variant.size)),
      thicknessOptions: [], laminateSheetThicknessOptions: unique(sheets.map((variant) => variant.thickness)), thicknessKind: 'laminate_sheet',
      description: `Laminex ${first.colourName} high pressure laminate surface for benchtops. Sheet sizes, finishes and SKUs are recorded as manufacturer variants; fabricated top thickness is specified separately.`,
      imageUrl: first.imageUrl, officialImageUrl: first.officialImageUrl,
      sourceUrl: first.sourceUrl, officialProductUrl: first.sourceUrl, officialCatalogueUrl: LISTING,
      active: true, status: 'active', availabilityStatus: 'active',
      availabilityNote: 'Listed by Laminex Australia; local stock and lead times require supplier confirmation.',
      price: null, priceStatus: 'quote_required', pricingTier: 'supplier_quote_required',
      verifiedAt: VERIFIED_AT, source: 'Laminex Australia official benchtop application listing and HPL product pages',
      variants: sheets,
    };
  }).sort((a, b) => a.colourName.localeCompare(b.colourName));
  const catalogue = {
    title: 'Laminex Laminate Benchtop Surfaces (AU)', familyKey: 'laminex-laminate-benchtops', verifiedAt: VERIFIED_AT,
    scope: 'Verified subset of manufacturer HPL product pages exposed by the public benchtop listing, plus Carrara Bianco; not an exhaustive national stock catalogue.',
    products,
  };
  const report = {
    verifiedAt: VERIFIED_AT, sourceListingUrl: LISTING, publicListingTiles: tiles.length,
    verifiedHplProductPages: urls.length, rawProducts: products.length,
    manufacturerSheetVariants: bySku.size, duplicateSkuAppearancesRemoved: variants.length - bySku.size,
    uniqueColourNames: unique(products.map((product) => product.colourName)).length,
    uniqueFinishes: unique(products.flatMap((product) => product.finishes)),
    pricePolicy: 'No verified trade sheet prices published. All prices null, quote_required. Sample/cart zeroes ignored.',
    thicknessPolicy: 'Manufacturer dimensions are HPL sheet thickness; fabricated top thickness remains a separate specification.',
    availabilityPolicy: 'Active means present in the verified manufacturer catalogue, not confirmed warehouse stock.',
    scope: catalogue.scope,
    sourceEvidence: digests.sort((a, b) => a.url.localeCompare(b.url)),
    products: products.map((product) => ({ id: product.id, colourName: product.colourName, colourCode: product.colourCode, finishes: product.finishes, variants: product.variants.map(({ sku, finish, size, thickness, sourceUrl }) => ({ sku, finish, size, thickness, sourceUrl })) })),
  };
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(`${OUTPUT}.json`, `${JSON.stringify(catalogue, null, 2)}\n`);
  await fs.writeFile(`${OUTPUT}.js`, `// Generated by scripts/sync-laminex-laminate-benchtops.mjs from manufacturer sources.\nconst laminexLaminateBenchtops = ${JSON.stringify(catalogue, null, 2)};\n\nexport default laminexLaminateBenchtops;\n`);
  await fs.writeFile(`${OUTPUT}.report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ products: products.length, manufacturerSheetVariants: bySku.size, output: OUTPUT }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
