import fs from "node:fs/promises";
import path from "node:path";

const TODAY = "2026-08-23";
const OUT_DIR = path.resolve("data/product-library/catalogues/roofing");

const MONIER_RANGES = [
  { range: "Madison", material: "Concrete", collection: "Premium", profile: "Flat", path: "concrete/madison", qldSelectable: false },
  { range: "Cambridge", material: "Concrete", collection: "Premium", profile: "Flat", path: "concrete/cambridge", qldSelectable: true },
  { range: "Horizon", material: "Concrete", collection: "Premium", profile: "Flat", path: "concrete/horizon", qldSelectable: true },
  { range: "Atura", material: "Concrete", collection: "Classic", profile: "Semi flat", path: "concrete/atura", qldSelectable: true },
  { range: "Tudor", material: "Concrete", collection: "Classic", profile: "Raised", path: "concrete/tudor", qldSelectable: true },
  { range: "Elabana", material: "Concrete", collection: "Classic", profile: "Raised", path: "concrete/elabana", qldSelectable: true },
  { range: "Urban Shingle", material: "Terracotta", collection: "Luxe", profile: "Flat", path: "terracotta/urban-shingle", qldSelectable: false },
  { range: "Nouveau", material: "Terracotta", collection: "Luxe", profile: "Semi flat", path: "terracotta/nouveau", qldSelectable: true },
  { range: "Marseille", material: "Terracotta", collection: "Luxe", profile: "Raised", path: "terracotta/marseille", qldSelectable: true },
];

const MONIER_COLOUR_FALLBACKS = {
  Madison: ["Soho Night"],
  Cambridge: ["Soho Night"],
  Horizon: ["Sambuca", "Barramundi", "Babylon", "Aniseed", "Wild Rice", "Salt Spray", "Mist Grey", "Seashell", "Silver Perch", "Caraway", "Wollemi", "Camelot"],
  Atura: ["Sambuca", "Barramundi", "Babylon", "Aniseed", "Wild Rice", "Salt Spray", "Chilli", "Mist Grey", "Seashell", "Silver Perch", "Caraway", "Wollemi", "Camelot"],
  Tudor: ["Sambuca", "Barramundi"],
  Elabana: ["Sambuca", "Barramundi", "Babylon", "Aniseed", "Wild Rice", "Salt Spray", "Saffron", "Chilli", "Mist Grey", "Seashell"],
  "Urban Shingle": ["Titan", "Peak", "Bedrock", "Earth", "Ravine"],
  Nouveau: ["Titan", "Peak", "Comet", "Bedrock", "Riverstone", "Earth", "Mars", "Ravine"],
  Marseille: ["Titan Gloss", "Peak", "Mystic Grey", "Comet", "Pottery Brown", "Bedrock", "Riverstone", "Earth", "Mars", "Aurora", "Tanbark", "Sunset", "Cottage Red", "Florence Red"],
};

const BRISTILE_ALLOWED_RANGES = [
  "Designer", "Artisan", "Classic", "Prestige", "Eton", "Premiere",
  "Innova", "Marseille", "Curvado", "Curvado Glazed", "Alicantina", "5XL",
  "Planum", "Vienna", "Medio Curva",
];

const BRISTILE_MATERIAL = {
  Designer: "Concrete",
  Artisan: "Concrete",
  Classic: "Concrete",
  Prestige: "Concrete",
  Eton: "Concrete",
  Premiere: "Concrete",
  Innova: "Terracotta",
  Marseille: "Terracotta",
  Curvado: "Terracotta",
  "Curvado Glazed": "Terracotta",
  Alicantina: "Terracotta",
  "5XL": "Terracotta",
  Planum: "Terracotta",
  Vienna: "Terracotta",
  "Medio Curva": "Terracotta",
};

