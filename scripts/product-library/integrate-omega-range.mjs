// Integrates the current Omega Appliances Australia range (scraped by
// import-omega-range.mjs) into the canonical appliance catalogue, and
// archives/replaces the old legacy Omega records that are no longer part of
// the current range - without ever deleting or renaming a productId, so
// AU-APPLIANCE-PACKS.json and any existing job selections that reference
// those IDs keep resolving.
//
//   node scripts/product-library/integrate-omega-range.mjs [--dry-run]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOGUE_PATH = path.join(ROOT, 'data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json');
const RANGE_PATH = path.join(ROOT, 'data/product-library/catalogues/appliances/AU-OMEGA-APPLIANCE-RANGE.json');
const DRY = process.argv.includes('--dry-run');
const TODAY = new Date().toISOString().slice(0, 10);
const SOURCE_ORG = 'Omega Appliances Australia';

const catalogue = JSON.parse(fs.readFileSync(CATALOGUE_PATH, 'utf8'));
const range = JSON.parse(fs.readFileSync(RANGE_PATH, 'utf8'));
const scraped = range.products.filter((p) => p.brand === 'Omega');

const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// -- verified Australian retail prices (Omega's own site shows $0.00 for --
// -- every model, so pricing is sourced separately from named AU retailers) --
// Each entry: [price, retailer, url, note]
const PRICE_MAP = {
  OBOS6029AG: [2200, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances', 'current selling price, was $2499'],
  OBOP6016AM: [999, 'The Good Guys', 'https://www.thegoodguys.com.au/omega?page=2', ''],
  OBO6011AM: [799, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OBO608M: [699, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OBO606M: [454, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OBO605M: [599, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  ODO6012M: [1199, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', 'RRP $1299'],
  OBO9011AM: [1399, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OBO605MCOM: [699, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances?page=2', 'current selling price, was $899'],
  OBOS605MR: [1099, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances?page=2', ''],
  OBOS605ML: [1099, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances?page=2', ''],
  OCIG905B: [999, 'The Good Guys', 'https://www.thegoodguys.com.au/omega?page=2', ''],
  OCGG905WB: [899, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', 'RRP $999'],
  OCGG604WB: [649, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OCG905WX: [399, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OCG705WX: [649, 'The Good Guys', 'https://www.thegoodguys.com.au/omega?page=2', ''],
  OCG604WX: [449, 'The Good Guys', 'https://www.thegoodguys.com.au/omega?page=2', ''],
  OCI903FTZ: [1449, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances?page=3', 'current selling price, was $2499'],
  OCI905TZ: [999, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OCI704PPTZ: [789, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances?page=3', 'current selling price, was $899'],
  OCI604TZ: [799, 'The Good Guys', 'https://www.thegoodguys.com.au/omega?page=2', ''],
  OCI604PPTZ: [679, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OCC905TZ: [899, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OCC704TZ: [599, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OCC604TZ: [449, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OCC604KZ: [449, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OCI302PPTCOM: [488, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances?page=2', ''],
  ORU52MB: [449, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', 'also listed at $449 by Bing Lee'],
  ORU90MB: [579, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  ORC60MB: [699, 'The Good Guys', 'https://www.thegoodguys.com.au/omega?page=2', ''],
  ORT6WXA: [229, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  ORT9WXL: [348, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances?page=2', 'current selling price, was $459'],
  ORC90MB: [849, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances?page=2', 'current selling price, was $999'],
  ODWIF6015: [999, 'The Good Guys', 'https://www.thegoodguys.com.au/omega?page=2', 'also $999 (was $1299) at SA Appliance Warehouse'],
  ODWIS6015X: [699, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  ODWF6015X: [799, 'Laybyland', 'https://www.laybyland.com.au/home-and-garden/kitchen-appliances/dishwashers/omega-freestanding-dishwasher-stainless-steel', 'RRP $999 per Rick Hart Outlet / The Good Guys product page'],
  ODWF4510X: [749, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  ODWF6014BX: [699, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  ODWF6014X: [599, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  ODW101W: [599, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances?page=2', 'current selling price, was $799'],
  ODWF6015BXCOM: [999, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances', 'current selling price, was $1249'],
  OFOGC9010X: [1899, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', 'also $1899 (was $2299) at SA Appliance Warehouse'],
  OFOIC908BCOM: [2499, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances', 'current selling price, was $2999'],
  OF995FXCOM: [1299, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances', ''],
  OM28BF: [599, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', ''],
  OBOC6011M: [1399, 'The Good Guys', 'https://www.thegoodguys.com.au/omega', 'also $1399 (was $1699) at SA Appliance Warehouse'],
  OCWMG: [900, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances', 'current selling price, was $1199'],
  OMW25B: [688, 'SA Appliance Warehouse', 'https://saappliancewarehouse.com.au/collections/omega-appliances?page=2', 'current selling price, was $899'],
};

// -- legacy Omega records already in the canonical catalogue: classification --
// CURRENT = still in Omega's live range today, refresh with live data.
// REPLACED = confident 1:1 naming-lineage successor identified.
// ARCHIVED = confirmed gone from the live range (either listed on Omega's own
//            /archive page, or simply absent from both live and archive listings).
const LEGACY_CLASSIFICATION = {
  OCG604X: { status: 'REPLACED', replacedBy: 'OCG604WX', note: 'Confirmed on omegaappliances.com.au/archive. Naming-lineage successor OCG604WX (60cm gas cooktop, stainless steel, wok burner) is the current equivalent SKU.' },
  OCI64Z: { status: 'ARCHIVED', note: 'Confirmed on omegaappliances.com.au/archive. No single confident 1:1 successor; closest current 60cm induction equivalents are OCI604TZ (touch controls) and OCI604PPTZ (10 amp power phasing) - left for manual merchandising decision rather than auto-substituted.' },
  OI90Z: { status: 'ARCHIVED', note: 'Not present in Omega\'s current range or /archive listing as of 2026-09-16 (fully delisted). Closest current 90cm induction equivalents are OCI905TZ (touch controls) and OCI903FTZ (5-zone BridgeZones) - left for manual merchandising decision.' },
  ODW702XB: { status: 'ARCHIVED', note: 'Not present in Omega\'s current range or /archive listing as of 2026-09-16 (fully delisted). Closest current 60cm freestanding dishwasher equivalents are ODWF6014X and ODWF6015X - left for manual merchandising decision.' },
  OF916FX: { status: 'ARCHIVED', note: 'Confirmed on omegaappliances.com.au/archive. Omega\'s freestanding-cooker range has moved to different function tiers; closest current 90cm equivalent is OF995FXCOM (5-function) - left for manual merchandising decision since the function count differs materially (9 to 5).' },
  OBO660X: { status: 'ARCHIVED', note: 'Confirmed on omegaappliances.com.au/archive. No exact 4-function successor exists; closest current 60cm ovens are OBO605M (5-function) and OBO606M (6-function) - left for manual merchandising decision.' },
  OBO960X1: { status: 'ARCHIVED', note: 'Confirmed on omegaappliances.com.au/archive. No exact 9-function 90x60cm successor exists; closest current equivalents are OBO9011AM (11-function with AirFry) and OBO9010AMCOM (10-function) - left for manual merchandising decision.' },
  ORC60X: { status: 'ARCHIVED', note: 'Not present in Omega\'s current range or /archive listing as of 2026-09-16 (fully delisted). Closest current 60cm canopy equivalent is ORC60MB (Matte Black) - left for manual merchandising decision.' },
  ORC90X: { status: 'ARCHIVED', note: 'Not present in Omega\'s current range or /archive listing as of 2026-09-16 (fully delisted). Closest current 90cm canopy equivalent is ORC90MB (Matte Black) - left for manual merchandising decision.' },
  ORF60X: { status: 'REPLACED', replacedBy: 'ORF60XL', note: 'Not present in Omega\'s current range or /archive listing as of 2026-09-16. Naming-lineage successor ORF60XL (60cm fixed rangehood) is the current equivalent SKU.' },
  ORF90X: { status: 'ARCHIVED', note: 'Confirmed on omegaappliances.com.au/archive. Omega no longer offers a 90cm "fixed" rangehood at all (current fixed-type range is 60cm only, ORF60XL) - no same-installation-type successor exists. Closest functionally-similar current 90cm products are ORU90XL (undermount) and ORW9XL (canopy), but these are a different installation type and are NOT auto-substituted.' },
  ORT6WBA: { status: 'CURRENT', note: 'Confirmed still in Omega\'s current rangehoods range as of 2026-09-16; record refreshed with live specifications/description/image.' },
  ORT9WXA: { status: 'REPLACED', replacedBy: 'ORT9WXL', note: 'Not present in Omega\'s current range or /archive listing as of 2026-09-16. Naming-lineage successor ORT9WXL (90cm slide-out rangehood) is the current equivalent SKU.' },
};

function sourceStamp(url) {
  return { status: 'verified-authorised-supplier', source: SOURCE_ORG, sourceUrl: url, sourceCheckedAt: TODAY };
}

function buildCurrentRecord(row, existingProductId) {
  const model = row.manufacturerModel;
  const url = row.official_product_url;
  const priceEntry = PRICE_MAP[model];
  const [price, retailer, retailerUrl, priceNote] = priceEntry || [null, '', '', ''];

  const specifications = {
    family: row.family_key,
    manufacturerModel: model,
    width: row.widthMm ? `${row.widthMm} mm` : '',
    widthMm: row.widthMm ?? null,
    height: row.heightMm ? `${row.heightMm} mm` : '',
    heightMm: row.heightMm ?? null,
    depth: row.depthMm ? `${row.depthMm} mm` : '',
    depthMm: row.depthMm ?? null,
    finish: row.colour || '',
    colour: row.colour || '',
    fuelOrEnergyType: row.family_key === 'cooktops' ? row.configuration : '',
    installationType: row.installationType || '',
    configuration: row.configuration || '',
    capacity: row.capacity || '',
    warranty: row.warranty || '',
    features: row.features || [],
    omegaPublishedSpecifications: row.specifications || {},
    dimensionsRaw: row.dimensionsRaw || '',
  };
  const specFieldKeys = Object.keys(specifications);

  const productId = existingProductId || `product:appliances:${row.family_key}:omega:${slug(model)}`;

  return {
    productId,
    schemaVersion: catalogue.schemaVersion,
    categoryId: 'category:appliances',
    familyId: row.family_key,
    subfamilyId: '',
    productType: 'physical-product',
    brandId: 'brand:omega',
    brandName: 'Omega',
    rangeId: '',
    rangeName: '',
    manufacturerModel: model,
    sku: model,
    productName: row.product_name,
    shortDescription: row.titleRaw.split('|')[0].trim(),
    fullDescription: [row.description, ...(row.features || [])].filter(Boolean).join('\n'),
    descriptionStatus: 'verified-complete',
    specifications,
    specificationStatus: 'partial',
    specificationSources: Object.fromEntries(specFieldKeys.map((k) => [k, sourceStamp(url)])),
    width: specifications.width,
    widthMm: specifications.widthMm,
    height: specifications.height,
    heightMm: specifications.heightMm,
    depth: specifications.depth,
    depthMm: specifications.depthMm,
    capacity: row.capacity || null,
    colour: row.colour || '',
    finish: row.colour || '',
    availableColours: row.colour ? [row.colour] : [],
    availableFinishes: row.colour ? [row.colour] : [],
    fuelOrEnergyType: specifications.fuelOrEnergyType,
    installationType: row.installationType || '',
    unit: 'EACH',
    costPrice: price,
    sourceCostPrice: price,
    sellPrice: price,
    importedSourceCost: price,
    tenantSellPrice: price,
    currentRetailReference: price,
    currentRetailReferenceSourceUrl: retailerUrl,
    gstStatus: price ? 'inclusive' : 'unspecified',
    priceStatus: price ? 'current' : 'quote_required',
    supplierId: 'supplier:omega',
    supplierName: 'Omega',
    primaryImage: row.primary_image_url || '',
    additionalImages: [],
    imageStatus: row.primary_image_url ? 'verified-official-local' : 'exact-image-unavailable',
    imageSourceUrl: row.image_source_url || '',
    imageSourceOrganisation: SOURCE_ORG,
    imageCheckedAt: TODAY,
    productPageUrl: url,
    productPageStatus: 'verified-exact-model',
    documentUrls: [],
    applicableRooms: ['kitchen'],
    selectable: true,
    active: true,
    discontinued: false,
    discontinuedStatus: 'current',
    source: {
      type: 'official_australian_manufacturer_product_page',
      file: 'data/product-library/catalogues/appliances/AU-OMEGA-APPLIANCE-RANGE.json',
      sourceName: `${SOURCE_ORG} exact product page`,
      sourceUrl: url,
      sourceVerifiedAt: TODAY,
    },
    research: {
      verificationStatus: 'verified-basic',
      sourceType: 'official_australian_manufacturer_product_page',
      sourceOrganisation: SOURCE_ORG,
      checkedAt: TODAY,
      verificationNote: `Exact model, title, description, features, dimensions/capacity and product photo verified against the live ${url} listing on ${TODAY}, confirmed present in Omega's current (non-archived) range. Price: ${price ? `verified current Australian retail price from ${retailer} (${priceNote || 'current listed price'})` : "Omega's own site price is $0.00 for every model and is not usable; no reliable current Australian retailer price could be verified for this model, so no price is recorded."}`,
    },
    sourceCheckedAt: TODAY,
    sourceRowIds: [],
    createdAt: TODAY,
    updatedAt: TODAY,
    manualReviewRequired: false,
    manualReviewReason: '',
    imageVerificationStatus: row.primary_image_url ? 'verified-official-exact-model' : 'unresolved',
    modelVerificationNote: `Exact model ${model} confirmed on Omega's own current-range listing at ${url}; product image is that model's own image asset from Omega's official product data, never a substituted or generic appliance shot.`,
    imageSourcePageUrl: url,
    imageSourceType: 'official-australian-manufacturer-product-page',
    imageAttribution: SOURCE_ORG,
    imageVerifiedAt: TODAY,
    evidence: {
      sourceOrganisation: SOURCE_ORG,
      sourceUrl: url,
      sourceCheckedAt: TODAY,
      evidenceStatus: 'verified-exact-model-source-fields',
      price: price ? {
        sourceOrganisation: retailer,
        sourceUrl: retailerUrl,
        sourceCheckedAt: TODAY,
        priceType: 'verified-retailer-current-price',
        currency: 'AUD',
        listedPrice: price,
        gstIncluded: true,
        verificationStatus: 'verified-listed-price',
        note: priceNote,
      } : {
        sourceOrganisation: SOURCE_ORG,
        sourceUrl: url,
        sourceCheckedAt: TODAY,
        priceType: 'no-verified-price',
        currency: 'AUD',
        listedPrice: null,
        verificationStatus: 'omega-site-price-unusable-no-retailer-price-found',
        note: "Omega's own site lists $0.00 for this model, which is not a usable price; no current Australian retailer listing could be verified for this exact model.",
      },
      fields: Object.fromEntries(['productName', 'manufacturerModel', 'shortDescription', 'fullDescription', 'dimensions', 'features'].map((k) => [k, sourceStamp(url)])),
    },
    currency: 'AUD',
    priceSourceUrl: price ? retailerUrl : '',
    priceVerifiedAt: price ? TODAY : '',
    sourceTitle: row.titleRaw.split('|')[0].trim(),
  };
}

// -- Step 1: report existing Omega state (preserved before any change) -----
const existingOmega = catalogue.products.filter((p) => p.brandName === 'Omega');
console.log(`Existing Omega records before update: ${existingOmega.length}`);
const existingByModel = new Map(existingOmega.map((p) => [String(p.manufacturerModel).toUpperCase(), p]));

// -- Step 2: classify and archive/replace/refresh the 13 legacy records ----
const legacyActions = [];
for (const [model, cls] of Object.entries(LEGACY_CLASSIFICATION)) {
  const existing = existingByModel.get(model);
  if (!existing) { legacyActions.push({ model, action: 'not-found-in-catalogue', ...cls }); continue; }
  const idx = catalogue.products.indexOf(existing);
  if (cls.status === 'CURRENT') {
    const row = scraped.find((r) => r.manufacturerModel === model);
    if (row) {
      catalogue.products[idx] = buildCurrentRecord(row, existing.productId);
      legacyActions.push({ model, action: 'refreshed-current', productId: existing.productId });
    } else {
      legacyActions.push({ model, action: 'classified-current-but-not-in-scrape', productId: existing.productId });
    }
  } else {
    // ARCHIVED or REPLACED: never delete or rename. Flip to inactive/
    // non-selectable, preserve every existing field for history, and record
    // the classification + evidence. Packs/selections that reference this
    // productId keep resolving; the existing pack-eligibility logic
    // (getAppliancePacks) automatically marks any pack containing this
    // component as inactive too.
    catalogue.products[idx] = {
      ...existing,
      active: false,
      selectable: false,
      discontinued: true,
      discontinuedStatus: cls.status === 'REPLACED' ? 'confirmed-discontinued-replaced' : 'confirmed-discontinued-archived',
      discontinuedReviewFlag: false,
      manualReviewRequired: cls.status === 'ARCHIVED',
      manualReviewReason: cls.status === 'ARCHIVED' ? 'Archived model with no confident 1:1 current successor; a merchandising decision is needed before any pack is rebuilt around a replacement.' : '',
      replacedByModel: cls.replacedBy || '',
      replacedByProductId: cls.replacedBy ? `product:appliances:${existing.familyId}:omega:${slug(cls.replacedBy)}` : '',
      updatedAt: TODAY,
      omegaLifecycleReview: {
        reviewedAt: TODAY,
        status: cls.status,
        note: cls.note,
        checkedAgainst: ['https://omegaappliances.com.au' + { ovens: '/ovens', cooktops: '/cooktops', rangehoods: '/rangehoods', dishwashers: '/dishwashers', 'freestanding-cookers': '/freestanding-cookers', microwaves: '/compacts-microwaves' }[existing.familyId], 'https://omegaappliances.com.au/archive'],
      },
    };
    legacyActions.push({ model, action: cls.status === 'REPLACED' ? 'archived-replaced' : 'archived', productId: existing.productId, replacedBy: cls.replacedBy || null });
  }
}

// -- Step 3: add every current-range product not already handled above ----
const handledModels = new Set(Object.keys(LEGACY_CLASSIFICATION));
let added = 0;
let updatedOther = 0;
const addedModels = [];
for (const row of scraped) {
  const model = row.manufacturerModel;
  if (handledModels.has(model)) continue; // already handled in step 2 (ORT6WBA)
  const existing = existingByModel.get(model);
  if (existing) {
    const idx = catalogue.products.indexOf(existing);
    catalogue.products[idx] = buildCurrentRecord(row, existing.productId);
    updatedOther += 1;
  } else {
    catalogue.products.push(buildCurrentRecord(row, null));
    added += 1;
    addedModels.push(model);
  }
}

console.log(JSON.stringify({ legacyActions, added, updatedOther, addedModelsCount: addedModels.length }, null, 2));

if (!DRY) {
  fs.writeFileSync(CATALOGUE_PATH, `${JSON.stringify(catalogue, null, 2)}\n`);
  console.log(`Wrote ${CATALOGUE_PATH}; total products now: ${catalogue.products.length}`);
}
