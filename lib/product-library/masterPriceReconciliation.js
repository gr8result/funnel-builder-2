// Reconciles price sources that already exist elsewhere in the repository onto the canonical
// Product Library product, by stable product identity (brand + range + model), so the price lives
// on the ONE master record that Client Selections and the Quotation Builder both read.
//
// Rules: a product that already has its own positive price is never touched; nothing is invented;
// every reconciled price records where it came from (priceSource + priceSourceNote) and carries no
// fabricated update date. Products with no matching source stay PRICE REQUIRED.
import { HUME_ENTRY_DOOR_OPTIONS } from "../construction-estimation/humeEntryDoorPricing.js";
import { PRODUCT_PRICE_SOURCES } from "./catalogueModel.js";
import bunningsRetailPrices from "../../data/product-library/pricing/BUNNINGS-RETAIL-PRICES.json";

// Product Library range name -> Estimate Builder Hume entry door range label, where they differ.
const HUME_RANGE_ALIASES = { "Linear Entrance": "Linear", "Joinery Entrance": "Joinery" };

function money(value) {
  const amount = Number(String(value || "").replace(/[$,\s]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function hasOwnPrice(product) {
  return [product.builderPrice, product.clientPrice, product.rrp, product.normalizedUnitPrice].some((value) => money(value) !== null);
}

// Hume entry door designs: the Estimate Builder's Hume entry door schedule rate for the same range
// and door width (lib/construction-estimation/humeEntryDoorPricing.js). A 1200mm model (named in the
// model, e.g. "XS28-1200", "XLR500 1200") takes the 1200 rate; every other design is priced at the
// 820mm standard door width. Ex GST, as the Estimate Builder adds GST to its base rates.
function humeEntryDoorPrice(product) {
  if (product.familyKey !== "entry-doors" || product.attributes?.recordType !== "entry_door_design") return null;
  if (!/hume/i.test(product.brand || product.manufacturer || "")) return null;
  const rangeLabel = HUME_RANGE_ALIASES[product.range] || product.range;
  const option = HUME_ENTRY_DOOR_OPTIONS.find((item) => item.label === rangeLabel);
  if (!option) return null;
  const width = /\b1200\b|-1200\b/.test(`${product.model} ${product.productName}`) || !money(option.rate820) ? "1200" : "820";
  const price = money(width === "1200" ? option.rate1200 : option.rate820);
  if (price === null) return null;
  return {
    price,
    note: `Estimate Builder Hume entry door schedule rate: ${option.label} ${width}mm door, ex GST (humeEntryDoorPricing.js). Estimated price, not a supplier quote.`,
  };
}

// Public retail shelf price (GST inclusive) matched to this exact product by
// scripts/match-bunnings-retail-prices.mjs, with the listing URL and retrieval date as evidence.
// Door prices are per size (sizePrices); other products carry the retail price as their RRP.
function retailPrice(product) {
  const match = bunningsRetailPrices.products?.[product.productCode];
  if (!match) return null;
  const retrievedOn = String(bunningsRetailPrices.retrievedAt || "").slice(0, 10);
  const common = {
    priceStatus: "current",
    priceSource: PRODUCT_PRICE_SOURCES.catalogueRrp,
    priceSourceNote: `${bunningsRetailPrices.retailer} retail price, GST inclusive, retrieved ${retrievedOn}.`,
    priceVerifiedAt: retrievedOn,
    gstIncluded: true,
    priceReviewRequired: false,
  };
  if (match.sizePrices?.length) {
    if (product.attributes?.sizePrices?.length) return null;
    return {
      ...product,
      ...common,
      priceSourceUrl: match.sizePrices[0].url,
      attributes: { ...product.attributes, sizePrices: match.sizePrices.map(({ size, price, url }) => ({ size, price, gst: "inclusive", url, retailer: bunningsRetailPrices.retailer })) },
    };
  }
  return { ...product, ...common, rrp: match.price, priceSourceUrl: match.url };
}

export function reconcileMasterProductPrice(product) {
  if (!product || hasOwnPrice(product) || product.attributes?.sizePrices?.length) return product;
  const retail = retailPrice(product);
  if (retail) return retail;
  const match = humeEntryDoorPrice(product);
  if (!match) return product;
  return {
    ...product,
    clientPrice: match.price,
    priceStatus: "current",
    priceSource: PRODUCT_PRICE_SOURCES.estimated,
    priceSourceNote: match.note,
    gstIncluded: false,
    priceReviewRequired: true,
  };
}
