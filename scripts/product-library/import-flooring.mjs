// Reusable supplier flooring importer for the Product Library.
//
// Each supplier is an adapter in ./flooring-suppliers/<key>.mjs exporting { key, name,
// fetchVariants({ cacheDir, refreshPages, log }) } that returns supplier-neutral variant records
// (one per supplier SKU). This runner groups them into Product Library products (one per range at
// one size / thickness, the colours as variants), stores each colour's genuine primary image
// locally, and merges with the previous import so ids stay stable, existing records are updated
// in place and price history is appended rather than lost (lib/product-library/flooringCatalogue.js).
//
// Usage:
//   node scripts/product-library/import-flooring.mjs --supplier=national-tiles
//   node scripts/product-library/import-flooring.mjs --supplier=national-tiles --refresh-pages   (re-read product pages, e.g. a price refresh)
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { FLOORING_FAMILY_KEY, FLOORING_REQUIREMENT_KEY, flooringProductCode, flooringType, flooringTypeFromText, flooringVariantId, flooringVariantPricing, mergeFlooringCatalogue } from "../../lib/product-library/flooringCatalogue.js";

const ADAPTERS = { "national-tiles": () => import("./flooring-suppliers/national-tiles.mjs"), "godfrey-hirst": () => import("./flooring-suppliers/godfrey-hirst.mjs") };
const args = process.argv.slice(2);
const supplierKey = (args.find((arg) => arg.startsWith("--supplier="))?.split("=")[1]) || "national-tiles";
const refreshPages = args.includes("--refresh-pages");
if (!ADAPTERS[supplierKey]) throw new Error(`Unknown flooring supplier "${supplierKey}". Known: ${Object.keys(ADAPTERS).join(", ")}`);

const adapter = await ADAPTERS[supplierKey]();
const fileKey = supplierKey.toUpperCase();
const OUTPUT = `data/product-library/catalogues/flooring/AU-${fileKey}-FLOORING-CATALOGUE.json`;
const REPORT = `data/product-library/catalogues/flooring/AU-${fileKey}-FLOORING-CATALOGUE.report.json`;
const CACHE_DIR = `data/product-library/source-evidence/${supplierKey}-flooring`;
const IMAGE_DIR = `public/images/catalogues/flooring/${supplierKey}`;
const IMAGE_URL = `/images/catalogues/flooring/${supplierKey}`;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const slug = (value = "") => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

fs.mkdirSync(CACHE_DIR, { recursive: true });
if (!fs.existsSync(path.join(CACHE_DIR, ".gitignore"))) fs.writeFileSync(path.join(CACHE_DIR, ".gitignore"), "# Raw supplier pages kept locally as import evidence; not committed.\n*\n!.gitignore\n");
fs.mkdirSync(IMAGE_DIR, { recursive: true });
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

const { variants: raw, failures, listedCount, sources } = await adapter.fetchVariants({ cacheDir: CACHE_DIR, refreshPages, log: console.log });

// The supplier's own material wording refines the category (e.g. a solid timber board listed in a
// timber category); the category is used only when the material names no flooring type.
const variants = raw.map((variant) => ({ ...variant, flooringType: flooringTypeFromText(variant.material) || variant.flooringType }));