const BRISTILE_PROFILE = {
  Designer: "Low profile",
  Artisan: "Federation profile",
  Classic: "Flat profile",
  Prestige: "Flat profile",
  Eton: "Ribbed profile",
  Premiere: "Slate-look profile",
  Innova: "Flat interlocking profile",
  Marseille: "French profile",
  Curvado: "Curved interlocking profile",
  "Curvado Glazed": "Glazed curved interlocking profile",
  Alicantina: "Mediterranean profile",
  "5XL": "Large-format terracotta profile",
  Planum: "Flat terracotta profile",
  Vienna: "Flat terracotta profile",
  "Medio Curva": "Curved terracotta profile",
};

const BRISTILE_RANGE_DESCRIPTION = {
  Designer: "Sleek, minimalist and quietly undulating concrete roof tiles from Bristile Roofing.",
  Artisan: "Federation-inspired concrete roof tiles with strong, stylish lines from Bristile Roofing.",
  Classic: "Flat concrete roof tiles with a wide colour range from Bristile Roofing.",
  Prestige: "Sleek flat concrete roof tiles for contemporary residential roof designs from Bristile Roofing.",
  Eton: "Ribbed concrete roof tiles with a highly textured look from Bristile Roofing.",
  Premiere: "Smooth slate-look concrete roof tiles with rich dark tones from Bristile Roofing.",
  Innova: "Flat interlocking terracotta roof tiles from Bristile Roofing.",
  Marseille: "French-profile terracotta roof tiles from Bristile Roofing.",
  Curvado: "Curved interlocking terracotta roof tiles from Bristile Roofing.",
  "Curvado Glazed": "Glazed curved interlocking terracotta roof tiles from Bristile Roofing.",
  Alicantina: "Mediterranean terracotta roof tiles from Bristile Roofing.",
  "5XL": "Large-format terracotta roof tiles from Bristile Roofing.",
  Planum: "Flat terracotta roof tiles from Bristile Roofing.",
  Vienna: "Flat terracotta roof tiles from Bristile Roofing.",
  "Medio Curva": "Curved terracotta roof tiles from Bristile Roofing.",
};

const RANGE_VISUALS = {
  Monier: "https://www.csrassetlibrary.com/celum/20404_Desktop_Original.jpg",
  Bristile: "https://www.bristileroofing.com.au/media/catalog/category/roof-tiles.jpg",
};

const SWATCH_HEX = {
  Alabaster: "#d9d4c3",
  Aniseed: "#2e3130",
  Aspen: "#b9b3a6",
  Aurora: "#89614c",
  Babylon: "#5f554d",
  Barramundi: "#6f716e",
  Bedrock: "#666361",
  Black: "#1b1a18",
  "Black Diamond": "#181818",
  Blackstone: "#252525",
  Bronze: "#7c5a42",
  "Bronze Duo": "#7c5a42",
  "Burnt Ochre": "#8f4f2f",
  Camelot: "#6f6759",
  Caraway: "#7d7567",
  Caviar: "#2a2927",
  Chestnut: "#5d4333",
  Chilli: "#6e2e25",
  Cocoa: "#4d3328",
  "Cool Smoke": "#777a76",
  "Deep Shadow": "#333536",
  Earth: "#8f5d43",
  "Earth Red": "#86422e",
  Florence: "#8b342a",
  "Florence Red": "#8b342a",
  Granite: "#55585a",
  Grey: "#7d7f7c",
  "Grey Duo": "#6f7270",
  "Ghost White": "#ddd9cc",
  Linen: "#b9ae99",
  Mars: "#7c3f32",
  "Matte Black": "#202020",
  "Matte Grey": "#595b5b",
  "Mist Grey": "#858989",
  "Mystic Grey": "#505254",
  Peak: "#6b6d6b",
  Roja: "#9a432d",
  Salt: "#c7c0ad",
  "Salt Spray": "#c7c0ad",
  Sambuca: "#191918",
  Saffron: "#b58440",
  Seashell: "#d5d0c1",
  "Silver Gum": "#70756f",
  "Silver Perch": "#9fa29d",
  Slate: "#57595a",
  Soho: "#202124",
  "Soho Night": "#202124",
  Storm: "#4b4d4e",
  "Storm Grey": "#4b4d4e",
  Sunset: "#955436",
  "Sunset Duo": "#955436",
  Tanbark: "#6f4632",
  "Titan Gloss": "#1f2225",
  Turron: "#a58d72",
  Vanilla: "#c9bd9f",
  Wallaroo: "#6e6256",
  Wollemi: "#575f55",
  "Wild Rice": "#9f9277",
};

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\\u0020/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url, { timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, { headers: { "user-agent": "GR8 product catalogue builder" }, signal: controller.signal });
  clearTimeout(timeout);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function absoluteUrl(url, base) {
  if (!url) return "";
  try {
    return new URL(url, base).toString();
  } catch {
    return "";
  }
}

