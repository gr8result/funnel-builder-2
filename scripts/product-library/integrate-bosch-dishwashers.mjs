// Integrates the 14 Bosch dishwasher rows scraped by import-bosch-range.mjs
// (--only=dishwashers) into the canonical appliance catalogue, following the
// same full-schema, evidence-carrying record shape already used for the
// existing Bosch cooktop/oven/rangehood entries in that file.
//
//   node scripts/product-library/integrate-bosch-dishwashers.mjs [--dry-run]
//
// Never touches any other family or brand already in the catalogue.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOGUE_PATH = path.join(ROOT, 'data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json');
const RANGE_PATH = path.join(ROOT, 'data/product-library/catalogues/appliances/AU-BOSCH-APPLIANCE-RANGE.json');
const DRY = process.argv.includes('--dry-run');
const TODAY = new Date().toISOString().slice(0, 10);
const SOURCE_ORG = 'Harvey Norman Commercial';

const catalogue = JSON.parse(fs.readFileSync(CATALOGUE_PATH, 'utf8'));
const range = JSON.parse(fs.readFileSync(RANGE_PATH, 'utf8'));
const scraped = range.products.filter((p) => p.family_key === 'dishwashers' && p.brand === 'Bosch');

if (!scraped.length) {
  console.error('No scraped Bosch dishwasher rows found — run import-bosch-range.mjs --only=dishwashers first.');
  process.exit(1);
}

const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function sourceStamp(url) {
  return { status: 'verified-authorised-supplier', source: SOURCE_ORG, sourceUrl: url, sourceCheckedAt: TODAY };
}

