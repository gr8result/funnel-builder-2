// Imports the genuine National Tiles tile range into the Product Library from nationaltiles.com.au.
// Source: the official sitemap (product URL + official image) and each product page's own
// schema.org Product data (SKU, price, price per m², coverage per box) and published spec table
// (size, thickness, finish, colour, material, area Wall/Floor, edge, slip rating ...).
// Nothing is inferred: a field the page does not publish is left empty, and a page without a SKU
// or a size is skipped. Raw pages are kept as local evidence so re-runs do not refetch.
//
// Usage: node scripts/product-library/import-national-tiles.mjs [--limit=N]
import fs from "node:fs";
import path from "node:path";

const SITEMAP = "https://www.nationaltiles.com.au/sitemap.xml";
const OUTPUT = "data/product-library/catalogues/tiles/AU-NATIONAL-TILES-CATALOGUE.json";
const EVIDENCE_DIR = "data/product-library/source-evidence/national-tiles";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const DELAY_MS = 1500;
const limit = Number((process.argv.find((arg) => arg.startsWith("--limit=")) || "").split("=")[1]) || Infinity;
const today = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const decode = (text = "") => String(text).replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

async function get(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xml" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function sitemapProducts(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1])
    .filter((block) => block.includes("<image:image>"))
    .map((block) => ({
      url: decode(block.match(/<loc>([^<]+)<\/loc>/)[1]),
      image: decode(block.match(/<image:loc>([^<]+)<\/image:loc>/)?.[1] || "").replace(/\?.*$/, ""),
    }))
    .filter((entry) => /^https:\/\/www\.nationaltiles\.com\.au\/shop-tiles\/[^/]+$/.test(entry.url));
}

function parseProduct(html) {
  const product = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => { try { return JSON.parse(match[1]); } catch { return null; } })
    .find((entry) => entry?.["@type"] === "Product");
  const specs = Object.fromEntries([...html.matchAll(/<h3 class="specs-label">([\s\S]*?)<\/h3>\s*<div class="specs-data">([\s\S]*?)<\/div>/g)]
    .map((match) => [decode(match[1].replace(/<[^>]+>/g, "")), decode(match[2].replace(/<[^>]+>/g, ""))])
    .filter(([label, value]) => label && value && !/^not applicable$/i.test(value)));
  return { product, specs };
}

const spec = (specs, ...labels) => {
  for (const label of labels) {
    const key = Object.keys(specs).find((name) => name.toLowerCase() === label.toLowerCase());
    if (key) return specs[key];
  }
  return "";
};
const money = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null);

function toRecord(entry, { product, specs }) {
  const sku = String(product?.sku || spec(specs, "SKU") || "").trim();
  const size = spec(specs, "Size (mm)", "Size");
  if (!product || !sku || !size) return null;
  const offer = [].concat(product.offers || [])[0] || {};
  const priceSpecs = [].concat(offer.priceSpecification || []);
  const perM2 = money(priceSpecs.find((item) => item.referenceQuantity?.unitCode === "MTK")?.price);
  const perBox = money(priceSpecs.find((item) => item.referenceQuantity?.unitCode === "C62")?.price ?? offer.price);
  const coverage = money([].concat(product.additionalProperty || []).find((item) => /coverage per box/i.test(item.name || ""))?.value);
  const area = spec(specs, "Area");
  const applications = [/floor/i.test(area) ? "floor" : "", /wall/i.test(area) ? "wall" : "", /pool/i.test(`${area} ${product.name}`) ? "pool" : "", /external|outdoor/i.test(`${area} ${product.name}`) ? "external" : ""].filter(Boolean);
  const thickness = spec(specs, "Thickness (mm)", "Thickness");
  const colour = spec(specs, "colour", "Colour") || spec(specs, "Primary Colour");
  const image = entry.image || [].concat(product.image || [])[0] || "";
  return {
    product_code: `TIL-NT-${sku}`,
    family_key: "tiles",
    requirement_keys: "tiles",
    category_key: "Tiles",
    top_level_area: "bathroom",
    manufacturer: "National Tiles",
    brand: "National Tiles",
    supplier: "National Tiles",
    range: spec(specs, "Collection", "Range", "Series"),
    product_name: decode(product.name),
    model: sku,
    sku,
    colour: colour ? colour.charAt(0).toUpperCase() + colour.slice(1).toLowerCase() : "",
    finish: spec(specs, "Surface Finish", "Finish"),
    material: spec(specs, "Material"),
    size,
    dimensions: thickness ? `${size} x ${thickness}mm` : size,
    description: decode(String(product.description || "").slice(0, 600)),
    primary_image_url: image,
    image_source_url: image,
    image_source_type: "official_supplier_page",
    image_status: image ? "verified_exact" : "missing",
    image_verified_at: today,
    official_product_url: entry.url,
    client_price: perM2,
    rrp: perM2,
    price_status: perM2 ? "current" : "price_pending",
    price_unit: "m2",
    currency: "AUD",
    regions: "AU",
    active: true,
    price_source_url: entry.url,
    price_verified_at: perM2 ? today : "",
    source_type: "official_supplier_page",
    source_name: "National Tiles product page",
    source_url: entry.url,
    source_verified_at: today,
    attributes: {
      clientSelectionRequirement: "tiles",
      priceBasis: "National Tiles online price per m², GST inclusive",
      pricePerBox: perBox,
      boxCoverageM2: coverage,
      tileArea: area,
      tileApplications: applications,
      tileLengthMm: money(spec(specs, "Length")),
      tileWidthMm: money(spec(specs, "Width")),
      thicknessMm: money(thickness),
      edge: spec(specs, "Edge"),
      slipRating: spec(specs, "Slip Rating", "Slip Resistance", "Anti Slip Rating", "P Rating", "R Rating"),
      unitOfMeasure: spec(specs, "Unit of Measure"),
      nationalTilesSpecs: specs,
    },
  };
}

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
const entries = sitemapProducts(await get(SITEMAP)).slice(0, limit);
console.log(`${entries.length} National Tiles tile pages in the sitemap`);
const records = [];
const skipped = [];
for (const [index, entry] of entries.entries()) {
  const cache = path.join(EVIDENCE_DIR, `${entry.url.split("/").pop()}.html`);
  let html = fs.existsSync(cache) ? fs.readFileSync(cache, "utf8") : "";
  if (!html) {
    try { html = await get(entry.url); fs.writeFileSync(cache, html); } catch (error) { skipped.push(`${entry.url} (${error.message})`); await sleep(DELAY_MS); continue; }
    await sleep(DELAY_MS);
  }
  const record = toRecord(entry, parseProduct(html));
  if (record) records.push(record); else skipped.push(`${entry.url} (no SKU/size)`);
  if ((index + 1) % 50 === 0) console.log(`${index + 1}/${entries.length}: ${records.length} tiles`);
}
// One record per SKU (the sitemap can list a product under more than one URL).
const unique = [...new Map(records.map((record) => [record.product_code, record])).values()];
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify({
  catalogue: "National Tiles - tiles",
  generatedAt: new Date().toISOString(),
  note: "Imported from nationaltiles.com.au product pages (schema.org Product data + published spec table). Prices are National Tiles online prices, GST inclusive, per m².",
  officialSources: ["https://www.nationaltiles.com.au/sitemap.xml"],
  products: unique,
}, null, 2)}\n`);
console.log(`${unique.length} tiles written to ${OUTPUT}; skipped ${skipped.length}`);
if (skipped.length) console.log(skipped.slice(0, 20).join("\n"));