function firstMatch(text, regex) {
  return regex.exec(text)?.[1] || "";
}

function textBetween(text, start, end) {
  const s = text.indexOf(start);
  if (s < 0) return "";
  const e = text.indexOf(end, s + start.length);
  return text.slice(s + start.length, e > s ? e : undefined);
}

function colourHex(colour) {
  const direct = SWATCH_HEX[colour];
  if (direct) return direct;
  const token = String(colour).split(/\s+/).find((part) => SWATCH_HEX[part]);
  return token ? SWATCH_HEX[token] : "#8b8172";
}

function monierColoursFromHtml(html) {
  const bodyText = decodeHtml(html);
  const colourBlock = textBetween(bodyText, "## Colours", "## ");
  const parsed = colourBlock
    .split(/\s{2,}|(?<=[a-z])(?=[A-Z][a-z])/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^(Image|Reflectance|Solar|Light|Download|View|Read more)$/i.test(item));
  return parsed.filter((item) => item.split(/\s+/).length <= 3);
}

function monierImageForColour(html, colour, fallback) {
  const escaped = colour.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const altMatch = new RegExp(`<a[^>]+href="([^"]+)"[^>]*>\\s*<img[^>]+alt="${escaped}"`, "i").exec(html)
    || new RegExp(`<img[^>]+alt="${escaped}"[^>]+src="([^"]+)"`, "i").exec(html)
    || new RegExp(`<img[^>]+src="([^"]+)"[^>]+alt="${escaped}"`, "i").exec(html);
  const raw = altMatch?.[1] || "";
  return absoluteUrl(raw, "https://www.monier.com.au") || fallback;
}

