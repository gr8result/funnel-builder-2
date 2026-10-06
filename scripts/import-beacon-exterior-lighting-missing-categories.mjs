/**
 * Imports Beacon Lighting products for the three External Lighting categories that
 * are currently empty: Bollards & Posts, Step & Deck, and Garden & Landscape.
 *
 * Why they were empty: scripts/audit-beacon-outdoor-catalogue.mjs only ever scraped
 * six Beacon category URLs (wall, security/sensor, solar, pendant, flood, outdoor),
 * so the rebuild script's CATEGORY_RULES for bollards/step/garden never had any
 * source rows to classify. Beacon has also since restructured its site
 * (/lighting/outdoor-lighting now 301s to /exterior/...), so this script uses the
 * current category paths.
 *
 * Data provenance: category pages are only used to DISCOVER product URLs. Every
 * field written to the catalogue comes from that product's own page - the
 * schema.org Product JSON-LD Beacon publishes (name, sku, brand, price, image) -
 * and the image URL is fetched and confirmed to serve image/* before use. Nothing
 * is inferred where the supplier does not publish it; unpublished fields are
 * recorded as "Not published by supplier", matching the existing records.
 *
 * Record shape and the derivation helpers below mirror
 * scripts/rebuild-beacon-exterior-lighting-catalogue.mjs so imported rows are
 * indistinguishable from rebuilt ones.
 *
 * Usage:
 *   node scripts/import-beacon-exterior-lighting-missing-categories.mjs [--dry-run] [--limit N]
 */
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const CATALOGUE_PATH = "data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json";
const REPORT_PATH = "data/product-library/source-evidence/beacon-exterior-lighting/MISSING-CATEGORY-IMPORT-REPORT.json";
const NOT_PUBLISHED = "Not published by supplier";
const VERIFIED_AT = new Date().toISOString().slice(0, 10);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i === -1 ? Infinity : Number(args[i + 1]) || Infinity;
})();

/** Beacon's current category paths for the three empty buckets. */
const SOURCES = [
  ["Deck Lighting", "https://www.beaconlighting.com.au/exterior/deck-lighting"],
  ["Exterior Step Lights", "https://www.beaconlighting.com.au/exterior/exterior-step-lights"],
  ["Garden Lighting", "https://www.beaconlighting.com.au/exterior/garden-lighting"],
];

/** Only these three are imported; anything else is already covered by the catalogue. */
const WANTED = new Set(["Bollards & Posts", "Step & Deck", "Garden & Landscape"]);

// --- derivation helpers (kept in step with rebuild-beacon-exterior-lighting-catalogue.mjs) ---
const CATEGORY_RULES = [
  ["Bollards & Posts", /bollard|post|pedestal/i],
  ["Step & Deck", /step|deck|inground|in-ground|recessed floor/i],
  ["Garden & Landscape", /garden|spike|path|pathway|landscape|flood the garden|tree/i],
];

