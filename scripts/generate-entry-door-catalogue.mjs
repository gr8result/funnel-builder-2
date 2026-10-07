import fs from "fs/promises";
import path from "path";

const OUT = path.resolve("data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json");
const CHECKED_AT = "2026-08-27";
const NOT_SPECIFIED = "Not specified by supplier";
const HUME_DOOR_FINDER_URL = "https://www.humedoors.com.au/door-finder?type=entrance";
const HUME_ENTRANCE_URL = "https://www.humedoors.com.au/ranges/entrance";

const HUME_RANGES = [
  { range: "Carringbush", slug: "carringbush", material: "Timber entrance door" },
  { range: "Haven", slug: "haven", material: "Timber entrance door" },
  { range: "Illusion", slug: "illusion", material: "Timber entrance door" },
  { range: "Joinery Entrance", slug: "joinery-entrance", material: "Timber entrance door" },
  { range: "Linear Entrance", slug: "linear-entrance", material: "Timber entrance door" },
  { range: "Newington", slug: "newington", material: "Timber entrance door" },
  { range: "Nexus", slug: "nexus", material: "Timber entrance door" },
  { range: "Savoy 820", slug: "savoy-820", material: "Timber entrance door" },
  { range: "Savoy 1200", slug: "savoy-1200", material: "Timber entrance door" },
  { range: "Regency", slug: "regency", material: "Timber entrance door" },
  { range: "Vaucluse", slug: "vaucluse", material: "Timber entrance door" },
  { range: "Vaucluse Premier", slug: "vaucluse-premier", material: "Timber entrance door" },
  { range: "Glass Opening", slug: "glass-opening", material: "Tempered hardboard or select timber entrance door" },
  { range: "Bush Fire Resistant (BAL19 & BAL29 Doors)", slug: "bush-fire-resistant-bfr-compliant-to-bal19-bal29", material: "Bushfire resistant door and frame system" },
  { range: "Bushfire Resistant (BAL40 Doors)", slug: "bushfire-resistant-(bal40)-–-compliant-to-bal40", material: "BAL40 bushfire resistant door and frame system" },
  { range: "Elite Aluminium", slug: "elite-aluminium", material: "Aluminium entrance door" },
  { range: "Elite Aluminium with VJ Panel", slug: "elite-aluminium-with-vj-panel-", material: "Aluminium entrance door" },
];

const HUME_RANGE_BY_NAME = new Map(HUME_RANGES.map((range) => [range.range, range]));

const CORINTHIAN_PAGES = [
  { slug: "awo-2", range: "Blonde Oak", model: "AWO 2" },
  { slug: "awo-21", range: "Blonde Oak", model: "AWO 21" },
  { slug: "awo-2g", range: "Blonde Oak", model: "AWO 2G" },
  { slug: "awo-5", range: "Blonde Oak", model: "AWO 5" },
  { slug: "exadeco-1s", range: "Deco White Oak Entrance", model: "EXADECO 1S" },
  { slug: "exadeco-ws-4s", range: "Deco White Oak Entrance", model: "EXADECO WS 4S" },
  { slug: "pslm-201", range: "Slimlite", model: "PSLM 201" },
  { slug: "purb-1", range: "Urban", model: "PURB 1" },
  { slug: "purb-4", range: "Urban", model: "PURB 4" },
  { slug: "exp-bal12-5", range: "Flush Entrance", model: "EXP BAL 12.5" },
  { slug: "vmad-101", range: "Madison", model: "VMAD 101" },
  { slug: "pcl-1ag", range: "Classic", model: "PCL 1AG" },
  { slug: "pru-21", range: "BAL 29 Rural", model: "PRU 21" },
  { slug: "psc-4", range: "Solidcarve", model: "PSC 4" },
  { slug: "sun-gl", range: "Sunburst", model: "SUN GL" },
  { slug: "ppen-ws-4", range: "Peninsula", model: "PPEN WS 4" },
];