function dimensionsFromMonier(text) {
  return {
    coverage: firstMatch(text, /Coverage:\s*([^#]+?)Dimension:/i),
    dimension: firstMatch(text, /Dimension:\s*([^#]+?)Weight per tile/i),
    weightPerTile: firstMatch(text, /Weight per tile\s*:\s*([^#]+?)(Weight per sqm|Head Lap|Bond Type|Roof Pitch|Product variance)/i),
    roofPitch: firstMatch(text, /Roof Pitch\s*:\s*([^#]+?)(Product variance|Download Data Sheet|Gallery)/i),
  };
}

function masterRecord({
  manufacturer,
  range,
  colour,
  material,
  collection,
  profile,
  productName,
  code,
  description,
  regions,
  primaryImageUrl,
  swatchUrl,
  productUrl,
  technicalDataUrl,
  sourceName,
  sourceUrl,
  dimensions,
  extraAttributes = {},
}) {
  return {
    family_key: "roofing",
    requirement_keys: "roofing",
    category_key: "Roofing",
    top_level_area: "exterior",
    manufacturer,
    brand: manufacturer,
    supplier: manufacturer,
    range,
    collection,
    sku: extraAttributes.sku || "",
    colour,
    official_colour_name: colour,
    colour_group: extraAttributes.colourGroup || "",
    finish: extraAttributes.finish || "Manufacturer finish",
    size: "",
    texture: "",
    configuration: "roof_tiles",
    material,
    image_source_type: "official_manufacturer_page",
    image_verified_at: TODAY,
    image_status: primaryImageUrl ? "verified_exact" : "verified_range",
    rrp: "",
    builder_cost: "",
    client_price: "",
    currency: "AUD",
    gst_included: "true",
    price_unit: "quote",
    normalized_unit_price: "",
    price_source_url: "",
    price_verified_at: "",
    price_status: "quote_required",
    country: "AU",
    regions: regions.join(";"),
    region_review_required: "false",
    active: "true",
    discontinued: "false",
    archived: "false",
    source_type: "official_manufacturer_pages",
    source_name: sourceName,
    source_retrieved_at: TODAY,
    source_verified_at: TODAY,
    product_code: code,
    product_name: productName,
    model: `${range} ${colour}`,
    description,
    dimensions: Object.values(dimensions || {}).filter(Boolean).join("; "),
    profile,
    primary_image_url: primaryImageUrl || swatchUrl || RANGE_VISUALS[manufacturer] || "",
    thumbnail_url: swatchUrl || primaryImageUrl || RANGE_VISUALS[manufacturer] || "",
    gallery_image_urls: [primaryImageUrl, swatchUrl].filter(Boolean).join(";"),
    image_source_url: sourceUrl,
    official_product_url: productUrl,
    specification_url: technicalDataUrl || productUrl,
    source_url: sourceUrl,
    notes: "Price pending / Builder price required.",
    attributes: {
      recordType: "roof_tile_variant",
      roofType: "roof_tiles",
      manufacturer,
      material,
      collection,
      range,
      profile,
      product: productName,
      variant: colour,
      colour,
      finish: extraAttributes.finish || "Manufacturer finish",
      stateAvailability: regions,
      clientSelectable: regions.includes("QLD"),
      builderEnabled: true,
      active: true,
      allowance: null,
      clientPrice: null,
      imageUrl: primaryImageUrl || swatchUrl || "",
      swatchUrl,
      productUrl,
      technicalDataUrl: technicalDataUrl || productUrl,
      supplier: manufacturer,
      priceStatus: "quote_required",
      swatchHex: colourHex(colour),
      colours: [{
        name: colour,
        officialName: colour,
        hex: colourHex(colour),
        swatchHex: colourHex(colour),
        swatchUrl,
        availableFinishes: [extraAttributes.finish || "Manufacturer finish"],
        stateAvailability: regions,
        sourceUrl,
        sourceVerifiedAt: TODAY,
      }],
      finishes: [{
        name: extraAttributes.finish || "Manufacturer finish",
        priceStatus: "quote_required",
      }],
      compatibility: {
        roofTypes: ["roof_tiles"],
        excludedRoofTypes: ["metal_roofing"],
        regions,
        pricingStates: ["quote_required", "allowance_only"],
      },
      ...extraAttributes,
    },
  };
}

async function buildMonierCatalogue() {
  const products = [];
  const sources = ["https://www.monier.com.au/roof-tiles/"];
  for (const item of MONIER_RANGES) {
    const url = `https://www.monier.com.au/roof-tiles/${item.path}/`;
    sources.push(url);
    const html = await fetchText(url);
    const text = decodeHtml(html);
    const colours = monierColoursFromHtml(html);
    const colourList = colours.length ? colours : MONIER_COLOUR_FALLBACKS[item.range] || [];
    const dataSheet = absoluteUrl(firstMatch(html, /href="([^"]+)"[^>]*>\s*Download Data Sheet/i), url);
    const galleryImage = absoluteUrl(firstMatch(html, /href="([^"]+)"[^>]*>\s*<img[^>]+alt="[^"]*roof tiles/i), url)
      || absoluteUrl(firstMatch(html, /<meta property="og:image" content="([^"]+)"/i), url)
      || RANGE_VISUALS.Monier;
    const regions = item.qldSelectable ? ["NSW", "QLD", "VIC", "TAS"] : ["NSW", "VIC", "TAS"];
    const dimensions = dimensionsFromMonier(text);
    const description = firstMatch(text, /## Overview\s*(?:Order a sample\s*)?(.+?)## Colours/i)
      || `${item.range} ${item.material.toLowerCase()} roof tile from Monier.`;
    for (const colour of colourList) {
      const image = monierImageForColour(html, colour, galleryImage);
      products.push(masterRecord({
        manufacturer: "Monier",
        range: item.range,
        colour,
        material: item.material,
        collection: item.collection,
        profile: item.profile,
        productName: `Monier ${item.range} ${colour}`,
        code: `ROOF-TILES-MONIER-${slug(item.range)}-${slug(colour)}`.toUpperCase(),
        description,
        regions,
        primaryImageUrl: image,
        swatchUrl: image,
        productUrl: url,
        technicalDataUrl: dataSheet,
        sourceName: "Monier official roof tile range pages",
        sourceUrl: url,
        dimensions,
        extraAttributes: {
          materialFamily: item.material.toLowerCase(),
          collectionTier: item.collection,
          qldClientSelectable: item.qldSelectable,
        },
      }));
    }
  }
  return {
    catalogue: "AU Monier Roof Tiles Catalogue",
    familyKey: "roofing",
    roofType: "roof_tiles",
    manufacturer: "Monier",
    officialSources: [...new Set(sources)],
    ranges: MONIER_RANGES.map(({ range, material, collection, profile, qldSelectable }) => ({ range, material, collection, profile, qldSelectable })),
    products,
  };
}

function bristileRangeForName(name) {
  const sorted = [...BRISTILE_ALLOWED_RANGES].sort((a, b) => b.length - a.length);
  return sorted.find((range) => name === range || name.startsWith(`${range} `)) || "";
}

function bristileColourForName(name, range) {
  return name === range ? "" : name.slice(range.length).trim();
}

async function buildBristileCatalogue() {
  const allProductsUrl = "https://www.bristileroofing.com.au/qld/all-products";
  const concreteUrl = "https://www.bristileroofing.com.au/qld/tiles/concrete-roof-tiles";
  const terracottaUrl = "https://www.bristileroofing.com.au/qld/tiles/terracotta-roof-tiles";
  const html = await fetchText(allProductsUrl);
  const impressions = [...html.matchAll(/"id"\s*:\s*"([^"]+)"[\s\S]{0,220}?"type"\s*:\s*"simple"[\s\S]{0,220}?"name"\s*:\s*"([^"]+)"/g)]
    .map((match) => ({ sku: decodeHtml(match[1]), name: decodeHtml(match[2]) }))
    .map((item) => ({ ...item, range: bristileRangeForName(item.name) }))
    .filter((item) => item.range);

  const products = [];
  let cursor = 0;
  async function enrich(item) {
    const colour = bristileColourForName(item.name, item.range);
    if (!colour) return null;
    const productUrl = `https://www.bristileroofing.com.au/qld/${item.sku}`;
    let detailHtml = "";
    try {
      detailHtml = await fetchText(productUrl, { timeoutMs: 8000 });
    } catch {
      detailHtml = "";
    }
    const text = decodeHtml(detailHtml);
    const swatchUrl = absoluteUrl(firstMatch(text, /Swatch\s+(https?:\/\/\S+)/i), productUrl);
    const ogImage = absoluteUrl(firstMatch(detailHtml, /<meta property="og:image" content="([^"]+)"/i), productUrl);
    const productImage = absoluteUrl(firstMatch(detailHtml, /<img[^>]+alt="main product photo"[^>]+src="([^"]+)"/i), productUrl);
    const usefulProductImage = /placeholder/i.test(ogImage) ? "" : ogImage || (/placeholder/i.test(productImage) ? "" : productImage);
    const mainImage = usefulProductImage
      || absoluteUrl(firstMatch(detailHtml, /<img[^>]+alt="main product photo"[^>]+src="([^"]+)"/i), productUrl)
      || swatchUrl
      || RANGE_VISUALS.Bristile;
    const states = firstMatch(text, /States Sold In\s+([A-Z, ]+)\s+Swatch/i)
      .split(",")
      .map((state) => state.trim())
      .filter(Boolean);
    const regions = states.length ? states : ["QLD"];
    const scrapedDescription = firstMatch(text, /Overview\s+(.+?)Key Facts/i);
    const description = scrapedDescription && !/cookie|javascript|skip to content/i.test(scrapedDescription)
      ? scrapedDescription
      : BRISTILE_RANGE_DESCRIPTION[item.range] || `${item.name} roof tile from Bristile Roofing.`;
    const dimensions = {
      length: firstMatch(text, /Length \(mm\)\s+(\d+)/i) ? `length ${firstMatch(text, /Length \(mm\)\s+(\d+)/i)}mm` : "",
      width: firstMatch(text, /Width \(mm\)\s+(\d+)/i) ? `width ${firstMatch(text, /Width \(mm\)\s+(\d+)/i)}mm` : "",
      height: firstMatch(text, /Height \(mm\)\s+(\d+)/i) ? `height ${firstMatch(text, /Height \(mm\)\s+(\d+)/i)}mm` : "",
      units: firstMatch(text, /Units per Square Metre\s+([0-9.]+)/i) ? `${firstMatch(text, /Units per Square Metre\s+([0-9.]+)/i)} units/sqm` : "",
      pitch: firstMatch(text, /Minimum Pitch With Sarking\s+([^ ]+)/i) ? `minimum pitch with sarking ${firstMatch(text, /Minimum Pitch With Sarking\s+([^ ]+)/i)}` : "",
    };
    const material = BRISTILE_MATERIAL[item.range] || "Roof tile";
    return masterRecord({
      manufacturer: "Bristile",
      range: item.range,
      colour,
      material,
      collection: material === "Concrete" ? "Concrete Roof Tiles" : "Terracotta Roof Tiles",
      profile: BRISTILE_PROFILE[item.range] || item.range,
      productName: `Bristile ${item.range} ${colour}`,
      code: `ROOF-TILES-BRISTILE-${slug(item.range)}-${slug(colour)}`.toUpperCase(),
      description,
      regions,
      primaryImageUrl: usefulProductImage || swatchUrl || mainImage,
      swatchUrl,
      productUrl,
      technicalDataUrl: productUrl,
      sourceName: "Bristile Roofing official QLD product catalogue",
      sourceUrl: productUrl,
      dimensions,
      extraAttributes: {
        sku: item.sku,
        materialFamily: material.toLowerCase(),
        stateAvailability: regions,
        bimLibraryUrl: "https://www.bristileroofing.com.au/qld/bim-library",
        technicalInformationUrl: "https://www.bristileroofing.com.au/qld/technical-information",
        classificationsUrl: "https://www.bristileroofing.com.au/qld/tile-classifications-and-ratings",
        availableBimFormats: ["JPEG", "CAD", "REVIT", "BMP"],
      },
    });
  }
  async function worker() {
    while (cursor < impressions.length) {
      const index = cursor;
      cursor += 1;
      const product = await enrich(impressions[index]);
      if (product) products.push(product);
    }
  }
  await Promise.all(Array.from({ length: 12 }, () => worker()));
  products.sort((left, right) => {
    const rangeCompare = left.range.localeCompare(right.range);
    return rangeCompare || left.colour.localeCompare(right.colour);
  });
  return {
    catalogue: "AU Bristile Roof Tiles Catalogue",
    familyKey: "roofing",
    roofType: "roof_tiles",
    manufacturer: "Bristile",
    officialSources: [allProductsUrl, concreteUrl, terracottaUrl, "https://www.bristileroofing.com.au/qld/bim-library", "https://www.bristileroofing.com.au/qld/tile-classifications-and-ratings"],
    ranges: BRISTILE_ALLOWED_RANGES.map((range) => ({
      range,
      material: BRISTILE_MATERIAL[range],
      profile: BRISTILE_PROFILE[range],
      qldSelectable: true,
    })),
    products,
  };
}

await fs.mkdir(OUT_DIR, { recursive: true });
const monier = await buildMonierCatalogue();
const bristile = await buildBristileCatalogue();
await fs.writeFile(path.join(OUT_DIR, "AU-MONIER-ROOF-TILES-CATALOGUE.json"), `${JSON.stringify(monier, null, 2)}\n`);
await fs.writeFile(path.join(OUT_DIR, "AU-BRISTILE-ROOF-TILES-CATALOGUE.json"), `${JSON.stringify(bristile, null, 2)}\n`);

console.log(`Monier products: ${monier.products.length}`);
console.log(`Bristile products: ${bristile.products.length}`);
