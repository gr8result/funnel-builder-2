// Promotes the scraped Bosch rangehood rows from the staging range file into the
// appliance catalogue the Client Selections picker actually reads.
//
//   node scripts/product-library/integrate-bosch-rangehoods.mjs [--dry-run]
//
// Staging : data/product-library/catalogues/appliances/AU-BOSCH-APPLIANCE-RANGE.json
// Target  : data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json
//
// lib/product-library/applianceCatalogueSelectors.js imports only the target file,
// so a row that stops at the staging file is invisible to the UI. Bosch ovens and
// cooktops were promoted previously; rangehoods were not, which is why the picker
// reported "No Bosch products are currently available in this category".
//
// Idempotent: a model already present is left alone, never duplicated.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STAGING = path.join(ROOT, 'data/product-library/catalogues/appliances/AU-BOSCH-APPLIANCE-RANGE.json');
const TARGET = path.join(ROOT, 'data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json');
const DRY = process.argv.includes('--dry-run');
const FAMILY = 'rangehoods';

const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const nz = (v) => (v === '' || v === undefined ? null : v);

// Only write a spec the scrape actually captured. An absent value stays absent
// rather than becoming a guess.
function specifications(row) {
  const a = row.attributes || {};
  const spec = { family: FAMILY, manufacturerModel: row.manufacturerModel };
  if (row.widthMm) { spec.width = `${row.widthMm} mm`; spec.widthMm = row.widthMm; }
  if (row.finish) { spec.finish = row.finish; spec.colour = row.finish; }
  if (a.rangehoodType) spec.installationType = a.rangehoodType;
  if (a.extractionM3PerHour) spec.extractionM3PerHour = a.extractionM3PerHour;
  if (a.noiseDb) spec.noiseDb = a.noiseDb;
  if (a.ducting) spec.ducting = a.ducting;
  if (Array.isArray(row.features) && row.features.length) spec.features = row.features;
  return spec;
}

function toCatalogueRecord(row) {
  const model = row.manufacturerModel || row.model;
  const priced = row.client_price != null;
  return {
    productId: `product:${FAMILY}:bosch:${slug(model)}`,
    schemaVersion: 'product-library.appliance-catalogue.v1',
    categoryId: 'category:appliances',
    familyId: FAMILY,
    productType: 'physical-product',
    brandId: 'brand:bosch',
    brandName: 'Bosch',
    rangeName: nz(row.range),
    manufacturerModel: model,
    sku: model,
    productName: row.product_name,
    shortDescription: nz(row.product_name?.replace(/^Bosch\s+/i, '')),
    fullDescription: nz((row.features || []).join('\n')) || nz(row.description),
    specifications: specifications(row),
    width: row.widthMm ? `${row.widthMm} mm` : null,
    widthMm: row.widthMm ?? null,
    colour: nz(row.finish),
    finish: nz(row.finish),
    fuelOrEnergyType: nz(row.fuelOrEnergyType),
    installationType: nz(row.installationType) || nz(row.attributes?.rangehoodType),
    unit: 'EACH',
    costPrice: row.client_price ?? null,
    sourceCostPrice: row.client_price ?? null,
    sellPrice: row.client_price ?? null,
    tenantSellPrice: row.client_price ?? null,
    priceStatus: priced ? 'current' : 'quote_required',
    gstStatus: priced ? 'inc-gst' : null,
    supplierName: row.supplier || 'Harvey Norman Commercial',
    primaryImage: row.primary_image_url,
    additionalImages: [],
    imageStatus: row.image_status,
    imageSourceUrl: row.image_source_url,
    imageSourceOrganisation: row.image_source_organisation,
    imageCheckedAt: row.image_verified_at,
    productPageUrl: row.official_product_url,
    applicableRooms: ['kitchen'],
    selectable: true,
    active: true,
    discontinued: false,
    source: {
      type: 'authorised_supplier_product_page',
      file: 'data/product-library/catalogues/appliances/AU-BOSCH-APPLIANCE-RANGE.json',
      url: row.source_url,
      organisation: row.image_source_organisation,
      verifiedAt: row.source_verified_at,
    },
    sourceCheckedAt: row.source_verified_at,
  };
}

const staging = JSON.parse(fs.readFileSync(STAGING, 'utf8'));
const target = JSON.parse(fs.readFileSync(TARGET, 'utf8'));
const incoming = (staging.products || []).filter((r) => r.family_key === FAMILY);

const existingKeys = new Set(
  (target.products || [])
    .filter((p) => p.familyId === FAMILY && /bosch/i.test(p.brandName || ''))
    .map((p) => String(p.manufacturerModel || p.sku || '').toUpperCase()),
);

const added = [];
const skipped = [];
for (const row of incoming) {
  const key = String(row.manufacturerModel || row.model || '').toUpperCase();
  if (existingKeys.has(key)) { skipped.push(key); continue; }
  existingKeys.add(key);
  added.push(toCatalogueRecord(row));
}

if (!DRY && added.length) {
  target.products = [...(target.products || []), ...added];
  fs.writeFileSync(TARGET, `${JSON.stringify(target, null, 2)}\n`);
}

console.log(JSON.stringify({
  dryRun: DRY,
  incomingFromStaging: incoming.length,
  alreadyPresentSkipped: skipped,
  added: added.length,
  addedModels: added.map((p) => p.manufacturerModel),
  withImage: added.filter((p) => p.primaryImage).length,
  withPrice: added.filter((p) => p.sellPrice != null).length,
  targetTotalAfter: (target.products || []).length,
}, null, 2));
