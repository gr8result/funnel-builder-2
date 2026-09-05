import fs from "node:fs/promises";

const CATALOGUE_PATH = "data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json";
const AUDIT_PATH = "test-results/beacon-outdoor-catalogue/beacon-outdoor-products.audit.json";
const VERIFIED_AT = "2026-08-27";
const NOT_PUBLISHED = "Not published by supplier";

const CATEGORY_RULES = [
  ["Security & Sensor", /sensor|security|motion|guard/i],
  ["Floodlights", /flood/i],
  ["Solar", /solar/i],
  ["Low Voltage", /\b12v\b|12\/24v|24v|low voltage|spike|garden/i],
  ["Garden & Landscape", /garden|spike|path|pathway|landscape/i],
  ["Step & Deck", /step|deck/i],
  ["Bollards & Posts", /bollard|post|pedestal/i],
  ["Ceiling & Pendant", /pendant|ceiling/i],
  ["Wall Lights", /wall|bracket|sconce|up down|up\/down|lantern|spot/i],
];

function slug(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function moneyValue(value = "") {
  const match = String(value).replace(/,/g, "").match(/\$?(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : null;
}

function skuFromProduct(product) {
  const imageMatch = String(product.image || "").match(/\/(\d{6,8})(?:[_\.])/);
  if (imageMatch) return imageMatch[1];
  if (/^\d{6,8}$/.test(product.sku || "")) return product.sku;
  const urlMatch = String(product.url || "").match(/(?:^|-)(\d{6,8})(?:-|$)/);
  return urlMatch?.[1] || "";
}

function rangeFromName(name = "") {
  return name
    .replace(/^Made By Mayfair\s+/i, "Made by Mayfair ")
    .split(/\s+(?:\d+\s+Light|LED|Exterior|Outdoor|Wall|Flood|Pendant|Solar|12V|240V|Spike|Bollard|Post|Step|Deck)/i)[0]
    .replace(/\s+In$/i, "")
    .trim() || "Beacon Outdoor";
}

function categoryFor(product) {
  const haystack = `${product.category} ${product.name} ${product.url}`;
  const found = CATEGORY_RULES.find(([, pattern]) => pattern.test(haystack));
  return found?.[0] || "Wall Lights";
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
  if (category === "Floodlights" || category === "Security & Sensor") return [...base, "Driveway", "Side access", "External walls"];
  if (category === "Garden & Landscape" || category === "Low Voltage" || category === "Solar") return ["Pathway", "Garden", "Driveway", "Side access"];
  if (category === "Bollards & Posts") return ["Pathway", "Garden", "Driveway"];
  if (category === "Step & Deck") return ["Step", "Deck", "Pathway"];
  if (type === "Plug-in fitting") return ["Alfresco", "Patio", "Covered outdoor locations"];
  return base;
}

function buildRecord(product, index) {
  const name = product.name;
  const category = categoryFor(product);
  const subtype = product.category;
  const type = constructionType(name);
  const sku = skuFromProduct(product);
  const price = moneyValue(product.price);
  const { integratedLed, globeType, globeIncluded } = lightSource(name);
  const sensor = sensorType(name);
  const productCode = `BEACON-EXT-${sku || slug(name).toUpperCase().slice(0, 56) || index}`;
  return {
    product_code: productCode,
    stable_product_id: `beacon-exterior-${sku || slug(name)}`,
    family_key: "external-lighting",
    requirement_keys: "external-lighting",
    category_key: "External Lighting",
    top_level_area: "exterior",
    manufacturer: "Beacon Lighting",
    brand: name.startsWith("Made By Mayfair") ? "Made by Mayfair" : "Beacon Lighting",
    supplier: "Beacon Lighting",
    range: rangeFromName(name),
    product_name: name,
    model: name,
    description: `Beacon Lighting exterior product from ${product.category}. ${NOT_PUBLISHED} for unpublished specifications.`,
    colour: finishFromName(name),
    finish: finishFromName(name),
    configuration: slug(category),
    material: NOT_PUBLISHED,
    primary_image_url: product.image,
    thumbnail_url: product.image,
    gallery_image_urls: product.image,
    image_source_url: product.url,
    image_source_type: "official_supplier_page",
    image_verified_at: VERIFIED_AT,
    image_status: product.image ? "verified_official_category_card" : "missing",
    official_product_url: product.url,
    specification_url: product.url,
    supplier_url: product.sourceUrl,
    current_listed_price: price,
    selected_cost: price,
    client_price: price,
    price_status: price == null ? "quote_required" : "current",
    price_unit: "each",
    price_verified_at: VERIFIED_AT,
    sale_clearance_status: /^Special Price/i.test(product.rawText || "") || /OFF/.test(product.rawText || "") ? "sale_or_promo_price_shown" : "standard_or_not_published",
    currency: "AUD",
    gst_included: "true",
    country: "AU",
    regions: "AU;QLD",
    active: "true",
    discontinued: "false",
    archived: "false",
    source_type: "official_beacon_category_page",
    source_name: product.category,
    source_url: product.sourceUrl,
    source_retrieved_at: VERIFIED_AT,
    source_verified_at: VERIFIED_AT,
    attributes: {
      recordType: "beacon_exterior_light",
      beaconSku: sku || NOT_PUBLISHED,
      exteriorCategory: category,
      productSubtype: subtype,
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
    },
  };
}

async function main() {
  const catalogue = JSON.parse(await fs.readFile(CATALOGUE_PATH, "utf8"));
  const audit = JSON.parse(await fs.readFile(AUDIT_PATH, "utf8"));
  const products = audit
    .filter((product) => /^https:\/\/www\.beaconlighting\.com\.au\/media\/catalog\/product\//i.test(product.image || ""))
    .filter((product) => product.url && product.name)
    .filter((product) => !/table lamp|floor lamp|lamp base|lamp shade/i.test(product.name));
  const seen = new Set();
  const beaconRecords = products
    .filter((product) => {
      const key = product.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(buildRecord);
  catalogue.products = catalogue.products.filter((product) => product.family_key !== "external-lighting");
  catalogue.products.push(...beaconRecords);
  const sourceSet = new Set([...(catalogue.officialSources || []), ...(catalogue.sourceUrls || [])]);
  for (const product of beaconRecords) {
    sourceSet.add(product.official_product_url);
    sourceSet.add(product.supplier_url);
  }
  catalogue.officialSources = Array.from(sourceSet).filter(Boolean).sort();
  catalogue.sourceUrls = Array.from(sourceSet).filter(Boolean).sort();
  catalogue.beaconExteriorLightingCatalogue = {
    source: AUDIT_PATH,
    rebuiltAt: VERIFIED_AT,
    activeExteriorProductCount: beaconRecords.length,
    categories: Object.fromEntries(Object.entries(Object.groupBy(beaconRecords, (product) => product.attributes.exteriorCategory)).map(([key, value]) => [key, value.length])),
    removedMisclassifiedProducts: [
      {
        product_code: "LIGHT-BRILLIANT-DORMON-ENTASIS-CHARCOAL",
        reason: "Non-Beacon legacy external-lighting record removed from Beacon-specific External Lighting catalogue.",
      },
      {
        product_code: "LIGHT-BRILLIANT-EAVE-LANTERN-CHARCOAL",
        reason: "Non-Beacon legacy external-lighting record removed from Beacon-specific External Lighting catalogue.",
      },
      {
        product_code: "LIGHT-BUILDER-BOLLARD-EXTERIOR",
        reason: "Builder configurable placeholder removed so External Lighting uses official Beacon product records only.",
      },
    ],
  };
  await fs.writeFile(CATALOGUE_PATH, `${JSON.stringify(catalogue, null, 2)}\n`);
  await fs.writeFile("test-results/beacon-outdoor-catalogue/beacon-catalogue-reconciliation.json", `${JSON.stringify(catalogue.beaconExteriorLightingCatalogue, null, 2)}\n`);
  console.log(`Imported ${beaconRecords.length} Beacon exterior lighting products.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