// Genuine primary image per colour, stored locally (900px WebP). Kept on re-run.
const imageFailures = [];
async function importImage(variant) {
  const file = `${slug(variant.sku)}.webp`;
  const target = path.join(IMAGE_DIR, file);
  if (!variant.officialImageUrl) { imageFailures.push({ sku: variant.sku, reason: "source publishes no colour image" }); return; }
  if (!fs.existsSync(target)) {
    try {
      const response = await fetch(variant.officialImageUrl, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await sharp(Buffer.from(await response.arrayBuffer())).resize(900, 900, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(target);
      await sleep(400);
    } catch (error) { imageFailures.push({ sku: variant.sku, reason: error.message }); return; }
  }
  variant.imageUrl = `${IMAGE_URL}/${file}`;
}
// Bounded downloads; each exact-colour asset retains a stable local filename.
for (let start = 0; start < variants.length; start += 4) {
  await Promise.all(variants.slice(start, start + 4).map(importImage));
  if (start % 100 === 0) console.log(`Images checked: ${Math.min(start + 4, variants.length)}/${variants.length}`);
}

// One product per range at one size and thickness; the colours are its variants.
const groups = new Map();
for (const variant of variants) {
  const type = flooringType(variant.flooringType);
  const sizeKey = [variant.widthMm, variant.lengthMm, variant.thicknessMm].map((value) => value ?? "na").join("x");
  const groupKey = variant.groupKey || slug(`${variant.collection}-${variant.flooringType}-${sizeKey}`);
  if (!groups.has(groupKey)) groups.set(groupKey, { groupKey, type, variants: [] });
  groups.get(groupKey).variants.push(variant);
}

const uniform = (list, field) => { const values = [...new Set(list.map((item) => JSON.stringify(item[field] ?? null)))]; return values.length === 1 ? JSON.parse(values[0]) : null; };
const products = [...groups.values()].map(({ groupKey, type, variants: members }) => {
  const first = members[0];
  const sized = [first.widthMm, first.lengthMm].every(Boolean) ? `${first.widthMm}x${first.lengthMm}` : "";
  const dimensions = sized ? `${first.widthMm} x ${first.lengthMm}${first.thicknessMm ? ` x ${first.thicknessMm}mm` : "mm"}` : (first.thicknessMm ? `${first.thicknessMm}mm` : "");
  const priced = members.map((member) => flooringVariantPricing(member)).filter((pricing) => pricing.regularPricePerM2);
  const fromPrice = priced.length ? Math.min(...priced.map((pricing) => pricing.regularPricePerM2)) : null;
  const productVariants = members.map((member) => ({
    variantId: flooringVariantId(supplierKey, member.sku),
    variantName: member.colour,
    sku: member.sku,
    colour: member.colour,
    ...(member.flooringType === "carpet" ? { colourCode: member.colourCode, manufacturerVariantId: member.manufacturerVariantId, rollWidthM: member.rollWidthM, flooringType: "carpet", layingDirection: member.layingDirection, pattern: member.pattern, checkedAt: member.checkedAt, currentStatus: member.currentStatus } : {}),
    colourGroup: member.colourGroup,
    productName: member.productName,
    productUrl: member.productUrl,
    externalProductId: member.externalProductId,
    imageUrl: member.imageUrl || "",
    officialImageUrl: member.officialImageUrl,
    gallery: member.gallery,
    widthMm: member.widthMm, lengthMm: member.lengthMm, thicknessMm: member.thicknessMm,
    surfaceFinish: member.surfaceFinish, edge: member.edge, slipRating: member.slipRating, variationRating: member.variationRating,
    installation: member.installation, waterResistance: member.waterResistance, wearLayer: member.wearLayer,
    warranty: member.warranty, suitability: member.suitability,
    packCoverageM2: member.packCoverageM2,
    regularPricePerM2: member.regularPricePerM2, salePricePerM2: member.salePricePerM2,
    regularPricePerPack: member.regularPricePerPack, salePricePerPack: member.salePricePerPack,
    currency: member.currency, priceBasis: member.priceBasis, priceSource: member.priceSource, priceRetrievedAt: member.priceRetrievedAt,
    description: member.flooringType === "carpet" ? undefined : member.description,
    specs: member.specs,
  }));
  return {
    product_code: flooringProductCode(supplierKey, groupKey),
    family_key: FLOORING_FAMILY_KEY,
    requirement_keys: FLOORING_REQUIREMENT_KEY,
    category_key: "Flooring",
    top_level_area: "living-areas",
    manufacturer: first.manufacturer || first.brand,
    brand: first.brand,
    supplier: first.supplier,
    range: first.collection,
    subcategory: first.flooringType === "carpet" ? "Carpet" : type?.label,
    product_type: first.carpetSpecs?.fibre || type?.label,
    manufacturer_product_id: first.manufacturerProductId,
    specification_url: first.specificationUrl,
    // "Classic Oak Hybrid" already names its type: never "Classic Oak Hybrid Hybrid Flooring".
    product_name: new RegExp(`\\b${String(type?.label || first.material).split(" ")[0]}\\b`, "i").test(first.collection) ? `${first.collection} Flooring` : `${first.collection} ${type?.label || first.material} Flooring`,
    model: "",
    sku: "",
    colour: "",
    finish: uniform(members, "surfaceFinish") || "",
    material: first.material,
    size: sized,
    dimensions,
    description: members.find((member) => member.description)?.description || "",
    primary_image_url: members.find((member) => member.imageUrl)?.imageUrl || "",
    image_source_url: members.find((member) => member.officialImageUrl)?.officialImageUrl || "",
    image_source_type: adapter.manufacturerSource ? "official_manufacturer_page" : "official_supplier_page",
    image_status: members.some((member) => member.imageUrl) ? "verified_exact" : "missing",
    image_verified_at: first.priceRetrievedAt.slice(0, 10),
    official_product_url: first.productUrl,
    client_price: fromPrice,
    rrp: fromPrice,
    price_status: fromPrice ? "current" : adapter.manufacturerSource ? "quote_required" : "price_pending",
    price_unit: "m2",
    currency: first.currency,
    gst_included: true,
    regions: "AU",
    country: "AU",
    active: true,
    price_source_url: first.productUrl,
    price_verified_at: fromPrice ? first.priceRetrievedAt.slice(0, 10) : "",
    source_type: adapter.manufacturerSource ? "official_manufacturer_page" : "official_supplier_page",
    source_name: `${adapter.name} ${adapter.manufacturerSource ? "Australian manufacturer catalogue" : "storefront"}`,
    source_url: first.productUrl,
    source_verified_at: first.priceRetrievedAt.slice(0, 10),
    variants: productVariants,
    attributes: {
      clientSelectionRequirement: FLOORING_REQUIREMENT_KEY,
      flooringType: first.flooringType,
      ...(first.carpetSpecs ? { carpetSpecs: first.carpetSpecs, fibre: first.carpetSpecs.fibre, manufacturerProductId: first.manufacturerProductId, manufacturerUrl: first.manufacturerUrl } : {}),
      flooringTypeLabel: type?.label || "",
      collection: first.collection,
      supplierKey,
      variantGroupKey: groupKey,
      widthMm: first.widthMm, lengthMm: first.lengthMm, thicknessMm: first.thicknessMm,
      surfaceFinish: uniform(members, "surfaceFinish"),
      edge: uniform(members, "edge"),
      slipRating: uniform(members, "slipRating"),
      installation: uniform(members, "installation") || [],
      warranty: uniform(members, "warranty"),
      suitability: uniform(members, "suitability") || [],
      packCoverageM2: uniform(members, "packCoverageM2"),
      priceBasis: first.priceBasis,
      priceSource: first.priceSource,
      fromPricePerM2: fromPrice,
      colourCount: productVariants.length,
    },
  };
});

const retrievedAt = new Date().toISOString();
const existing = fs.existsSync(OUTPUT) ? JSON.parse(fs.readFileSync(OUTPUT, "utf8")) : { products: [] };
const catalogue = mergeFlooringCatalogue(existing, {
  catalogue: `${adapter.name} - flooring`,
  generatedAt: retrievedAt,
  note: adapter.manufacturerSource ? "Current Australian residential manufacturer catalogue. Shared range specifications and genuine manufacturer colour identifiers/swatches. Manufacturer and brand are separate from retailer. No retailer prices published: supplier quote required. Missing specifications remain null." : `Imported from ${adapter.name}'s own storefront: catalogue prices (regular and any promotional price, per m², inc GST) and each product page's schema.org Product data and published specification table. Fields the supplier does not publish are null. Regular price is the estimating price; promotional prices are kept separately.`,
  officialSources: sources,
  products,
}, { retrievedAt });
fs.writeFileSync(OUTPUT, `${JSON.stringify(catalogue, null, 2)}\n`);

const allVariants = catalogue.products.flatMap((product) => (product.variants || []).map((variant) => ({ ...variant, flooringType: product.attributes.flooringType })));
const active = allVariants.filter((variant) => !variant.discontinued);
const count = (type) => ({ products: catalogue.products.filter((product) => product.attributes.flooringType === type && product.active !== false).length, colours: active.filter((variant) => variant.flooringType === type).length });
const report = {
    supplier: adapter.name,
  generatedAt: retrievedAt,
  listedOnStorefront: listedCount,
  products: catalogue.products.filter((product) => product.active !== false).length,
  variants: active.length,
  byType: Object.fromEntries(["hybrid", "vinyl", "laminate", "engineered-timber", "timber", "carpet"].map((type) => [type, count(type)])),
  variantsWithPrice: active.filter((variant) => flooringVariantPricing(variant).priced).length,
  variantsWithoutPrice: active.filter((variant) => !flooringVariantPricing(variant).priced).map((variant) => variant.sku),
  variantsOnPromotion: active.filter((variant) => variant.salePricePerM2 || variant.salePricePerPack).map((variant) => variant.sku),
  variantsWithPackCoverage: active.filter((variant) => variant.packCoverageM2).length,
  variantsWithImage: active.filter((variant) => variant.imageUrl).length,
  discontinuedVariants: allVariants.filter((variant) => variant.discontinued).map((variant) => variant.sku),
  duplicateSkus: Object.entries(active.reduce((acc, variant) => ({ ...acc, [variant.sku]: (acc[variant.sku] || 0) + 1 }), {})).filter(([, n]) => n > 1).map(([sku]) => sku),
  pageFailures: failures,
  imageFailures,
  ...(adapter.manufacturerSource ? {
    byFibre: Object.fromEntries([...new Set(catalogue.products.map((p) => p.attributes.fibre))].map((fibre) => [fibre, { ranges: catalogue.products.filter((p) => p.active !== false && p.attributes.fibre === fibre).length, colours: catalogue.products.filter((p) => p.active !== false && p.attributes.fibre === fibre).flatMap((p) => p.variants.filter((v) => !v.discontinued)).length }])),
    missingSpecifications: catalogue.products.filter((p) => p.active !== false).map((p) => ({ range: p.range, missing: ["fibre", "yarn", "style", "construction", "rollWidthM", "totalThicknessMm", "pileHeightMm", "gauge", "patternRepeat", "residentialRating", "commercialRating", "warranty", "specificationUrl"].filter((k) => p.attributes.carpetSpecs?.[k] === null || p.attributes.carpetSpecs?.[k] === undefined) })).filter((p) => p.missing.length),
  } : {}),
};
fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, variantsWithoutPrice: report.variantsWithoutPrice.length, variantsOnPromotion: report.variantsOnPromotion.length, discontinuedVariants: report.discontinuedVariants.length }, null, 2));