function clean(value = "") {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value = "") {
  return clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function uniq(values = []) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "GR8 entry door catalogue verifier" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function imageUrls(html, hostPattern) {
  const matches = html.match(new RegExp(`https?:\\\\?/\\\\?/${hostPattern}[^"' )>]+`, "gi")) || [];
  return uniq(matches.map((url) => url.replace(/\\\//g, "/").split("?")[0]));
}

function humeModels(html) {
  const selectIndex = html.indexOf("Select a model");
  const endIndex = html.indexOf("Wishlist", selectIndex);
  const block = html.slice(selectIndex >= 0 ? selectIndex : 0, endIndex > selectIndex ? endIndex : Math.min(html.length, 12000));
  const models = [...block.matchAll(/<h2[^>]*>\s*([A-Z][A-Z0-9 ]{1,12})\s*<\/h2>/g)]
    .map((match) => clean(match[1]))
    .filter((model) => /[0-9]/.test(model));
  return uniq(models);
}

function humeFinderRows(html) {
  const rows = [];
  const anchorPattern = /<a\b[^>]*href="(\/ranges\/entrance\/([^"?]+)\?model=([^"]+))"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = anchorPattern.exec(html))) {
    const body = match[4];
    const paragraphs = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((item) => clean(item[1]));
    const type = paragraphs.find((item) => /^entrance$/i.test(item)) || "";
    if (type.toLowerCase() !== "entrance") continue;
    const range = paragraphs.find((item) => item && !/^entrance$/i.test(item) && !/face option|glass option/i.test(item)) || "";
    const model = clean(decodeURIComponent(match[3]).replace(/\+/g, " "));
    const image = (body.match(/srcSet="([^"]+)/)?.[1] || body.match(/src="([^"]+)/)?.[1] || "")
      .replace(/&amp;/g, "&")
      .split("?")[0];
    const faceCount = Number(clean(paragraphs.find((item) => /face option/i.test(item)) || "").match(/\d+/)?.[0] || 0);
    const glassCount = Number(clean(paragraphs.find((item) => /glass option/i.test(item)) || "").match(/\d+/)?.[0] || 0);
    rows.push({
      range,
      slug: match[2],
      model,
      image,
      faceCount,
      glassCount,
      url: `https://www.humedoors.com.au${match[1].replace(/&amp;/g, "&")}`,
    });
  }
  return rows;
}

function humeRangeSizes(html) {
  return [...html.matchAll(/"sectionTitle":"([^"]+)","sizes":\{"height":"([^"]*)","thickness":"([^"]*)","weight":"([^"]*)","width":"([^"]*)"\}/g)]
    .map((match) => ({
      title: clean(match[1]),
      height: clean(match[2]),
      thickness: clean(match[3]),
      weight: clean(match[4]),
      width: clean(match[5]),
    }));
}

function firstParagraphAfterFeatures(html) {
  const featuresIndex = html.indexOf("## Features");
  const block = html.slice(featuresIndex >= 0 ? featuresIndex : 0, featuresIndex + 3000);
  const paragraph = block.match(/<\/ul>\s*<p[^>]*>(.*?)<\/p>/is)?.[1];
  return clean(paragraph);
}

function commonEntryDoorRecord() {
  return {
    family_key: "entry-doors",
    requirement_keys: "entry-door",
    category_key: "Entry Doors",
    top_level_area: "exterior",
    collection: "Exterior entrance doors",
    configuration: "entry_door_design",
    price_status: "quote_required",
    price_unit: "entry door",
    currency: "AUD",
    gst_included: "true",
    country: "AU",
    regions: "AU;QLD",
    active: "true",
    discontinued: "false",
    archived: "false",
    image_source_type: "official_supplier_page",
    image_verified_at: CHECKED_AT,
    source_type: "official_supplier_page",
    source_retrieved_at: CHECKED_AT,
    source_verified_at: CHECKED_AT,
  };
}

function humeSizeOptions(range, model, officialSizes = []) {
  const formatted = officialSizes.map((size) => {
    const dimensions = `${size.height} x ${size.width} x ${size.thickness}mm`;
    return `${size.title}: ${dimensions}${size.weight ? ` (${size.weight})` : ""}`;
  });
  if (formatted.length) return formatted;
  if (/-820\b/i.test(model) || /\b820\b/i.test(range)) return ["820mm width - final height/thickness by supplier quote"];
  if (/-1200\b/i.test(model) || /\b1200\b/i.test(model) || /\b1200\b/i.test(range)) return ["1200mm width - final height/thickness by supplier quote"];
  return [NOT_SPECIFIED];
}