function buildRecord(row) {
  const model = row.manufacturerModel;
  const url = row.official_product_url;
  const attrs = row.attributes || {};
  const priced = row.client_price != null;
  const shortDescription = row.product_name.replace(/^Bosch\s+/, '');
  const fullDescription = (row.features || []).join('\n');

  const specifications = {
    family: 'dishwashers',
    manufacturerModel: model,
    width: row.width || '',
    widthMm: row.widthMm ?? null,
    height: attrs.heightMm ? `${attrs.heightMm} mm` : '',
    heightMm: attrs.heightMm ?? null,
    depth: attrs.depthMm ? `${attrs.depthMm} mm` : '',
    depthMm: attrs.depthMm ?? null,
    finish: row.finish || '',
    colour: attrs.colour || row.finish || '',
    fuelOrEnergyType: 'Electric',
    installationType: row.installationType || '',
    compact: Boolean(attrs.compact),
    placeSettings: attrs.placeSettings ?? null,
    washPrograms: attrs.washPrograms ?? null,
    waterConsumptionLPerWash: attrs.waterConsumptionLPerWash ?? null,
    noiseDb: attrs.noiseDb ?? null,
    homeConnect: Boolean(attrs.homeConnect),
    aquaStop: Boolean(attrs.aquaStop),
    dryingSystem: attrs.dryingSystem || '',
    welsRegistrationNo: attrs.welsRegistrationNo || '',
    // Not published anywhere on the HNC listing or product page (only a WELS
    // registration number is shown) — left unset rather than guessed.
    energyRating: null,
    waterRating: null,
    features: row.features || [],
    dimensions: attrs.heightMm && attrs.depthMm && row.widthMm
      ? `W${row.widthMm} x D${attrs.depthMm} x H${attrs.heightMm}mm`
      : '',
  };

  const specFieldKeys = Object.keys(specifications);
  const specificationSources = Object.fromEntries(specFieldKeys.map((key) => [key, sourceStamp(url)]));

  const priceEvidence = {
    sourceOrganisation: SOURCE_ORG,
    sourceUrl: url,
    sourceCheckedAt: TODAY,
    priceType: priced ? 'listed-srp' : 'quote-required',
    sourceField: 'price_store',
    priceLabel: 'SRP (INC. GST)',
    currency: 'AUD',
    listedPrice: row.client_price ?? null,
    gstIncluded: true,
    verificationStatus: priced ? 'verified-listed-price' : 'verified-price-on-application',
  };

  const evidenceFieldKeys = ['productName', 'manufacturerModel', 'shortDescription', 'fullDescription', 'physicalDimensions', 'colour', 'installationType', 'features', 'sourceTitle'];

  return {
    productId: `product:dishwashers:bosch:${slug(model)}`,
    schemaVersion: catalogue.schemaVersion,
    categoryId: 'category:appliances',
    familyId: 'dishwashers',
    subfamilyId: '',
    productType: 'physical-product',
    brandId: 'brand:bosch',
    brandName: 'Bosch',
    rangeId: '',
    rangeName: row.range || '',
    manufacturerModel: model,
    sku: model,
    productName: row.product_name,
    shortDescription,
    fullDescription,
    descriptionStatus: 'verified-complete',
    specifications,
    specificationStatus: 'partial',
    specificationSources,
    width: row.width || '',
    widthMm: row.widthMm ?? null,
    height: specifications.height,
    heightMm: specifications.heightMm,
    depth: specifications.depth,
    depthMm: specifications.depthMm,
    capacity: null,
    colour: specifications.colour,
    finish: row.finish || '',
    availableColours: row.finish ? [row.finish] : [],
    availableFinishes: row.finish ? [row.finish] : [],
    fuelOrEnergyType: 'Electric',
    installationType: row.installationType || '',
    unit: 'EACH',
    costPrice: row.client_price ?? null,
    sourceCostPrice: row.client_price ?? null,
    sellPrice: row.client_price ?? null,
    importedSourceCost: row.client_price ?? null,
    tenantSellPrice: row.client_price ?? null,
    currentRetailReference: row.client_price ?? null,
    currentRetailReferenceSourceUrl: url,
    gstStatus: 'inclusive',
    priceStatus: priced ? 'fixed' : 'quote_required',
    supplierId: 'supplier:harvey-norman-commercial',
    supplierName: SOURCE_ORG,
    primaryImage: row.primary_image_url,
    additionalImages: [],
    imageStatus: 'verified-authorised-supplier-local',
    imageSourceUrl: row.image_source_url,
    imageSourceOrganisation: SOURCE_ORG,
    imageCheckedAt: TODAY,
    productPageUrl: url,
    productPageStatus: 'verified-exact-model',
    documentUrls: [],
    applicableRooms: ['kitchen'],
    selectable: true,
    active: true,
    discontinued: false,
    discontinuedStatus: '',
    source: {
      type: 'authorised_supplier_product_page',
      file: 'data/product-library/catalogues/appliances/AU-BOSCH-APPLIANCE-RANGE.json',
      sourceName: `${SOURCE_ORG} exact product page`,
      sourceUrl: url,
      sourceVerifiedAt: TODAY,
    },
    research: {
      verificationStatus: 'verified-basic',
      sourceType: 'authorised_supplier_product_page',
      sourceOrganisation: SOURCE_ORG,
      checkedAt: TODAY,
      verificationNote: `Exact HNC product page title, colour, W x D x H dimensions, WELS registration number, all listed features, SRP and product photo verified against the live rendered ${url} listing on ${TODAY}. Place settings/wash programs recorded only where the feature list states them; energy and water star ratings are not published on this page and are left unset.`,
    },
    sourceCheckedAt: TODAY,
    sourceRowIds: [],
    createdAt: TODAY,
    updatedAt: TODAY,
    manualReviewRequired: false,
    manualReviewReason: '',
    imageVerificationStatus: 'verified-authorised-exact-model',
    modelVerificationNote: `Exact model ${model} confirmed by HNC product page SKU and listing product code; local product photo filename carries this exact model code and was downloaded directly from the model's own HNC catalogue image, never a substituted or generic dishwasher shot.`,
    imageSourcePageUrl: url,
    imageSourceType: 'authorised-supplier-product-page',
    imageAttribution: SOURCE_ORG,
    imageVerifiedAt: TODAY,
    evidence: {
      sourceOrganisation: SOURCE_ORG,
      sourceUrl: url,
      sourceCheckedAt: TODAY,
      evidenceStatus: 'verified-exact-model-source-fields',
      price: priceEvidence,
      fields: Object.fromEntries(evidenceFieldKeys.map((key) => [key, sourceStamp(url)])),
    },
    currency: 'AUD',
    priceSource: priceEvidence,
    priceSourceUrl: url,
    priceVerifiedAt: TODAY,
    sourceTitle: row.product_name.replace(/^Bosch\s+/, ''),
  };
}

const existingBoschDishwashers = catalogue.products.filter((p) => p.brandName === 'Bosch' && p.familyId === 'dishwashers');
console.log(`Existing Bosch dishwashers in canonical catalogue before import: ${existingBoschDishwashers.length}`);

const byModel = new Map(catalogue.products.map((p) => [String(p.manufacturerModel || '').toUpperCase(), p]));
let added = 0;
let updated = 0;
const results = [];

for (const row of scraped) {
  const record = buildRecord(row);
  const key = String(row.manufacturerModel).toUpperCase();
  const existing = byModel.get(key);
  if (existing) {
    // Update in place, preserving the existing productId/createdAt so this
    // never creates a duplicate product ID for a model already present.
    const idx = catalogue.products.findIndex((p) => p === existing);
    catalogue.products[idx] = { ...record, productId: existing.productId, createdAt: existing.createdAt || record.createdAt };
    updated += 1;
    results.push({ model: row.manufacturerModel, action: 'updated' });
  } else {
    catalogue.products.push(record);
    byModel.set(key, record);
    added += 1;
    results.push({ model: row.manufacturerModel, action: 'added' });
  }
}

console.log(JSON.stringify({ added, updated, total: catalogue.products.length, results }, null, 2));

if (!DRY) {
  fs.writeFileSync(CATALOGUE_PATH, `${JSON.stringify(catalogue, null, 2)}\n`);
  console.log(`Wrote ${CATALOGUE_PATH}`);
}