function slug(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function categoryFor({ name, sourceLabel, url }) {
  const haystack = `${name} ${url}`;
  const found = CATEGORY_RULES.find(([, pattern]) => pattern.test(haystack));
  if (found) return found[0];
  // Fall back to the category the product was listed under.
  if (/deck|step/i.test(sourceLabel)) return "Step & Deck";
  if (/garden/i.test(sourceLabel)) return "Garden & Landscape";
  return "";
}

function rangeFromName(name = "") {
  return name
    .replace(/^Made By Mayfair\s+/i, "Made by Mayfair ")
    .split(/\s+(?:\d+\s+Light|LED|Exterior|Outdoor|Wall|Flood|Pendant|Solar|12V|240V|Spike|Bollard|Post|Step|Deck)/i)[0]
    .replace(/\s+In$/i, "")
    .trim() || "Beacon Outdoor";
}

function constructionType(name = "") {
  if (/solar/i.test(name)) return "Solar fitting";
  if (/\b12v\b|12\/24v|24v|low voltage|diy quick connect/i.test(name)) return "Low-voltage wired fitting";
  if (/festoon|string light|plug/i.test(name)) return "Plug-in fitting";
  if (/globe|lamp only/i.test(name)) return "Globe/light source";
  if (/transformer|controller|driver/i.test(name)) return "Transformer/controller";
  return "Fixed hardwired fitting";
}

function voltageFor(name = "") {
  if (/12\/24v/i.test(name)) return "12/24V";
  if (/\b12v\b/i.test(name)) return "12V";
  if (/\b24v\b/i.test(name)) return "24V";
  if (/\b240v\b/i.test(name)) return "240V";
  if (/solar/i.test(name)) return "Solar";
  return NOT_PUBLISHED;
}

function finishFromName(name = "") {
  const match = name.match(/\bIn\s+(.+?)(?:\s+With|\s+And|$)/i);
  return match?.[1]?.trim() || NOT_PUBLISHED;
}

function lightSource(name = "") {
  if (/integrated led|led/i.test(name)) return { integratedLed: true, globeType: "Integrated LED", globeIncluded: "Included where integrated LED is specified" };
  return { integratedLed: false, globeType: NOT_PUBLISHED, globeIncluded: NOT_PUBLISHED };
}

function sensorType(name = "") {
  if (/motion sensor/i.test(name)) return "Motion sensor";
  if (/sensor/i.test(name)) return "Sensor";
  return "";
}

function locationSuitability(category, type) {
  const base = ["Front entry", "Porch", "Garage exterior", "Alfresco", "Patio", "Balcony", "Covered outdoor locations"];
  if (category === "Garden & Landscape") return ["Pathway", "Garden", "Driveway", "Side access"];
  if (category === "Bollards & Posts") return ["Pathway", "Garden", "Driveway"];
  if (category === "Step & Deck") return ["Step", "Deck", "Pathway"];
  if (type === "Plug-in fitting") return ["Alfresco", "Patio", "Covered outdoor locations"];
  return base;
}

// --- discovery -------------------------------------------------------------
async function discover(page, [label, url]) {
  const found = new Map();
  for (let pageNo = 1; pageNo <= 4; pageNo += 1) {
    const target = pageNo === 1 ? url : `${url}?page=${pageNo}`;
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page
      .waitForFunction(() => document.querySelectorAll('img[src*="assets.beaconlighting.com.au"]').length > 3, { timeout: 45000 })
      .catch(() => {});
    // Let lazy tiles settle.
    await page.evaluate(async () => {
      for (let y = 0; y < 6; y += 1) {
        window.scrollBy(0, window.innerHeight);
        await new Promise((r) => setTimeout(r, 400));
      }
    });
    const slugs = await page.evaluate(() =>
      [...document.querySelectorAll('img[src*="assets.beaconlighting.com.au"]')]
        .map((img) => img.closest("a[href]")?.getAttribute("href") || "")
        .filter((href) => /^\/[a-z0-9-]+$/.test(href))
    );
    const before = found.size;
    for (const s of new Set(slugs)) {
      if (!found.has(s)) found.set(s, { sourceLabel: label, sourceUrl: url, slug: s });
    }
    if (found.size === before) break; // page added nothing new
  }
  console.log(`  ${label}: ${found.size} product links`);
  return [...found.values()];
}

// --- enrichment from the product's own page --------------------------------
/** Reads one balanced JSON-LD node of the given @type out of the page HTML. */
function extractJsonLdNode(html, type) {
  const start = html.indexOf(`{"@context":"https://schema.org","@type":"${type}"`);
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < html.length; i += 1) {
    const ch = html[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/**
 * Beacon publishes a plain Product for single-finish items and a ProductGroup for
 * items sold in several colours. On a ProductGroup page the top-level name/sku/
 * image already describe the finish being viewed; only the price sits on the
 * matching hasVariant entry, so pick the variant whose url matches this page.
 */
function extractJsonLdProduct(html, pageUrl) {
  const product = extractJsonLdNode(html, "Product");
  if (product?.name) return product;

  const group = extractJsonLdNode(html, "ProductGroup");
  if (!group?.name) return null;

  const variants = Array.isArray(group.hasVariant) ? group.hasVariant : [];
  const match = variants.find((v) => v?.url === pageUrl)
    || variants.find((v) => String(v?.sku || "") === String(group.sku || ""))
    || null;

  return {
    ...group,
    "@type": "Product",
    offers: match?.offers || group.offers,
    image: group.image || match?.image,
    colour: match?.color || "",
  };
}

async function enrich(entry) {
  const url = `https://www.beaconlighting.com.au${entry.slug}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow" });
  if (!res.ok) return { ...entry, url, status: "failed", reason: `product page HTTP ${res.status}` };
  const html = await res.text();
  const ld = extractJsonLdProduct(html, url);
  if (!ld?.name) return { ...entry, url, status: "failed", reason: "no schema.org Product/ProductGroup on page" };

  const image = ld.image || "";
  if (!image) return { ...entry, url, status: "failed", reason: "no image published" };
  const imgRes = await fetch(image, { headers: { "User-Agent": UA }, redirect: "follow" }).catch(() => null);
  const type = imgRes?.headers.get("content-type") || "";
  if (!imgRes?.ok || !type.startsWith("image/")) {
    return { ...entry, url, status: "failed", reason: `image not served (${imgRes?.status || "network"} ${type || "no type"})` };
  }

  return {
    ...entry,
    url,
    status: "ok",
    name: String(ld.name).trim(),
    sku: String(ld.sku || "").trim(),
    brand: ld.brand?.name || "",
    description: String(ld.description || "").trim(),
    colour: String(ld.colour || "").trim(),
    image,
    price: typeof ld.offers?.price === "number" ? ld.offers.price : Number(ld.offers?.price) || null,
    currency: ld.offers?.priceCurrency || "AUD",
    availability: String(ld.offers?.availability || "").split("/").pop() || "",
  };
}

function buildRecord(p) {
  const name = p.name;
  const category = p.exteriorCategory;
  const type = constructionType(name);
  const sku = p.sku;
  const price = p.price;
  const { integratedLed, globeType, globeIncluded } = lightSource(name);
  const sensor = sensorType(name);
  // Prefer the colour the supplier states on the variant over parsing it out of the name.
  const finish = p.colour || finishFromName(name);
  return {
    product_code: `BEACON-EXT-${sku || slug(name).toUpperCase().slice(0, 56)}`,
    stable_product_id: `beacon-exterior-${sku || slug(name)}`,
    family_key: "external-lighting",
    requirement_keys: "external-lighting",
    category_key: "External Lighting",
    top_level_area: "exterior",
    manufacturer: "Beacon Lighting",
    brand: p.brand || "Beacon Lighting",
    supplier: "Beacon Lighting",
    range: rangeFromName(name),
    product_name: name,
    model: name,
    description: p.description || `Beacon Lighting exterior product from ${p.sourceLabel}. ${NOT_PUBLISHED} for unpublished specifications.`,
    colour: finish,
    finish,
    configuration: slug(category),
    material: NOT_PUBLISHED,
    primary_image_url: p.image,
    thumbnail_url: p.image,
    gallery_image_urls: p.image,
    image_source_url: p.url,
    image_source_type: "official_product_page",
    image_verified_at: VERIFIED_AT,
    image_status: "verified_official_product_page",
    official_product_url: p.url,
    specification_url: p.url,
    supplier_url: p.sourceUrl,
    current_listed_price: price,
    selected_cost: price,
    client_price: price,
    price_status: price == null ? "quote_required" : "current",
    price_unit: "each",
    price_verified_at: VERIFIED_AT,
    sale_clearance_status: "standard_or_not_published",
    currency: p.currency || "AUD",
    gst_included: "true",
    country: "AU",
    regions: "AU;QLD",
    active: "true",
    discontinued: "false",
    archived: "false",
    source_type: "official_beacon_product_page",
    source_name: p.sourceLabel,
    source_url: p.sourceUrl,
    source_retrieved_at: VERIFIED_AT,
    source_verified_at: VERIFIED_AT,
    attributes: {
      recordType: "beacon_exterior_light",
      beaconSku: sku || NOT_PUBLISHED,
      exteriorCategory: category,
      productSubtype: p.sourceLabel,
      constructionSuitability: type,
      installationType: type,
      electricianRequired: type === "Fixed hardwired fitting",
      diyLowVoltage: type === "Low-voltage wired fitting" && /DIY/i.test(name),
      solarNoElectricalPoint: type === "Solar fitting",
      transformerRequired: type === "Low-voltage wired fitting",
      globeIncluded,
      integratedLed,
      replaceableGlobe: integratedLed ? false : NOT_PUBLISHED,
      globeType,
      ipRating: NOT_PUBLISHED,
      width: NOT_PUBLISHED,
      height: NOT_PUBLISHED,
      depthProjection: NOT_PUBLISHED,
      voltage: voltageFor(name),
      wattage: name.match(/\b\d+w\b/i)?.[0]?.toUpperCase() || NOT_PUBLISHED,
      lumens: NOT_PUBLISHED,
      colourTemperature: /warm white/i.test(name) ? "Warm White" : NOT_PUBLISHED,
      dimmable: NOT_PUBLISHED,
      sensorType: sensor,
      sensorIncluded: Boolean(sensor),
      detectionRange: NOT_PUBLISHED,
      timerSettings: NOT_PUBLISHED,
      coastalSuitability: NOT_PUBLISHED,
      exposureLimitations: "Confirm covered/exposed location suitability, IP rating and installation instructions with Beacon Lighting and licensed electrician.",
      warranty: NOT_PUBLISHED,
      includedStatus: price == null ? "quote_required" : "upgrade",
      defaultQuantity: 1,
      locationSuitability: locationSuitability(category, type),
      poolZoneRestriction: "Builder/electrician confirmation required. Do not use for pool-zone compliance without supplier and AS/NZS advice.",
      quantitySource: "Electrical schedule or manually assigned exterior lighting points",
      updateProcess: "Matched by Beacon SKU where published, otherwise stable product URL slug.",
      supplierAvailabilityAtImport: p.availability || NOT_PUBLISHED,
    },
  };
}

async function main() {
  const catalogue = JSON.parse(await fs.readFile(CATALOGUE_PATH, "utf8"));
  const existingCodes = new Set(catalogue.products.map((p) => p.product_code));
  const existingUrls = new Set(catalogue.products.map((p) => p.official_product_url).filter(Boolean));

  console.log("Discovering products from Beacon category pages...");
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  let discovered = [];
  try {
    for (const source of SOURCES) discovered.push(...(await discover(page, source)));
  } finally {
    await browser.close();
  }

  // One product can appear in two categories; keep the first sighting.
  const bySlug = new Map();
  for (const d of discovered) if (!bySlug.has(d.slug)) bySlug.set(d.slug, d);
  let candidates = [...bySlug.values()].filter((d) => !existingUrls.has(`https://www.beaconlighting.com.au${d.slug}`));
  if (LIMIT !== Infinity) candidates = candidates.slice(0, LIMIT);
  console.log(`\n${bySlug.size} unique products discovered, ${candidates.length} not already in the catalogue.\n`);

  console.log("Reading each product's own page for authoritative data...");
  const enriched = [];
  for (const [i, c] of candidates.entries()) {
    const r = await enrich(c);
    if (r.status === "ok") {
      r.exteriorCategory = categoryFor(r);
      if (!WANTED.has(r.exteriorCategory)) {
        r.status = "skipped";
        r.reason = `classified as ${r.exteriorCategory || "unmatched"}, not a target category`;
      }
    }
    enriched.push(r);
    process.stdout.write(`  [${i + 1}/${candidates.length}] ${r.name || c.slug} -> ${r.status === "ok" ? r.exteriorCategory : `${r.status}: ${r.reason}`}\n`);
    await new Promise((r2) => setTimeout(r2, 250));
  }

  const importable = enriched.filter((r) => r.status === "ok");
  const records = [];
  for (const r of importable) {
    const record = buildRecord(r);
    if (existingCodes.has(record.product_code)) continue;
    existingCodes.add(record.product_code);
    records.push(record);
  }

  const counts = records.reduce((acc, r) => {
    acc[r.attributes.exteriorCategory] = (acc[r.attributes.exteriorCategory] || 0) + 1;
    return acc;
  }, {});

  console.log("\n--- import summary ---");
  console.log(JSON.stringify({ discovered: bySlug.size, enriched: enriched.length, imported: records.length, byCategory: counts }, null, 2));

  const report = {
    importedAt: VERIFIED_AT,
    purpose: "Populate the External Lighting categories that had no products: Bollards & Posts, Step & Deck, Garden & Landscape.",
    method: "Category pages used only to discover product URLs; every field taken from the product's own schema.org Product JSON-LD, with the image URL confirmed to serve image/* before use.",
    sources: SOURCES.map(([label, url]) => ({ label, url })),
    counts: { discovered: bySlug.size, candidates: candidates.length, imported: records.length, byCategory: counts },
    failures: enriched.filter((r) => r.status === "failed").map(({ slug: s, url, reason }) => ({ slug: s, url, reason })),
    skipped: enriched.filter((r) => r.status === "skipped").map(({ slug: s, reason }) => ({ slug: s, reason })),
    imported: records.map((r) => ({
      product_code: r.product_code,
      product_name: r.product_name,
      exteriorCategory: r.attributes.exteriorCategory,
      price: r.current_listed_price,
      image: r.primary_image_url,
      source: r.official_product_url,
    })),
  };

  if (DRY_RUN) {
    console.log("\nDry run: nothing written.");
    console.log(JSON.stringify(report.imported.slice(0, 5), null, 2));
    return;
  }

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (!records.length) {
    console.log("\nNothing new to import; catalogue unchanged.");
    return;
  }

  catalogue.products.push(...records);
  const sourceSet = new Set([...(catalogue.officialSources || []), ...(catalogue.sourceUrls || [])]);
  for (const r of records) {
    sourceSet.add(r.official_product_url);
    sourceSet.add(r.supplier_url);
  }
  catalogue.officialSources = [...sourceSet].filter(Boolean).sort();
  catalogue.sourceUrls = [...sourceSet].filter(Boolean).sort();

  const lighting = catalogue.products.filter((p) => p.family_key === "external-lighting");
  catalogue.beaconExteriorLightingCatalogue = {
    ...catalogue.beaconExteriorLightingCatalogue,
    activeExteriorProductCount: lighting.length,
    categories: lighting.reduce((acc, p) => {
      const k = p.attributes?.exteriorCategory || "Uncategorised";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
    missingCategoryImport: {
      importedAt: VERIFIED_AT,
      imported: records.length,
      byCategory: counts,
      report: REPORT_PATH,
    },
  };

  await fs.writeFile(CATALOGUE_PATH, `${JSON.stringify(catalogue, null, 2)}\n`, "utf8");
  console.log(`\nImported ${records.length} products. External Lighting now has ${lighting.length} products.`);
  console.log(`Report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
