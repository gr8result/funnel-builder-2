export const COMMERCIAL_PRICE_PROPOSALS = Object.freeze([
  {
    id: "retail-reference:gainsborough:8951consc:2026-10-22",
    productIds: ["master-EDF-GAINSBOROUGH-8951CONSC"],
    productCodes: ["EDF-GAINSBOROUGH-8951CONSC", "8951CONSC"],
    supplier: "Bunnings Warehouse",
    productCode: "I/N 0800379; Gainsborough 8951CON",
    productName: "Gainsborough Contemporary Contour Double Cylinder Entrance Trilock",
    dimensions: "60 mm backset; suits 35-45 mm doors",
    finish: "Satin Chrome",
    price: 299.25,
    currency: "AUD",
    priceBasis: "RETAIL_REFERENCE",
    gstBasis: "UNSTATED",
    sourceUrl: "https://www.bunnings.com.au/gainsborough-satin-chrome-contemporary-contour-double-cylinder-entrance-trilock_p0800379",
    verifiedAt: "2026-10-22",
  },
  {
    id: "retail-reference:phoenix:v780-00-1:2026-10-22",
    productIds: ["master-PLB-HNC-V780-00-1"],
    productCodes: ["PLB-HNC-V780-00-1", "V780-00-1"],
    supplier: "ABK Supplies",
    productCode: "V780-00-1",
    productName: "Phoenix Vivid Shower/Wall Mixer - Lead Free",
    dimensions: "35 mm ceramic cartridge; adjustable set-out",
    finish: "Chrome",
    price: 236.91,
    currency: "AUD",
    priceBasis: "RETAIL_REFERENCE",
    gstBasis: "UNSTATED",
    sourceUrl: "https://abksupplies.com.au/product/phoenix-vivid-shower-wall-mixer-lead-free/",
    verifiedAt: "2026-10-22",
  },
  {
    id: "retail-reference:gainsborough:105baisc:2026-10-22",
    productIds: ["master-INT-GAINSBOROUGH-105BAISC"],
    productCodes: ["INT-GAINSBOROUGH-105BAISC", "105BAISC"],
    supplier: "Bunnings Warehouse",
    productCode: "I/N 4020111; Gainsborough 105BAI",
    productName: "Gainsborough Choice Bailey Passage Lever Set",
    dimensions: "63 mm rose; 60 mm backset; suits 35-45 mm doors",
    finish: "Satin Chrome",
    price: 47.04,
    currency: "AUD",
    priceBasis: "RETAIL_REFERENCE",
    gstBasis: "UNSTATED",
    sourceUrl: "https://www.bunnings.com.au/gainsborough-satin-chrome-bailey-passage-lever-set_p4020111",
    verifiedAt: "2026-10-22",
  },
  {
    id: "retail-reference:flexi-storage:0404288:2026-10-22",
    productIds: ["master-INT-SYS-FLEXI-STORAGE-WARDROBE-400MM-3-SHELF-4-DRAWER-UNIT-WHITE-MATTE"],
    productCodes: ["INT-SYS-FLEXI-STORAGE-WARDROBE-400MM-3-SHELF-4-DRAWER-UNIT-WHITE-MATTE", "0404288"],
    supplier: "Bunnings Warehouse",
    productCode: "I/N 0404288",
    productName: "Flexi Storage Wardrobe 3 Shelf and 4 Drawer Unit",
    dimensions: "506 x 1585 x 400 mm",
    finish: "White Matte",
    price: 189,
    currency: "AUD",
    priceBasis: "RETAIL_REFERENCE",
    gstBasis: "UNSTATED",
    sourceUrl: "https://www.bunnings.com.au/flexi-storage-wardrobe-506-x-1585-x-400mm-white-matte-3-shelf-and-4-drawer-unitt_p0404288",
    verifiedAt: "2026-10-22",
  },
]);

export function commercialPriceProposalById(id = "") {
  return COMMERCIAL_PRICE_PROPOSALS.find((proposal) => proposal.id === id) || null;
}

export function commercialPriceProposalFor(value = {}) {
  const productId = String(value.productId || "");
  const codes = new Set([value.productCode, value.model, value.sku].map((code) => String(code || "").trim()).filter(Boolean));
  return COMMERCIAL_PRICE_PROPOSALS.find((proposal) => proposal.productIds.includes(productId)
    || proposal.productCodes.some((code) => codes.has(code))) || null;
}

export function proposalRateExGst(proposal, gstIncluded) {
  if (!proposal || typeof gstIncluded !== "boolean") throw new Error("Confirm whether the verified retail reference includes GST before approval.");
  const price = Number(proposal.price);
  if (!(price > 0)) throw new Error("The pricing proposal has no usable price.");
  return Math.round((gstIncluded ? price / 1.1 : price) * 10000) / 10000;
}
