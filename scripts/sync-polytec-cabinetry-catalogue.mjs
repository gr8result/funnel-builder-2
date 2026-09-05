import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data/product-library/catalogues/cabinetry");
const CATALOGUE_PATH = path.join(OUT_DIR, "AU-POLYTEC-CABINETRY-COLOURS.json");
const MODULE_PATH = path.join(OUT_DIR, "AU-POLYTEC-CABINETRY-COLOURS.js");
const REPORT_PATH = path.join(OUT_DIR, "AU-POLYTEC-CABINETRY-COLOURS.report.json");
const IMAGE_DIR = path.join(ROOT, "public/images/catalogues/polytec");
const OFFICIAL_HOST = "https://www.polytec.com.au";
const COLOURS_URL = `${OFFICIAL_HOST}/colours/`;
const PRODUCTS_URL = `${OFFICIAL_HOST}/products/`;
const DECORATIVE_18MM_URL = `${OFFICIAL_HOST}/products/decorative-18mm-doors-and-panels/`;
const DOWNLOAD_COLOURS_URL = `${OFFICIAL_HOST}/download-colours/`;
const VERIFIED_AT = "2026-08-31";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || args.has("--validate");
const limitArg = [...args].find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) || 0 : 0;

const DOOR_PANEL_ROWS = [
  "16mm Decorative doors & panels",
  "18mm Decorative doors & panels",
  "Thermolaminated doors & panels",
];

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#034;/g, '"')
    .replace(/&#10003;/g, "✓")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "'")
    .replace(/&ndash;/g, "-");
}