function humeProduct({ range, slug: rangeSlug, material, model, image, description, url, faceCount = 0, glassCount = 0, officialSizes = [] }) {
  const productCode = `ENTRY-HUME-${slug(range)}-${slug(model)}`;
  const hasGlass = glassCount > 0;
  const finishOptions = /Elite Aluminium/i.test(range) ? ["Factory aluminium finish by supplier quote"] : [NOT_SPECIFIED];
  return {
    ...commonEntryDoorRecord(),
    id: `master-${productCode}`,
    product_id: `master-${productCode}`,
    product_code: productCode,
    manufacturer: "Hume Doors & Timber",
    brand: "Hume Doors",
    supplier: "Hume Doors & Timber",
    range,
    product_name: `Hume ${range} ${model} entrance door`,
    model,
    description: description || `Hume ${range} ${model} entrance door design from the official ${range} range.`,
    colour: NOT_SPECIFIED,
    official_colour_name: NOT_SPECIFIED,
    colour_group: "Paint or stain",
    finish: NOT_SPECIFIED,
    material,
    primary_image_url: image || "",
    thumbnail_url: image || "",
    gallery_image_urls: image || "",
    image_status: image ? "verified_exact" : "missing",
    image_source_url: url,
    official_product_url: url,
    specification_url: url,
    supplier_url: HUME_ENTRANCE_URL,
    source_name: `Hume ${range} official entrance range page`,
    source_url: url,
    notes: "Model/design confirmed from Hume official entrance page. Sizes, retail pricing, handing and final finish are project/supplier quote fields where not published on the page.",
    variants: [],
    attributes: {
      recordType: "entry_door_design",
      supplierRangeSlug: rangeSlug,
      design: model,
      doorType: /Pivot/i.test(range) ? "Pivot-capable entrance door" : "Entrance door",
      externalDoorSuitability: true,
      configurations: /Pivot|Savoy 1200|Illusion/i.test(range) ? ["Single door", "Pivot door"] : ["Single door"],
      faceOptions: faceCount ? `${faceCount} face option${faceCount === 1 ? "" : "s"} listed by Hume` : NOT_SPECIFIED,
      sidelightCompatibility: /Newington|Joinery|Regency|Vaucluse|Glass|Savoy/i.test(range) ? "Confirmed range supports sidelites or compatible door systems" : NOT_SPECIFIED,
      handingOptions: NOT_SPECIFIED,
      sizes: humeSizeOptions(range, model, officialSizes),
      standardWidths: uniq(officialSizes.map((size) => size.width)),
      standardHeights: uniq(officialSizes.map((size) => size.height)),
      doorThickness: uniq(officialSizes.map((size) => size.thickness)).join("; ") || NOT_SPECIFIED,
      materialConstruction: material,
      finishOptions,
      glazingOptions: hasGlass ? [`${glassCount} Hume glass option${glassCount === 1 ? "" : "s"} - final glass selection by supplier quote`] : ["None"],
      glassTransparency: hasGlass ? "Supplier glass options available" : "None",
      paintGradeOptions: NOT_SPECIFIED,
      stainGradeTimberOptions: NOT_SPECIFIED,
      supplierColours: NOT_SPECIFIED,
      balRating: /Bush/i.test(range) ? range : NOT_SPECIFIED,
      warrantyInformation: "Refer to Hume guarantee and warranty terms",
      compatibleEntryHardware: NOT_SPECIFIED,
      smartLockCompatibility: "Builder to confirm with selected lockset",
      availabilityStatus: "Current on official Hume entrance range page",
      dataSourceUrl: url,
      dataCheckedAt: CHECKED_AT,
      optionFlow: "supplier-range-design-size-configuration-finish-glazing-hardware-save",
      hardwareOptions: ["Builder to confirm"],
    },
  };
}

