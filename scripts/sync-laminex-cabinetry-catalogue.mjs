import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const CATALOGUE_PATH = path.join(ROOT, "data/product-library/catalogues/cabinetry/AU-LAMINEX-CABINETRY-COLOURS.json");
const CATALOGUE_MODULE_PATH = path.join(ROOT, "data/product-library/catalogues/cabinetry/AU-LAMINEX-CABINETRY-COLOURS.js");
const REPORT_PATH = path.join(ROOT, "data/product-library/catalogues/cabinetry/AU-LAMINEX-CABINETRY-COLOURS.report.json");
const IMAGE_DIR = path.join(ROOT, "public/images/catalogues/laminex");
const OFFICIAL_HOST = "https://www.laminex.com.au";
const COLLECTION_URL = `${OFFICIAL_HOST}/colour-collection`;
const CABINETRY_URL = `${OFFICIAL_HOST}/browse/product-application/cabinetry-doors-drawers`;
const ABSOLUTE_MATTE_URL = `${OFFICIAL_HOST}/brands/laminex/absolutematte-range`;
const VERIFIED_AT = "2026-08-31";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || args.has("--validate") || args.has("--validation");

const ABSOLUTE_MATTE_COLOUR_FAMILIES = {
  "Polar White": "Whites & Neutrals",
  White: "Whites & Neutrals",
  Aries: "Whites & Neutrals",
  Surf: "Whites & Neutrals",
  "Oyster Grey": "Whites & Neutrals",
  "Paper Bark": "Whites & Neutrals",
  Spinifex: "Accents",
  "Green Slate": "Accents",
  Otway: "Accents",
  Pewter: "Whites & Neutrals",
  Stormcloud: "Whites & Neutrals",
  Terril: "Accents",
  "Moroccan Clay": "Accents",
  Kalamata: "Accents",
  "French Navy": "Accents",
  Black: "Whites & Neutrals",
};

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#034;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "'")
    .replace(/&ndash;/g, "-");
}

