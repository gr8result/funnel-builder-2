// National Tiles flooring adapter for scripts/product-library/import-flooring.mjs.
//
// Sources (both public, both National Tiles' own storefront):
//   1. The storefront catalogue (Magento GraphQL, /graphql) for each non-tile flooring category:
//      the product list, SKU, regular and final (sale) price per m², image gallery and the
//      store's own sub-categories (e.g. Tongue & Groove, Floating, 5G Click, Herringbone).
//   2. Each product page: schema.org Product data (box price, coverage per box) and the published
//      specification table (size, thickness, finish, edge, slip rating, warranties ...).
// Nothing is inferred. A value the supplier does not publish stays null. Tiles are never read:
// only the four flooring categories below are listed.
import fs from "node:fs";
import path from "node:path";

export const key = "national-tiles";
export const name = "National Tiles";
const ORIGIN = "https://www.nationaltiles.com.au";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const DELAY_MS = 1500;

// The store's "Shop All" category for each flooring type (category uid -> Product Library type).
const CATEGORIES = [
  { uid: "Nzk1", flooringType: "hybrid", url: `${ORIGIN}/shop-hybrid-flooring/shop-all` },
  { uid: "NzQ3", flooringType: "vinyl", url: `${ORIGIN}/shop-vinyl-flooring/shop-all` },
  { uid: "Nzcx", flooringType: "laminate", url: `${ORIGIN}/shop-laminate-flooring/shop-all` },
  { uid: "ODEz", flooringType: "engineered-timber", url: `${ORIGIN}/shop-timber-fooring/shop-all` },
];

// National Tiles' own range names as they appear at the start of their product names (longest
// first). A name matching none falls back to its first word.
const COLLECTIONS = ["Classic Oak Hybrid", "Concept Oak Herringbone", "Concept Oak", "Project Oak", "Vale Mk2", "Vale", "Karratha", "Mistura", "Camino", "Chalet", "Rose Bay", "Nemora"];