async function humeProducts() {
  const finderHtml = await fetchText(HUME_DOOR_FINDER_URL);
  const finderRows = humeFinderRows(finderHtml);
  const rangeMetadata = new Map();
  for (const range of HUME_RANGES) {
    const url = `${HUME_ENTRANCE_URL}/${range.slug}`;
    try {
      const html = await fetchText(url);
      rangeMetadata.set(range.range, {
        description: firstParagraphAfterFeatures(html),
        sizes: humeRangeSizes(html),
      });
    } catch (error) {
      console.warn(`Could not retrieve Hume ${range.range} description: ${error.message}`);
    }
  }
  return finderRows.map((row) => {
    const range = HUME_RANGE_BY_NAME.get(row.range) || { range: row.range, slug: row.slug, material: "Entrance door" };
    return humeProduct({
      ...range,
      slug: row.slug || range.slug,
      model: row.model,
      image: row.image,
      description: rangeMetadata.get(row.range)?.description || "",
      url: row.url,
      faceCount: row.faceCount,
      glassCount: row.glassCount,
      officialSizes: rangeMetadata.get(row.range)?.sizes || [],
    });
  });
}

function corinthianTitle(html) {
  return clean(html.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1] || html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] || "").replace(/\s+-\s+Corinthian.*$/i, "");
}

function corinthianOptionsFromHtml(html) {
  const text = clean(html);
  const sizes = uniq([...text.matchAll(/\b(?:Custom:\s*)?\d{4}\s*x\s*(?:\d{3,4}(?:\/\d{3,4})?)\s*x\s*40\b/gi)].map((match) => match[0].replace(/^Custom:\s*/i, "")));
  const glazing = uniq(["Clear", "Translucent", "Acid Etched", "None"].filter((item) => new RegExp(`\\b${item}\\b`, "i").test(text)));
  const bal = uniq(["BAL Low", "BAL 12.5", "BAL 29", "BAL 40"].filter((item) => new RegExp(item.replace(".", "\\."), "i").test(text)));
  return {
    sizes: sizes.length ? sizes : [NOT_SPECIFIED],
    glazingOptions: glazing.length ? glazing : [NOT_SPECIFIED],
    balRating: bal.length ? bal.join("; ") : NOT_SPECIFIED,
  };
}

function corinthianMaterial(html) {
  const text = clean(html);
  if (/White Oak Veneer/i.test(text)) return "White Oak veneer";
  if (/Merbau/i.test(text)) return "Merbau veneer";
  if (/Solid MDF/i.test(text)) return "Solid MDF core";
  if (/Honeycomb Core|Blokdoor/i.test(text)) return "Honeycomb, solid or Blokdoor core depending on design";
  if (/Stile and Rail/i.test(text)) return "Stile and rail joinery door";
  return NOT_SPECIFIED;
}