function slug(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function absoluteUrl(url = "") {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${OFFICIAL_HOST}${url.startsWith("/") ? "" : "/"}${url}`;
}

function productCodeFromUrl(url = "") {
  return String(url).match(/\/p\/([A-Z0-9]+)/i)?.[1] || "";
}

function colourFamilyFor(colourName = "", finish = "") {
  if (ABSOLUTE_MATTE_COLOUR_FAMILIES[colourName]) return ABSOLUTE_MATTE_COLOUR_FAMILIES[colourName];
  if (/oak|walnut|gum|elm|ash|legno|teak|wood|birch|jarrah|pine|beech|bluegum|spotted|hoop/i.test(colourName)) return "Woodgrains";
  if (/platypus|rocky|mist|sand|fossil|concrete|stone|grey|gray|graphite|ore|anthracite|basalt|mineral/i.test(colourName)) return "Minerals";
  if (/red|green|blue|navy|clay|terril|otway|spinifex|olivine|eucalypt|gumnut|outback|centre|kalamata|bayleaf/i.test(colourName)) return "Accents";
  if (/absolutegrain/i.test(finish)) return "Woodgrains";
  return "Whites & Neutrals";
}

function pricingTierFor(finish = "", productRange = "") {
  if (/AbsoluteGrain|AbsoluteMatte/i.test(`${finish} ${productRange}`)) return "tier_3";
  if (/Flint|Nuance|Chalk/i.test(finish)) return "tier_2";
  return "tier_1";
}

function priceStatusFor(tier = "") {
  if (tier === "tier_1") return "included";
  if (tier === "tier_2") return "upgrade";
  if (tier === "tier_3") return "supplier_quote_required";
  return "price_pending";
}

function recordFromTile(tile) {
  const productRange = /AbsoluteGrain/i.test(tile.finish) ? "Laminex AbsoluteGrain Decorated MDF" : "Laminex Decorated Panels & Boards";
  const pricingTier = pricingTierFor(tile.finish, productRange);
  const productUrl = absoluteUrl(tile.href);
  const id = `laminex-${slug(tile.colour)}-${slug(productRange)}-${slug(tile.finish)}-${productCodeFromUrl(productUrl) || "colour"}`;
  const swatchFile = `${slug(tile.colour)}-${slug(tile.finish)}-${productCodeFromUrl(productUrl) || "swatch"}.jpg`;
  return {
    id,
    supplier: "Laminex",
    brand: "Laminex",
    colourName: tile.colour,
    colourFamily: colourFamilyFor(tile.colour, tile.finish),
    productRange,
    finish: tile.finish,
    application: "Cabinetry doors, drawers and panels",
    swatchImage: `/images/catalogues/laminex/${swatchFile}`,
    swatchThumbnail: `/images/catalogues/laminex/${swatchFile}`,
    officialSwatchUrl: tile.img,
    officialProductUrl: productUrl,
    officialCollectionUrl: CABINETRY_URL,
    availabilityStatus: "active",
    pricingTier,
    priceStatus: priceStatusFor(pricingTier),
    verifiedAt: VERIFIED_AT,
    source: "Laminex Cabinetry - Doors & Drawers public product listing",
    productFamily: productRange,
    colourCode: productCodeFromUrl(productUrl),
    substrate: tile.product.replace(" | Laminex AU", ""),
    thickness: "Supplier published sheet size",
  };
}

function parseProductTiles(html) {
  const rx = /<a class="product__list--thumb" href="(?<href>[^"]+)" title="(?<title>[^"]+)"\s*>\s*<img src="(?<img>[^"]+)"/gs;
  const records = [];
  for (const match of html.matchAll(rx)) {
    const title = decodeHtml(match.groups.title);
    const [colour, finish, application, product] = title.split(" - ");
    if (!colour || !finish || !application || !product) continue;
    if (!/^Laminex Decorated/i.test(product)) continue;
    if (!/Cabinetry/i.test(application)) continue;
    records.push(recordFromTile({ colour, finish, application, product, href: match.groups.href, img: match.groups.img }));
  }
  return records;
}

function parseAbsoluteMatteTiles(html) {
  const rx = /<a href = '([^']*\/products\/([^/]+)\/AbsoluteMatte\/p\/([A-Z0-9]+)[^']*)'[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<a href="[^"]+" class="img-slider-link">\s*([^<]+)<\/a>/g;
  const rows = [];
  for (const match of html.matchAll(rx)) {
    const colour = decodeHtml(match[5]).trim();
    if (!colour || !ABSOLUTE_MATTE_COLOUR_FAMILIES[colour]) continue;
    const productUrl = absoluteUrl(match[1].replace(/&amp;/g, "&"));
    const productCode = match[3];
    const productRange = "Laminex AbsoluteMatte Panels";
    const swatchFile = `${slug(colour)}-absolutematte-${productCode}.jpg`;
    rows.push({
      id: `laminex-${slug(colour)}-${slug(productRange)}-absolutematte-${productCode}`,
      supplier: "Laminex",
      brand: "Laminex",
      colourName: colour,
      colourFamily: colourFamilyFor(colour, "AbsoluteMatte"),
      productRange,
      finish: "AbsoluteMatte",
      application: "Cabinetry doors, drawers and panels",
      swatchImage: `/images/catalogues/laminex/${swatchFile}`,
      swatchThumbnail: `/images/catalogues/laminex/${swatchFile}`,
      officialSwatchUrl: absoluteUrl(match[4]),
      officialProductUrl: productUrl,
      officialCollectionUrl: ABSOLUTE_MATTE_URL,
      availabilityStatus: "active",
      pricingTier: "tier_3",
      priceStatus: "supplier_quote_required",
      verifiedAt: VERIFIED_AT,
      source: "Laminex AbsoluteMatte public range page",
      productFamily: productRange,
      colourCode: productCode,
      substrate: "AbsoluteMatte Panels",
      thickness: "Supplier published sheet size",
    });
  }
  return rows;
}

function uniqueRecords(records) {
  const byId = new Map();
  const duplicates = [];
  for (const record of records) {
    if (byId.has(record.id)) duplicates.push(record.id);
    else byId.set(record.id, record);
  }
  return { records: Array.from(byId.values()), duplicates };
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "gr8-result-catalogue-sync/1.0" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function downloadImage(record, failures) {
  if (!record.officialSwatchUrl || dryRun) return false;
  const publicRelativePath = record.swatchImage.replace(/^\/images\//, "images/");
  const target = path.join(ROOT, "public", publicRelativePath);
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    try {
      await fs.access(target);
      return false;
    } catch {}
    const response = await fetch(record.officialSwatchUrl, { headers: { "user-agent": "gr8-result-catalogue-sync/1.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(target, buffer);
    return true;
  } catch (error) {
    failures.push({ id: record.id, colourName: record.colourName, url: record.officialSwatchUrl, reason: error.message });
    record.swatchImage = "";
    record.swatchThumbnail = "";
    return false;
  }
}

async function main() {
  const [cabinetryHtml, absoluteMatteHtml] = await Promise.all([fetchText(CABINETRY_URL), fetchText(ABSOLUTE_MATTE_URL)]);
  const currentRecords = [...parseProductTiles(cabinetryHtml), ...parseAbsoluteMatteTiles(absoluteMatteHtml)];
  const { records, duplicates } = uniqueRecords(currentRecords);
  const existing = await fs.readFile(CATALOGUE_PATH, "utf8").then((text) => JSON.parse(text)).catch(() => []);
  const currentIds = new Set(records.map((record) => record.id));
  const inactive = existing
    .filter((record) => record.id && !currentIds.has(record.id))
    .map((record) => ({ ...record, availabilityStatus: "inactive", priceStatus: record.priceStatus || "price_pending" }));
  const finalRecords = [...records, ...inactive].sort((left, right) => `${left.colourFamily}|${left.colourName}|${left.finish}`.localeCompare(`${right.colourFamily}|${right.colourName}|${right.finish}`));
  const imageFailures = [];
  let imagesStored = 0;
  for (const record of finalRecords.filter((item) => item.availabilityStatus === "active")) {
    if (await downloadImage(record, imageFailures)) imagesStored += 1;
  }
  const active = finalRecords.filter((record) => record.availabilityStatus === "active");
  const familyTotals = active.reduce((totals, record) => ({ ...totals, [record.colourFamily]: (totals[record.colourFamily] || 0) + 1 }), {});
  const report = {
    dryRun,
    sourceUrls: [CABINETRY_URL, ABSOLUTE_MATTE_URL, COLLECTION_URL],
    verifiedAt: VERIFIED_AT,
    productListingTileRecords: parseProductTiles(cabinetryHtml).length,
    absoluteMatteRecords: parseAbsoluteMatteTiles(absoluteMatteHtml).length,
    activeColours: new Set(active.map((record) => record.colourName)).size,
    activeCombinations: active.length,
    familyTotals,
    duplicatesDetected: duplicates.length,
    duplicateIds: duplicates,
    inactiveMarked: inactive.length,
    imagesStored,
    imageFailures,
  };
  if (!dryRun) {
    await fs.mkdir(path.dirname(CATALOGUE_PATH), { recursive: true });
    await fs.writeFile(CATALOGUE_PATH, `${JSON.stringify(finalRecords, null, 2)}\n`);
    await fs.writeFile(CATALOGUE_MODULE_PATH, `const laminexCabinetryColours = ${JSON.stringify(finalRecords, null, 2)};\n\nexport default laminexCabinetryColours;\n`);
    await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