function stripTags(value = "") {
  return decodeHtml(String(value).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
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

function colourFamilyFor(colourName = "") {
  if (/oak|walnut|wood|ply|ash|teak|beech|rattan|wenge|figured|maple|cotton|botany|boston|laurel|society|district|plantation|ligurian|palomera|rubra|nordic|citrine|empire|havana|hazel|soft/i.test(colourName)) return "Woodgrains";
  if (/stone|marble|granite|cement|concrete|travertine|ceppo|slate|terrazzo|taj|onyx|limestone|marmo|buller|argento|alboran|ardesia|athena|nero|casastone|palatino|portland|portofino|urban|volcanic|visoni/i.test(colourName)) return "Minerals";
  if (/black|charcoal|graphite|phantom|obsidian|raven|anthracite/i.test(colourName)) return "Blacks";
  if (/grey|gray|pewter|nickel|silver|titanium|aluminium|stainless|elemental|nouveau|oyster|moss|mercu/i.test(colourName)) return "Greys";
  if (/green|blue|navy|red|clay|carmine|botanic|topiary|oasis|evergreen|forage|verd|peacock|agave|adriatic|arabica|oxford|saffron|citrine|bronze|gold|copper|rose|ochre/i.test(colourName)) return "Accents";
  if (/cream|beige|taupe|mink|parchment|papyrus|silk|bone|porcelain|white|alabaster|blossom|classic|crisp|designer|gossamer|natural|polar|solid|superior|ultra|mist|aston/i.test(colourName)) return "Whites & Neutrals";
  return "Whites & Neutrals";
}

function pricingTierFor(finish = "", productRange = "") {
  if (/Thermolaminated/i.test(productRange)) return "tier_4";
  if (/Venette|Ultraglaze|Ultramatt|Gloss|Metallic/i.test(finish)) return "tier_3";
  if (/Legato|Ravine|Woodmatt|Texture|Natura|Raw|Ashgrain|Sheen/i.test(finish)) return "tier_2";
  return "tier_1";
}

function priceStatusFor(tier = "") {
  if (tier === "tier_1") return "included";
  if (tier === "tier_2") return "upgrade";
  return "supplier_quote_required";
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "gr8-result-catalogue-sync/1.0" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

function parseColourThumbs(html = "") {
  const rows = [];
  const rx = /<li[^>]+class=['"][^'"]*colour-thumb[^'"]*['"][\s\S]*?<\/li>/g;
  for (const [block] of html.matchAll(rx)) {
    const urlSlug = block.match(/data-meta_colour_url=['"]([^'"]+)['"]/)?.[1] || block.match(/href=['"]\/colour\/([^/]+)\//)?.[1] || "";
    const name = stripTags(block.match(/<h5[^>]*>([\s\S]*?)<\/h5>/)?.[1] || block.match(/alt=['"]([^'"]+)['"]/)?.[1] || "");
    const swatch = block.match(/data-src=['"]([^'"]+)['"]/)?.[1] || block.match(/content=['"]([^'"]+\/img\/products\/[^'"]+)['"]/)?.[1] || "";
    const fullSheet = block.match(/content=['"]([^'"]*\/img\/products\/[^'"]+)['"]/)?.[1] || `/img/products/${urlSlug}.jpg`;
    if (!urlSlug || !name) continue;
    rows.push({ colourName: name, colourSlug: urlSlug, officialProductUrl: `${OFFICIAL_HOST}/colour/${urlSlug}/`, officialSwatchUrl: absoluteUrl(swatch || `/img/products/140-140/${urlSlug}.jpg`), officialFullSheetUrl: absoluteUrl(fullSheet) });
  }
  return rows;
}

function parseDescription(html = "") {
  return stripTags(html.match(/<p class=['"]description['"]><b>Colour:<\/b>([\s\S]*?)<\/p>/)?.[1] || html.match(/<meta property=["']og:description["'] content=["']([^"']+)["']/)?.[1] || "");
}

function parseHeroImage(html = "") {
  return absoluteUrl(html.match(/<div class=['"]background['"]>\s*<img[^>]+src=['"]([^'"]+)['"]/)?.[1] || html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/)?.[1] || "");
}

function parseFinishTabs(html = "") {
  const finishes = new Set();
  const rx = /<li class=['"]tabs-title[^'"]*['"][^>]+data-url=['"][^'"]+['"][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(rx)) {
    const finish = stripTags(match[1].replace(/<sup[\s\S]*?<\/sup>/g, ""));
    if (finish) finishes.add(finish);
  }
  return finishes;
}

function parseMatrixRecords(html = "", colour) {
  const table = html.match(/<table class=["']product-colour-matrix-table["']>([\s\S]*?)<\/table>/)?.[1] || "";
  if (!table) return [];
  const headers = [...table.matchAll(/<th class=['"]text-center['"]>([\s\S]*?)<\/th>/g)].map((match) => stripTags(match[1]));
  const tabFinishes = parseFinishTabs(html);
  const records = [];
  const rowRx = /<tr>\s*<th class=['"]text-left['"]>([\s\S]*?)<\/th>([\s\S]*?)<\/tr>/g;
  for (const rowMatch of table.matchAll(rowRx)) {
    const productRange = stripTags(rowMatch[1]);
    if (!DOOR_PANEL_ROWS.includes(productRange)) continue;
    const cells = [...rowMatch[2].matchAll(/<td class=['"]text-center['"]>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
    cells.forEach((cell, index) => {
      const finish = headers[index];
      const available = /10003|✓|fa-check|<b>/i.test(cell);
      if (!available || !finish) return;
      const displayFinish = /^Ultramatt$/i.test(finish) ? "ULTRAMATT" : /^Gloss$/i.test(finish) ? "ULTRAGLAZE" : finish;
      const productRangeDisplay = /16mm/i.test(productRange)
        ? "Decorative 16mm doors and panels"
        : /18mm/i.test(productRange)
          ? "Decorative 18mm doors and panels"
          : "Thermolaminated doors and panels";
      const pricingTier = pricingTierFor(displayFinish, productRangeDisplay);
      records.push({
        id: `polytec-${colour.colourSlug}-${slug(productRangeDisplay)}-${slug(displayFinish)}`,
        supplier: "Polytec",
        brand: "Polytec",
        colourName: colour.colourName,
        colourCode: colour.colourSlug,
        colourFamily: colourFamilyFor(colour.colourName),
        productRange: productRangeDisplay,
        productFamily: productRangeDisplay,
        finish: displayFinish,
        application: productRangeDisplay,
        productApplication: productRangeDisplay,
        substrate: /Thermolaminated/i.test(productRangeDisplay) ? "Supplier-published thermolaminated substrate" : "Supplier-published decorative board substrate",
        thickness: /16mm/i.test(productRangeDisplay) ? "16mm" : /18mm/i.test(productRangeDisplay) ? "18mm" : "Supplier published profile thickness",
        doorPanelSuitability: true,
        benchtopSuitability: false,
        matchingEdgingAvailability: !/Thermolaminated/i.test(productRangeDisplay),
        pricingTier,
        priceStatus: priceStatusFor(pricingTier),
        swatchImage: `/images/catalogues/polytec/${colour.colourSlug}.jpg`,
        swatchThumbnail: `/images/catalogues/polytec/${colour.colourSlug}.jpg`,
        fullSheetImage: `/images/catalogues/polytec/${colour.colourSlug}-full.jpg`,
        officialSwatchUrl: colour.officialSwatchUrl,
        officialFullSheetUrl: colour.officialFullSheetUrl,
        officialProductUrl: colour.officialProductUrl,
        officialCollectionUrl: DECORATIVE_18MM_URL,
        sourceUrl: colour.officialProductUrl,
        availabilityStatus: "active",
        status: "active",
        verifiedAt: VERIFIED_AT,
        lastVerifiedDate: VERIFIED_AT,
        source: "Polytec official colour page availability matrix",
        sourceNotes: tabFinishes.size ? `Published colour finish tabs: ${[...tabFinishes].join(", ")}` : "Availability from official colour matrix.",
        description: parseDescription(html),
      });
    });
  }
  return records;
}

async function downloadImage(url, fileName, failures) {
  if (!url || dryRun) return false;
  const target = path.join(IMAGE_DIR, fileName);
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    try {
      await fs.access(target);
      return false;
    } catch {}
    const response = await fetch(url, { headers: { "user-agent": "gr8-result-catalogue-sync/1.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await fs.writeFile(target, Buffer.from(await response.arrayBuffer()));
    return true;
  } catch (error) {
    failures.push({ url, fileName, reason: error.message });
    return false;
  }
}

async function main() {
  const [coloursHtml, productsHtml, decorative18Html, downloadColoursHtml] = await Promise.all([
    fetchText(COLOURS_URL),
    fetchText(PRODUCTS_URL),
    fetchText(DECORATIVE_18MM_URL),
    fetchText(DOWNLOAD_COLOURS_URL),
  ]);
  const colourThumbs = parseColourThumbs(coloursHtml);
  const coloursToFetch = limit ? colourThumbs.slice(0, limit) : colourThumbs;
  const records = [];
  const failures = [];
  let imagesStored = 0;

  for (let index = 0; index < coloursToFetch.length; index += 1) {
    const colour = coloursToFetch[index];
    try {
      const html = await fetchText(colour.officialProductUrl);
      const colourWithHero = { ...colour, officialFullSheetUrl: parseHeroImage(html) || colour.officialFullSheetUrl };
      records.push(...parseMatrixRecords(html, colourWithHero));
      if (!dryRun) {
        if (await downloadImage(colourWithHero.officialSwatchUrl, `${colourWithHero.colourSlug}.jpg`, failures)) imagesStored += 1;
        if (await downloadImage(colourWithHero.officialFullSheetUrl, `${colourWithHero.colourSlug}-full.jpg`, failures)) imagesStored += 1;
      }
    } catch (error) {
      failures.push({ colourName: colour.colourName, url: colour.officialProductUrl, reason: error.message });
    }
  }

  const byId = new Map();
  const duplicates = [];
  for (const record of records) {
    if (byId.has(record.id)) duplicates.push(record.id);
    else byId.set(record.id, record);
  }
  const uniqueRecords = [...byId.values()].sort((left, right) => `${left.colourName} ${left.productRange} ${left.finish}`.localeCompare(`${right.colourName} ${right.productRange} ${right.finish}`));
  const colourCount = new Set(uniqueRecords.map((record) => record.colourName)).size;
  const report = {
    dryRun,
    sourceUrls: {
      colours: COLOURS_URL,
      products: PRODUCTS_URL,
      decorative18mmDoorsAndPanels: DECORATIVE_18MM_URL,
      downloadColours: DOWNLOAD_COLOURS_URL,
    },
    officialClaims: {
      coloursPageMentionsMoreThan300Colours: /over 300 colours/i.test(coloursHtml),
      decorative18mmDescriptionMentionsDoorFinishes: /CREATEC, RAVINE, LEGATO, VENETTE, and WOODMATT/i.test(decorative18Html),
      downloadColoursPageFetched: /Download Colours/i.test(downloadColoursHtml),
      productsPageFetched: /Products/i.test(productsHtml),
    },
    verifiedAt: VERIFIED_AT,
    colourPagesDiscovered: colourThumbs.length,
    colourPagesFetched: coloursToFetch.length,
    importedColours: colourCount,
    importedColourFinishVariants: uniqueRecords.length,
    recordsExcluded: colourThumbs.length - colourCount,
    exclusionReason: "Colours with no official 16mm decorative, 18mm decorative, or thermolaminated door/panel matrix availability were not imported as cabinetry door/panel choices.",
    variantsByProductRange: uniqueRecords.reduce((acc, record) => {
      acc[record.productRange] = (acc[record.productRange] || 0) + 1;
      return acc;
    }, {}),
    variantsByFinish: uniqueRecords.reduce((acc, record) => {
      acc[record.finish] = (acc[record.finish] || 0) + 1;
      return acc;
    }, {}),
    duplicatesDetected: duplicates.length,
    duplicateIds: duplicates,
    imageFailures: failures.filter((failure) => failure.fileName),
    fetchFailures: failures.filter((failure) => !failure.fileName),
    imagesStored,
  };

  if (!dryRun) {
    await fs.mkdir(OUT_DIR, { recursive: true });
    await fs.writeFile(CATALOGUE_PATH, `${JSON.stringify(uniqueRecords, null, 2)}\n`);
    await fs.writeFile(MODULE_PATH, `export default ${JSON.stringify(uniqueRecords, null, 2)};\n`);
    await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
