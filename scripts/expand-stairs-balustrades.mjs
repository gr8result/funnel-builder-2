import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const out = 'data/product-library/catalogues/internal/AU-INTERNAL-SYSTEMS-CATALOGUE.json';
const media = '/images/product-library/stairs';
const dir = 'data/product-library/source-evidence/stair-workflow';
const quote = { priceAdjustment: null, pricingStatus: 'quote_required', availabilityStatus: 'Supplier confirmation required', active: true };

async function download(url) {
  const local = `${media}/${createHash('sha256').update(url).digest('hex').slice(0, 18)}.jpg`;
  try {
    await fs.access('public' + local);
  } catch {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(res.status + ' ' + url);
    await fs.writeFile('public' + local, Buffer.from(await res.arrayBuffer()));
  }
  const { default: sharp } = await import('sharp');
  const meta = await sharp('public' + local).metadata();
  if (meta.width < 80) throw new Error('Invalid sample ' + url);
  return local;
}

const catalogue = JSON.parse(await fs.readFile(out, 'utf8'));
const stairProducts = catalogue.products.filter((p) => p.attributes?.completeStairCatalogue === true);
if (!stairProducts.length) throw new Error('No complete stair products found.');

// ---- 1. New stair construction types (products) ----
const existingCodes = new Set(stairProducts.map((p) => p.product_code));
const stairOptionsTemplate = stairProducts[0].attributes.stairOptions;

const newStairs = [
  {
    id: 'traditional-stringer',
    name: 'Traditional stringer stair',
    treatment: 'Traditional cut stringer with closed risers; timber treads to selected species.',
    image: {
      url: 'https://stairlock.com.au/wp-content/uploads/2026/06/traditional-stringer-design-option-card-1600x1200.jpg',
      sourceUrl: 'https://stairlock.com.au/products/custom-staircases/',
    },
    speciesIds: stairOptionsTemplate.species.map((s) => s.id),
    finishIds: ['clear', 'stained', 'raw', 'paint'],
    configurationIds: ['straight', 'l-shaped', 'u-shaped', 'winder'],
    requiresExposedTimberSpecies: true,
  },
  {
    id: 'semi-cantilever',
    name: 'Semi-cantilever stair',
    treatment: 'Semi-cantilevered timber treads; partially concealed support structure.',
    image: {
      url: 'https://stairlock.com.au/wp-content/uploads/2026/06/semi-cantilever-custom-staircase-render-1600x1200.jpg',
      sourceUrl: 'https://stairlock.com.au/products/custom-staircases/',
    },
    speciesIds: stairOptionsTemplate.species.map((s) => s.id),
    finishIds: ['clear', 'stained', 'raw'],
    configurationIds: ['straight', 'l-shaped'],
    requiresExposedTimberSpecies: true,
  },
  {
    id: 'cut-stringer-closed',
    name: 'Cut stringer (closed riser)',
    treatment: 'Cut stringer profile with closed risers; exposed timber treads.',
    image: {
      url: 'https://stairlock.com.au/wp-content/uploads/2026/06/closed-riser-design-options-1600x1200.jpg',
      sourceUrl: 'https://stairlock.com.au/products/custom-staircases/',
    },
    speciesIds: stairOptionsTemplate.species.map((s) => s.id),
    finishIds: ['clear', 'stained', 'raw'],
    configurationIds: ['straight', 'l-shaped', 'u-shaped', 'winder'],
    requiresExposedTimberSpecies: true,
  },
];

for (const spec of newStairs) {
  const code = 'INT-STAIR-COMPLETE-' + spec.id.toUpperCase();
  if (existingCodes.has(code)) continue;
  const imageUrl = await download(spec.image.url);
  catalogue.products.push({
    product_code: code,
    product_id: 'master-' + code,
    manufacturer_identity: 'builder:complete-stair:' + spec.id,
    manufacturer: 'Custom stair supplier',
    brand: 'Custom Stairs',
    supplier: 'Builder nominated supplier',
    product_name: spec.name,
    model: code,
    range: 'Complete stair options',
    family_key: 'stairs',
    requirement_keys: ['stairs'],
    top_level_area: 'interior',
    category_key: 'Stairs',
    description: `Complete made-to-measure ${spec.name.toLowerCase()}. Select the plan configuration, site dimensions, timber/finish, balustrade and handrail before requesting pricing.`,
    finish: 'To selected configuration',
    price_unit: 'SET',
    unit: 'SET',
    client_price: null,
    rrp: null,
    price_status: 'quote_required',
    primary_image_url: imageUrl,
    image_source_url: spec.image.url,
    image_status: 'verified_range',
    image_verified_at: new Date().toISOString(),
    official_product_url: spec.image.sourceUrl,
    source_url: spec.image.sourceUrl,
    source_type: 'official_supplier_design_reference',
    source_name: 'Stairlock official design reference',
    source_retrieved_at: new Date().toISOString(),
    active: true,
    archived: false,
    attributes: {
      internalAreasCatalogue: true,
      manufacturerIdentity: 'builder:complete-stair:' + spec.id,
      completeStairCatalogue: true,
      constructionType: spec.id,
      requiresExposedTimberSpecies: spec.requiresExposedTimberSpecies,
      constructionLabel: spec.name,
      catalogueSection: spec.id,
      speciesIds: spec.speciesIds,
      finishIds: spec.finishIds,
      configurationIds: spec.configurationIds,
      treadRiserTreatment: spec.treatment,
      stairOptions: stairOptionsTemplate,
      applicableRooms: ['internal-areas'],
      clientSelectable: true,
      quotationEnabled: true,
      pricingMode: 'quote_required',
      upgradePrices: [],
      imageScope: 'Supplier design reference for complete construction; final configuration may differ.',
      imageSources: [{ url: imageUrl, sourceUrl: spec.image.url }],
      imageVerificationStatus: 'verified_range',
      priceNote: 'Project-specific quote required. Builder allowance or starting price may be set in Product Library.',
    },
  });
  console.log('added stair product', code);
}

