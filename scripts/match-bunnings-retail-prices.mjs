// Matches collected Bunnings retail listings (scripts/collect-bunnings-retail-prices.mjs) to
// Product Library products that have no price, and writes the matches as retail price data:
// data/product-library/pricing/BUNNINGS-RETAIL-PRICES.json (applied by masterPriceReconciliation.js).
//
// Strict matching, never a guess:
// - same brand, and the product's exact model code appears as a whole token in the listing title;
// - doors are priced per size: a listing's "H x W x T mm" must be one of the product's own size
//   options (or, for a door without size options, the door's own width - 1200 when the model says
//   so, else the 820 standard);
// - where several listings give different prices for the same product/size (a different glass or
//   finish), only listings naming the product's own glazing/finish are kept; if they still disagree
//   the product/size is left unpriced;
// - door furniture must also name the product's own finish; glass add-on options are never priced
//   from a whole-door listing.
//
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/match-bunnings-retail-prices.mjs [evidence.json]
import fs from "node:fs";
import path from "node:path";
import { getMasterProducts, isProductVisible } from "../lib/product-library/catalogueService.js";
import { resolveProductPrice } from "../lib/product-library/catalogueModel.js";

const EVIDENCE_DIR = "data/product-library/source-evidence/bunnings";
const OUTPUT = "data/product-library/pricing/BUNNINGS-RETAIL-PRICES.json";
const evidenceFile = process.argv[2] || path.join(EVIDENCE_DIR, fs.readdirSync(EVIDENCE_DIR).filter((file) => /^bunnings-listings-.*\.json$/.test(file)).sort().pop());
const evidence = JSON.parse(fs.readFileSync(evidenceFile, "utf8"));

const brandKey = (value) => /hume/i.test(value) ? "hume" : /corinthian/i.test(value) ? "corinthian" : /gainsborough/i.test(value) ? "gainsborough" : /lockwood/i.test(value) ? "lockwood" : "";
const tokens = (value) => ` ${String(value || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim()} `;
const DOOR_WIDTHS = "1200|1020|920|870|820|770|720|620|520";

function modelParts(model = "") {
  const match = String(model).trim().match(new RegExp(`^(.*?)[-\\s](${DOOR_WIDTHS})$`));
  return match ? { code: match[1], width: Number(match[2]) } : { code: String(model).trim(), width: null };
}

function listingSize(title = "") {
  const match = title.match(/(\d{3,4})\s*x\s*(\d{3,4})\s*x\s*(\d{2})\s*mm/i);
  if (!match) return null;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return { height: Math.max(a, b), width: Math.min(a, b), thickness: Number(match[3]), label: `${Math.max(a, b)} x ${Math.min(a, b)} x ${match[3]} mm` };
}

function agreedPrice(candidates, product) {
  if (!candidates.length) return null;
  if (new Set(candidates.map((listing) => listing.price)).size === 1) return candidates[0];
  const words = [product.finish, ...(product.attributes?.glazingOptions || [])].filter((word) => word && !/^none$/i.test(word)).map(tokens);
  const own = candidates.filter((listing) => words.some((word) => tokens(listing.title).includes(word)));
  return own.length && new Set(own.map((listing) => listing.price)).size === 1 ? own[0] : null;
}

const evidenceFor = (listing) => ({ price: listing.price, url: listing.url, title: listing.title, itemNumber: listing.itemNumber });
const products = getMasterProducts().filter(isProductVisible).filter((product) => brandKey(product.brand) && (resolveProductPrice(product).price === null || resolveProductPrice(product).source === "estimated_market_price" || /^Bunnings retail/.test(product.priceSourceNote || "")));
const matches = {};
const counts = { candidates: products.length, priced: 0, sizePriced: 0, noListing: 0, ambiguous: 0 };

for (const product of products) {
  const isGlassOption = /glass/i.test(product.familyKey || "") || (product.familyKey === "entry-doors" && product.attributes?.recordType !== "entry_door_design");
  if (isGlassOption) { counts.noListing += 1; continue; }
  const { code, width } = modelParts(product.model);
  if (code.length < 3) { counts.noListing += 1; continue; }
  // A glazed variant (Cathedral, Clear, Grey Tint...) is only priced from a listing naming that glass.
  const glazing = (product.attributes?.glazingOptions || []).filter((value) => value && !/^none$/i.test(value)).map(tokens);
  const listings = evidence.listings.filter((listing) => brandKey(listing.brand || listing.title) === brandKey(product.brand) && tokens(listing.title).includes(tokens(code)) && listing.price > 0
    && (!glazing.length || glazing.some((glass) => tokens(listing.title).includes(glass))));
  if (!listings.length) { counts.noListing += 1; continue; }
  const isDoor = /door/i.test(product.familyKey || "") && !/furniture|hardware/i.test(product.familyKey || "");
  const sizeOptions = product.attributes?.sizeOptions || [];
  if (isDoor && sizeOptions.length) {
    const sizePrices = sizeOptions.flatMap((size) => {
      const chosen = agreedPrice(listings.filter((listing) => listingSize(listing.title)?.label === size), product);
      return chosen ? [{ size, gst: "inclusive", ...evidenceFor(chosen) }] : [];
    });
    if (sizePrices.length) { matches[product.productCode] = { productName: product.productName, sizePrices }; counts.sizePriced += 1; } else counts.ambiguous += 1;
    continue;
  }
  const doorWidth = isDoor ? (width || 820) : null;
  const finish = tokens(product.finish);
  const sameFinish = (listing) => !product.finish || tokens(listing.title).includes(finish);
  const chosen = agreedPrice(isDoor ? listings.filter((listing) => (listingSize(listing.title)?.width || listing.widthMm) === doorWidth) : listings.filter(sameFinish), product);
  if (chosen) { matches[product.productCode] = { productName: product.productName, ...(doorWidth ? { size: `${doorWidth}mm door` } : {}), ...evidenceFor(chosen) }; counts.priced += 1; } else counts.ambiguous += 1;
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify({
  retailer: "Bunnings",
  retrievedAt: evidence.retrievedAt,
  gstIncluded: true,
  basis: "Public Bunnings retail shelf price, GST inclusive, matched by brand + exact model code (+ door size).",
  evidence: path.basename(evidenceFile),
  products: matches,
}, null, 2)}\n`);
console.log(counts, `-> ${OUTPUT}`);