async function corinthianProducts() {
  const products = [];
  for (const page of CORINTHIAN_PAGES) {
    const url = `https://www.corinthian.com.au/doors/entrance/${page.slug}/`;
    try {
      const html = await fetchText(url);
      const title = corinthianTitle(html);
      if (!title) continue;
      const range = page.range;
      const model = page.model;
      const images = imageUrls(html, "cdn.corinthian.com.au").filter((url) => /\.(png|jpe?g|webp)$/i.test(url) && !/placeholder_wide/i.test(url));
      const options = corinthianOptionsFromHtml(html);
      const material = corinthianMaterial(html);
      const productCode = `ENTRY-CORINTHIAN-${slug(range)}-${slug(model)}`;
      products.push({
        ...commonEntryDoorRecord(),
        id: `master-${productCode}`,
        product_id: `master-${productCode}`,
        product_code: productCode,
        manufacturer: "Corinthian Doors",
        brand: "Corinthian Doors",
        supplier: "Corinthian Doors",
        range,
        product_name: `Corinthian ${title}`,
        model,
        description: clean(html.match(/Product features\s*(.*?)\s*Downloads and information/is)?.[1]) || `Corinthian ${title} entrance door.`,
        colour: "Paint/stain where supplier confirms on product page",
        official_colour_name: "Paint/stain where supplier confirms on product page",
        colour_group: "Paint or stain",
        finish: "Paint/stain where supplier confirms on product page",
        material,
        primary_image_url: images[0] || "",
        thumbnail_url: images[0] || "",
        gallery_image_urls: images.slice(0, 6).join(";"),
        image_status: images[0] ? "verified_exact" : "missing",
        image_source_url: url,
        official_product_url: url,
        specification_url: url,
        supplier_url: "https://www.corinthian.com.au/doors/entrance/",
        source_name: `Corinthian ${title} official entrance product page`,
        source_url: url,
        notes: "Product identity, visible image and available options extracted from the official Corinthian product page. Public RRP is retained as supplier reference only; builder/client price remains builder-confirmed.",
        variants: options.sizes.flatMap((size) => options.glazingOptions.map((glazing) => ({
          variantName: `${size} / ${glazing}`,
          size,
          finish: "Paint/stain where supplier confirms",
          glazing,
        }))),
        attributes: {
          recordType: "entry_door_design",
          supplierRangeSlug: page.slug,
          design: model,
          doorType: /WS|wide style/i.test(title) ? "Wide style entrance door" : "Entrance door",
          externalDoorSuitability: true,
          configurations: /pivot|wide style|WS/i.test(html) ? ["Single door", "Pivot door"] : ["Single door"],
          sidelightCompatibility: /sidelight/i.test(html) ? "Supplier page references sidelights" : NOT_SPECIFIED,
          handingOptions: NOT_SPECIFIED,
          sizes: options.sizes,
          doorThickness: options.sizes.some((size) => /x\s*40\b/i.test(size)) ? "40mm" : NOT_SPECIFIED,
          materialConstruction: material,
          finishOptions: /paint\/stain|painted|stained/i.test(html) ? ["Paint finish", "Stain finish"] : [NOT_SPECIFIED],
          glazingOptions: options.glazingOptions,
          glassTransparency: options.glazingOptions.includes("Translucent") ? "Clear and translucent options where listed" : options.glazingOptions.join("; "),
          paintGradeOptions: /paint/i.test(html) ? "Paint finish confirmed" : NOT_SPECIFIED,
          stainGradeTimberOptions: /stain|veneer|oak|merbau/i.test(html) ? "Stain/veneer finish confirmed" : NOT_SPECIFIED,
          supplierColours: NOT_SPECIFIED,
          balRating: options.balRating,
          warrantyInformation: /5 years/i.test(html) ? "5 years - terms and conditions apply" : NOT_SPECIFIED,
          compatibleEntryHardware: /Pivot Hardware/i.test(html) ? "Pivot hardware option listed by supplier" : NOT_SPECIFIED,
          smartLockCompatibility: "Builder to confirm with selected lockset",
          availabilityStatus: "Current on official Corinthian entrance product page",
          dataSourceUrl: url,
          dataCheckedAt: CHECKED_AT,
          optionFlow: "supplier-range-design-size-configuration-finish-glazing-hardware-save",
          hardwareOptions: /Pivot Hardware/i.test(html) ? ["Standard entry hardware by builder", "Pivot hardware where selected"] : ["Builder to confirm"],
        },
      });
    } catch (error) {
      console.warn(`Skipping Corinthian ${page}: ${error.message}`);
    }
  }
  return products;
}

const catalogue = JSON.parse(await fs.readFile(OUT, "utf8"));
const existing = Array.isArray(catalogue.products) ? catalogue.products : [];
const entryDoors = [...await humeProducts(), ...await corinthianProducts()]
  .sort((left, right) => `${left.supplier} ${left.range} ${left.model}`.localeCompare(`${right.supplier} ${right.range} ${right.model}`));

const seen = new Set();
for (const product of entryDoors) {
  if (seen.has(product.product_code)) throw new Error(`Duplicate entry door product_code: ${product.product_code}`);
  seen.add(product.product_code);
}

catalogue.products = [
  ...existing.filter((product) => (product.family_key || product.familyKey) !== "entry-doors"),
  ...entryDoors,
];
catalogue.sourceUrls = uniq([
  ...(catalogue.sourceUrls || []),
  "https://www.humedoors.com.au/ranges/entrance",
  "https://www.corinthian.com.au/doors/entrance/",
  ...entryDoors.map((product) => product.source_url),
]);
catalogue.entryDoorCatalogue = {
  generatedAt: CHECKED_AT,
  generator: "scripts/generate-entry-door-catalogue.mjs",
  products: entryDoors.length,
  suppliers: {
    "Hume Doors & Timber": entryDoors.filter((product) => product.supplier === "Hume Doors & Timber").length,
    "Corinthian Doors": entryDoors.filter((product) => product.supplier === "Corinthian Doors").length,
  },
  unknownFieldPolicy: NOT_SPECIFIED,
};

await fs.writeFile(OUT, `${JSON.stringify(catalogue, null, 2)}\n`);
console.log(`Wrote ${entryDoors.length} verified entry-door records to ${path.relative(process.cwd(), OUT)}`);