// ---- 2. New balustrade options (LM rates) ----
// Rates are builder estimating allowances, AUD ex GST per LM.
const balRates = {
  'frameless-glass-side-fixed': 650,
  'vertical-wire': 380,
  'powder-coated-aluminium-flat-bar': 375,
  'stainless-steel-post-wire': 425,
  'glass-standoff-pin-fixed': 750,
};

const newBalustrades = [
  {
    id: 'frameless-glass-side-fixed',
    name: 'Frameless glass – side/fascia fixed',
    handrailMaterialIds: ['none', 'timber', 'stainless'],
    image: {
      url: 'https://stairlock.com.au/wp-content/uploads/2026/06/example-glass-balustrade-design-option-900x675.jpg',
      sourceUrl: 'https://stairlock.com.au/products/custom-staircases/',
    },
  },
  {
    id: 'vertical-wire',
    name: 'Vertical stainless steel wire',
    handrailMaterialIds: ['timber', 'stainless'],
    image: {
      url: 'https://stairpro.com.au/sites/default/files/imagecache/Lightbox/Bal1.jpg',
      sourceUrl: 'https://stairpro.com.au/balustrading-gallery',
    },
  },
  {
    id: 'powder-coated-aluminium-flat-bar',
    name: 'Powder-coated aluminium flat bar balusters',
    handrailMaterialIds: ['aluminium', 'timber'],
    image: {
      url: 'https://stairpro.com.au/sites/default/files/imagecache/Lightbox/Bal2.jpg',
      sourceUrl: 'https://stairpro.com.au/balustrading-gallery',
    },
  },
  {
    id: 'stainless-steel-post-wire',
    name: 'Stainless steel posts + horizontal wire',
    handrailMaterialIds: ['stainless'],
    image: {
      url: 'https://stairpro.com.au/sites/default/files/imagecache/Lightbox/Bal3.jpg',
      sourceUrl: 'https://stairpro.com.au/balustrading-gallery',
    },
  },
  {
    id: 'glass-standoff-pin-fixed',
    name: 'Frameless glass – standoff/pin fixed',
    handrailMaterialIds: ['none', 'stainless'],
    image: {
      url: 'https://stairpro.com.au/sites/default/files/imagecache/Lightbox/Bal5.jpg',
      sourceUrl: 'https://stairpro.com.au/balustrading-gallery',
    },
  },
];

for (const product of catalogue.products.filter((p) => p.attributes?.completeStairCatalogue === true)) {
  const options = product.attributes.stairOptions;
  if (!options?.balustrades) continue;
  const have = new Set(options.balustrades.map((b) => b.id));
  for (const spec of newBalustrades) {
    if (have.has(spec.id)) continue;
    const imageUrl = await download(spec.image.url);
    const rate = balRates[spec.id];
    options.balustrades.push({
      id: spec.id,
      name: spec.name,
      handrailMaterialIds: spec.handrailMaterialIds,
      ...quote,
      pricingStatus: rate != null ? 'builder_estimating_allowance' : 'quote_required',
      imageUrl,
      sourceUrl: spec.image.sourceUrl,
      imageSourceUrl: spec.image.url,
      imageStatus: 'verified_range',
      imageScope: 'Design reference; dimensions and details are project-specific.',
      familyKey: 'balustrades',
      canonicalOptionId: 'stair-balustrade:' + spec.id,
      applicableRequirements: ['stairs'],
      ...(rate != null
        ? {
            allowanceRate: rate,
            allowanceUnit: 'LM',
            priceIncludesGst: false,
            priceSource: 'Builder-supplied Queensland estimating allowance, 2026-09-08',
            quotationItem: 'BALUSTRADE',
            includesStandardHandrail: true,
          }
        : {}),
    });
  }
}

catalogue.updatedAt = new Date().toISOString();
await fs.writeFile(out, JSON.stringify(catalogue, null, 2) + '\n');
console.log('done. products:', catalogue.products.length, 'stair products:', catalogue.products.filter((p) => p.attributes?.completeStairCatalogue === true).length);