// The store's installation-method sub-categories.
const INSTALLATION_CATEGORIES = [
  [/tongue-and-groove/, "Tongue & groove"],
  [/floating-engineered/, "Floating"],
  [/5g-click/, "5G click"],
  [/\/herringbone$/, "Herringbone"],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const decode = (text = "") => String(text).replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const number = (value) => { const parsed = Number(String(value ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; };
const money = (value) => { const parsed = number(value); return parsed === null ? null : Math.round(parsed * 100) / 100; };

async function graphql(query) {
  const response = await fetch(`${ORIGIN}/graphql`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT }, body: JSON.stringify({ query }) });
  if (!response.ok) throw new Error(`GraphQL HTTP ${response.status}`);
  const json = await response.json();
  if (json.errors?.length) throw new Error(`GraphQL: ${json.errors.map((error) => error.message).join("; ")}`);
  return json.data;
}

async function page(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parsePage(html) {
  const product = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => { try { return JSON.parse(match[1]); } catch { return null; } })
    .find((entry) => entry?.["@type"] === "Product") || null;
  const specs = Object.fromEntries([...html.matchAll(/<h3 class="specs-label">([\s\S]*?)<\/h3>\s*<div class="specs-data">([\s\S]*?)<\/div>/g)]
    .map((match) => [decode(match[1].replace(/<[^>]+>/g, "")), decode(match[2].replace(/<[^>]+>/g, ""))])
    .filter(([label, value]) => label && value && !/^(n\/a|not applicable)$/i.test(value)));
  const description = decode((html.match(/<div class="description-para">([\s\S]*?)<\/div>/)?.[1] || "").replace(/<strong>[\s\S]*$/i, "").replace(/<[^>]+>/g, " "));
  return { product, specs, description };
}

const spec = (specs, ...labels) => {
  for (const label of labels) {
    const found = Object.keys(specs).find((keyName) => keyName.toLowerCase() === label.toLowerCase());
    if (found) return specs[found];
  }
  return "";
};

function collectionOf(productName) {
  const name = decode(productName);
  return COLLECTIONS.find((collection) => name.toLowerCase().startsWith(`${collection.toLowerCase()} `)) || name.split(" ")[0];
}

// The colour / decor: the product name without its range name and the trailing
// "<thickness> <type> Flooring" wording (e.g. "Camino Atlas Uniclic Hybrid Flooring" -> "Atlas").
function colourOf(productName, collection) {
  return decode(productName)
    .slice(collection.length)
    .replace(/\b\d+(\.\d+)?\s*mm\b/gi, " ")
    .replace(/\b(uniclic|hybrid|vinyl plank|vinyl|laminate|engineered timber|timber)\b/gi, " ")
    .replace(/\bflooring\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function warrantyOf(specs) {
  const value = (label) => spec(specs, label) || null;
  const warranty = {
    residentialConsumer: value("Residential Consumer Warranty"),
    residentialBusiness: value("Residential Business Warranty"),
    nonResidentialConsumer: value("Non-Residential Consumer Warranty"),
    nonResidentialBusiness: value("Non-Residential Business Warranty"),
  };
  return Object.values(warranty).some(Boolean) ? warranty : null;
}

// Lists every non-tile flooring product and reads its page. Returns supplier-neutral variant
// records (one per National Tiles SKU) plus the failures.
export async function fetchVariants({ cacheDir, refreshPages = false, log = console.log } = {}) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const listed = [];
  for (const category of CATEGORIES) {
    const data = await graphql(`{ products(filter:{category_uid:{eq:"${category.uid}"}}, pageSize:200){ total_count items {
      sku name url_key __typename special_price
      price_range{ minimum_price{ regular_price{ value currency } final_price{ value } } }
      media_gallery{ url label position disabled }
      categories{ url_path } } } }`);
    const items = data.products.items || [];
    log(`${category.flooringType}: ${items.length} of ${data.products.total_count} listed`);
    items.forEach((item) => listed.push({ ...item, category }));
    await sleep(DELAY_MS);
  }

  const variants = [];
  const failures = [];
  for (const [index, item] of listed.entries()) {
    const url = `${ORIGIN}/${item.url_key}`;
    const cache = path.join(cacheDir, `${item.url_key}.html`);
    let html = !refreshPages && fs.existsSync(cache) ? fs.readFileSync(cache, "utf8") : "";
    if (!html) {
      try { html = await page(url); fs.writeFileSync(cache, html); } catch (error) { failures.push({ url, sku: item.sku, reason: error.message }); await sleep(DELAY_MS); continue; }
      await sleep(DELAY_MS);
    }
    const { product, specs, description } = parsePage(html);
    const sku = String(product?.sku || item.sku || "").trim();
    if (!sku) { failures.push({ url, reason: "no SKU on page" }); continue; }
    const material = spec(specs, "Material");
    if (/tile|porcelain|ceramic|stone/i.test(material)) { failures.push({ url, sku, reason: `not flooring (Material: ${material})` }); continue; }
    const offer = [].concat(product?.offers || [])[0] || {};
    const priceSpecs = [].concat(offer.priceSpecification || []);
    const pagePerM2 = money(priceSpecs.find((entry) => entry.referenceQuantity?.unitCode === "MTK")?.price);
    const pagePerBox = money(priceSpecs.find((entry) => entry.referenceQuantity?.unitCode === "C62")?.price ?? offer.price);
    const coverage = number([].concat(product?.additionalProperty || []).find((entry) => /coverage per box/i.test(entry.name || ""))?.value);
    const regular = money(item.price_range?.minimum_price?.regular_price?.value);
    const final = money(item.price_range?.minimum_price?.final_price?.value);
    const onSale = Boolean(regular && final && final < regular);
    const unit = (spec(specs, "Unit of Measure") || "sqm").toLowerCase();
    const perM2Unit = /sqm|m2|m²/.test(unit);
    const gallery = (item.media_gallery || []).filter((media) => media?.url && !media.disabled)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((media) => media.url.replace(/\?.*$/, ""));
    const officialImage = gallery[0] || [].concat(product?.image || [])[0] || "";
    const collection = collectionOf(item.name);
    const installation = (item.categories || []).map((entry) => INSTALLATION_CATEGORIES.find(([pattern]) => pattern.test(entry.url_path || ""))?.[1]).filter(Boolean);
    if (/uniclic/i.test(item.name)) installation.push("Uniclic click system");
    const warranty = warrantyOf(specs);
    variants.push({
      supplierKey: key,
      supplier: name,
      brand: product?.brand?.name || name,
      sku,
      externalProductId: item.url_key,
      productName: decode(item.name),
      productUrl: url,
      flooringType: item.category.flooringType,
      material,
      collection,
      colour: colourOf(item.name, collection),
      colourGroup: spec(specs, "Primary Colour", "colour"),
      lookDesign: spec(specs, "Look/Design"),
      widthMm: number(spec(specs, "Width")),
      lengthMm: number(spec(specs, "Length")),
      thicknessMm: number(spec(specs, "Thickness (mm)", "Thickness")),
      surfaceFinish: spec(specs, "Surface Finish", "Finish"),
      edge: spec(specs, "Edge"),
      slipRating: spec(specs, "Pendulum Rating", "Slip Rating"),
      variationRating: spec(specs, "Variation Rating"),
      installation: [...new Set(installation)],
      waterResistance: spec(specs, "Water Resistance", "Waterproof") || null,
      wearLayer: spec(specs, "Wear Layer") || null,
      warranty,
      // Use suitability as published through the supplier's own residential / non-residential warranties.
      suitability: warranty ? [warranty.residentialConsumer || warranty.residentialBusiness ? "residential" : "", warranty.nonResidentialConsumer || warranty.nonResidentialBusiness ? "commercial" : ""].filter(Boolean) : [],
      packCoverageM2: coverage,
      unitOfMeasure: unit,
      // Storefront regular price is the estimating price; a lower final price is a promotion.
      regularPricePerM2: perM2Unit ? (regular ?? pagePerM2) : null,
      salePricePerM2: perM2Unit && onSale ? final : null,
      regularPricePerPack: onSale ? null : pagePerBox,
      salePricePerPack: onSale ? pagePerBox : null,
      currency: item.price_range?.minimum_price?.regular_price?.currency || offer.priceCurrency || "AUD",
      priceBasis: "National Tiles online price, inc GST",
      priceSource: "nationaltiles.com.au storefront catalogue price + product page schema.org Offer",
      priceRetrievedAt: retrievedAt,
      officialImageUrl: officialImage,
      gallery,
      description,
      specs,
    });
    if ((index + 1) % 25 === 0) log(`${index + 1}/${listed.length} product pages read`);
  }
  return { variants, failures, listedCount: listed.length, sources: [...CATEGORIES.map((category) => category.url), `${ORIGIN}/graphql`] };
}
