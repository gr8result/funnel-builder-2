// Builds data/product-library/catalogues/bathroom/AU-SHOWER-SCREENS-MIRRORS-CATALOGUE.json
//
// Canonical Product Library range for Client Selections -> Shower Screens & Mirrors:
//   shower-screen   : framed / semi-frameless / frameless screens, one record per supplier
//                     range x configuration (Regency "Aqua Series Inline - Front & Return (Gl530)")
//   mirror          : frameless, framed and shaped mirrors
//   shaving-cabinet : mirror cabinets
//
// The importer is supplier-agnostic. Each supplier is ONE definition file in
//   data/product-library/source-evidence/shower-screens-mirrors/suppliers/<supplier>.json
// describing (a) its made-to-measure ranges, transcribed from the supplier's own product pages
// (saved beside it in pages/*.txt), and (b) optionally a product feed (Shopify products.json) with
// rules mapping the supplier's categories onto our taxonomy. Adding a supplier = adding a file.
//
// Nothing is invented. Every configuration, code, option and limit in a definition file must appear
// in that range's saved evidence page or the import fails; a value a supplier does not publish
// (price, size, thickness, warranty) stays empty and the record is quote_required.
//
//   node scripts/import-shower-screens-mirrors.mjs                    build from saved evidence
//   node scripts/import-shower-screens-mirrors.mjs --download-images  also fetch supplier images
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EVIDENCE_DIR = path.join(ROOT, "data/product-library/source-evidence/shower-screens-mirrors");
const CATALOGUE_DIR = path.join(ROOT, "data/product-library/catalogues");
const OUT_FILE = path.join(CATALOGUE_DIR, "bathroom/AU-SHOWER-SCREENS-MIRRORS-CATALOGUE.json");
const REPORT_FILE = path.join(CATALOGUE_DIR, "bathroom/SHOWER-SCREENS-MIRRORS-IMPORT-REPORT.json");
const IMAGE_PUBLIC_BASE = "/images/catalogues/bathroom/shower-screens-mirrors";
const IMAGE_DIR = path.join(ROOT, "public", IMAGE_PUBLIC_BASE);
const DOWNLOAD_IMAGES = process.argv.includes("--download-images");

// Internal taxonomy. Supplier wording is always kept beside it (supplierScreenType, supplierConfiguration).
const REQUIREMENTS = {
  "shower-screen": { familyKey: "shower-screen", category: "Shower Screens", order: 1000 },
  mirror: { familyKey: "mirror", category: "Mirrors", order: 2000 },
  "shaving-cabinet": { familyKey: "shaving-cabinet", category: "Shaving Cabinets", order: 3000 },
};
const SCREEN_TYPES = ["Framed", "Semi-Frameless", "Frameless"];
const MIRROR_GROUPS = ["Frameless Mirrors", "Framed Mirrors", "Shaped Mirrors"];

const slug = (value = "") => String(value).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const code = (...parts) => parts.filter(Boolean).map((part) => slug(part).toUpperCase()).join("-");
const flat = (value = "") => String(value).toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const stripHtml = (html = "") => String(html).replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
const unique = (list = []) => Array.from(new Set(list.filter((item) => item !== "" && item != null)));
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const problems = [];
const warnings = [];

// ---------------------------------------------------------------------------------------------
// Evidence guard: a transcribed value must be present in the saved supplier page.
// ---------------------------------------------------------------------------------------------
function assertInEvidence(evidenceText, value, context) {
  if (value === "" || value == null) return;
  if (!flat(evidenceText).includes(flat(value))) problems.push(`${context}: "${value}" is not in the saved supplier evidence`);
}

function verifyRange(supplier, range, evidenceText) {
  const context = `${supplier.supplier} / ${range.name}`;
  for (const configuration of range.configurations || []) {
    assertInEvidence(evidenceText, configuration.supplierName, context);
    assertInEvidence(evidenceText, configuration.code, context);
    assertInEvidence(evidenceText, configuration.evidenceText, context);
  }
  for (const option of range.options || []) for (const value of option.values) assertInEvidence(evidenceText, value, `${context} ${option.label}`);
  for (const key of ["limitsEvidence", "sizesEvidence"]) for (const value of range[key] || []) assertInEvidence(evidenceText, value, context);
  for (const key of ["glassEvidence", "thicknessEvidence", "madeToMeasureEvidence", "warranty"]) assertInEvidence(evidenceText, range[key], context);
  // A range-wide statement (the Aqua Series pivot) may be published on a sibling page of the same supplier.
  const doorEvidence = range.doorTypeEvidenceFile ? fs.readFileSync(path.join(EVIDENCE_DIR, range.doorTypeEvidenceFile), "utf8") : evidenceText;
  assertInEvidence(doorEvidence, range.doorTypeEvidence, context);
  if (range.requirement === "shower-screen" && !SCREEN_TYPES.includes(range.screenType)) problems.push(`${context}: unknown screen type ${range.screenType}`);
  if (range.requirement === "mirror" && !MIRROR_GROUPS.includes(range.mirrorGroup)) problems.push(`${context}: unknown mirror group ${range.mirrorGroup}`);
}

// ---------------------------------------------------------------------------------------------
// Images: the supplier's own product image, stored locally (same convention as other catalogues).
// ---------------------------------------------------------------------------------------------
async function localImage(supplier, name, sourceUrl) {
  if (!sourceUrl) return "";
  const extension = (sourceUrl.split("?")[0].match(/\.(jpe?g|png|webp)$/i)?.[1] || "jpg").toLowerCase();
  const relative = `${slug(supplier.supplier)}/${slug(name)}.${extension}`;
  const file = path.join(IMAGE_DIR, relative);
  if (!fs.existsSync(file) && DOWNLOAD_IMAGES) {
    const url = /cdn\.shopify\.com/.test(sourceUrl) ? `${sourceUrl}${sourceUrl.includes("?") ? "&" : "?"}width=1000` : sourceUrl;
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (catalogue import)" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      warnings.push(`Image not downloaded for ${supplier.supplier} ${name}: ${error.message}`);
    }
  }
  return fs.existsSync(file) ? `${IMAGE_PUBLIC_BASE}/${relative}` : "";
}

// ---------------------------------------------------------------------------------------------
// Record builder shared by ranges and feed products.
// ---------------------------------------------------------------------------------------------
function record(supplier, fields) {
  const requirement = REQUIREMENTS[fields.requirement];
  const priced = typeof fields.price === "number" && fields.price > 0;
  const facets = Object.fromEntries(Object.entries(fields.facets || {}).filter(([, value]) => (Array.isArray(value) ? value.length : value)));
  return {
    product_code: fields.code,
    family_key: requirement.familyKey,
    requirement_keys: fields.requirement,
    category_key: requirement.category,
    top_level_area: "bathroom-ensuite",
    manufacturer: supplier.supplier,
    brand: supplier.supplier,
    supplier: supplier.supplier,
    range: fields.range,
    product_name: fields.name,
    model: fields.model || "",
    sku: fields.sku || "",
    description: fields.description || "",
    finish: fields.finishSummary || "",
    configuration: fields.configurationSummary || "",
    primary_image_url: fields.image || "",
    thumbnail_url: fields.image || "",
    image_source_url: fields.imageSource || "",
    image_source_type: fields.image ? "official_supplier_page" : "",
    image_status: fields.image ? (fields.imageExact ? "verified_exact" : "verified_range") : "missing",
    image_verified_at: fields.image ? supplier.capturedAt : "",
    official_product_url: fields.url,
    supplier_url: supplier.website,
    client_price: priced ? fields.price : null,
    rrp: priced ? fields.price : null,
    price_status: priced ? "current" : "quote_required",
    price_unit: "each",
    price_source_url: priced ? fields.url : "",
    price_verified_at: priced ? supplier.capturedAt : "",
    currency: "AUD",
    gst_included: true,
    country: "AU",
    regions: "AU",
    active: true,
    source_type: fields.sourceType,
    source_name: fields.sourceName,
    source_url: fields.url,
    source_retrieved_at: supplier.capturedAt,
    source_verified_at: supplier.capturedAt,
    attributes: {
      clientSelectionRequirement: fields.requirement,
      clientSelectionOrder: requirement.order + fields.order,
      keySpec: fields.keySpec,
      selectionFacets: { Supplier: supplier.supplier, ...facets },
      specifications: fields.specifications,
      // What a selection must capture, read generically by Client Selections (no supplier logic there).
      configurator: fields.configurator,
      ...(priced ? { priceBasis: fields.priceBasis, priceFrom: Boolean(fields.priceFrom) } : { priceNote: "PRICE ON APPLICATION - supplier quote required. " + (supplier.pricing?.note || "") }),
      availability: fields.availability || "",
      supplierMetadata: fields.supplierMetadata,
    },
  };
}

function limitsText(limits = {}, note = "") {
  if (note) return note;
  return [
    limits.maxHeightMm ? `max height ${limits.maxHeightMm}mm` : "",
    limits.maxWidthMm ? `max width ${limits.maxWidthMm}mm` : "",
    limits.maxDoorWidthMm ? `max door width ${limits.maxDoorWidthMm}mm` : "",
    limits.maxDepthMm ? `max depth ${limits.maxDepthMm}mm` : "",
    limits.maxAreaM2 ? `max ${limits.maxAreaM2} sqm per panel` : "",
  ].filter(Boolean).join(", ");
}

// A made-to-measure range x each configuration the supplier lists for it.
async function rangeRecords(supplier, range, feedByHandle, startOrder) {
  const evidenceText = fs.readFileSync(path.join(EVIDENCE_DIR, range.evidence), "utf8");
  verifyRange(supplier, range, evidenceText);
  const feedProduct = range.feedHandle ? feedByHandle.get(range.feedHandle) : null;
  if (range.feedHandle && !feedProduct) problems.push(`${supplier.supplier} / ${range.name}: feed product ${range.feedHandle} not found`);
  const url = range.url || `${supplier.feed.productUrlBase}${range.feedHandle}`;
  const rangeImageSource = feedProduct?.images?.[0]?.src || "";
  const records = [];
  for (const [index, configuration] of range.configurations.entries()) {
    const imageSource = configuration.image || rangeImageSource;
    const image = await localImage(supplier, configuration.image ? `${range.key}-${configuration.supplierName}` : range.key, imageSource);
    const options = [...(range.options || []), ...(configuration.extraOptions || [])];
    const optionValues = (key) => options.find((option) => option.key === key)?.values || [];
    const doorType = configuration.doorType ?? range.doorType ?? "";
    const frameStyle = configuration.frameStyle || range.frameStyle || "";
    const edgeType = configuration.edgeType || range.edgeType || "";
    const isScreen = range.requirement === "shower-screen";
    const sizes = configuration.sizes || [];
    const limits = range.limits || {};
    const name = `${range.name} - ${configuration.supplierName}${configuration.code ? ` (${configuration.code})` : ""}`;
    records.push(record(supplier, {
      requirement: range.requirement,
      order: startOrder + index,
      code: code("SSM", supplier.codePrefix, range.key, configuration.code || configuration.supplierName),
      range: range.range,
      name,
      model: configuration.code || "",
      sku: configuration.code || "",
      description: range.description,
      finishSummary: optionValues("finish").join(", "),
      configurationSummary: configuration.supplierName,
      image,
      imageSource,
      imageExact: Boolean(configuration.image),
      url,
      sourceType: "official_supplier_page",
      sourceName: `${supplier.legalName} product page (${range.evidence})`,
      availability: [supplier.availability, range.availabilityNote].filter(Boolean).join(" "),
      keySpec: [
        isScreen ? range.supplierScreenType : frameStyle || range.mirrorGroup,
        configuration.supplierName,
        range.glassThicknessMm?.length ? `${range.glassThicknessMm.join("/")}mm glass` : "",
        "Made to measure",
      ].filter(Boolean).join(" · "),
      facets: isScreen
        ? { "Screen Type": range.screenType, Configuration: configuration.internal, Door: doorType, Finish: optionValues("finish"), Glass: optionValues("glass"), Size: "Made to measure" }
        : { "Mirror Type": range.mirrorGroup, Shape: configuration.shape || "", Edge: edgeType, Finish: optionValues("finish"), Size: sizes.length ? [...sizes, "Made to measure"] : "Made to measure" },
      specifications: {
        ...(isScreen ? { screenType: range.screenType, supplierScreenType: range.supplierScreenType, configuration: configuration.internal, doorType } : { mirrorGroup: range.mirrorGroup, shape: configuration.shape || "", frameStyle, edgeType }),
        supplierConfiguration: configuration.supplierName,
        supplierConfigurationCode: configuration.code || "",
        glassOptions: optionValues("glass"),
        glassThicknessMm: range.glassThicknessMm || [],
        finishOptions: optionValues("finish"),
        fixingOptions: optionValues("fixing"),
        standardSizes: sizes,
        ...limits,
        sizeRule: limitsText(limits, range.limitsNote),
        madeToMeasure: Boolean(range.madeToMeasure),
        madeToMeasureNote: range.madeToMeasureNote || "",
        features: [...(range.features || []), ...(configuration.features || [])],
        configurationNote: range.configurationNote || "",
        optionsNote: range.optionsNote || "",
        warranty: range.warranty || "",
      },
      configurator: {
        madeToMeasure: Boolean(range.madeToMeasure),
        priceMode: "supplier-quote",
        options: [
          ...(sizes.length ? [{ key: "size", label: "Size", values: [...sizes, "Custom size"] }] : []),
          ...options.map(({ key, label, values, note }) => ({ key, label, values, ...(note ? { note } : {}) })),
        ],
        dimensions: {
          width: { maxMm: limits.maxWidthMm || null },
          height: { maxMm: limits.maxHeightMm || null },
          depth: isScreen ? { maxMm: limits.maxDepthMm || null } : null,
          rule: limitsText(limits, range.limitsNote),
        },
        variants: [],
      },
      supplierMetadata: {
        supplierCategory: range.supplierCategory,
        supplierRange: range.range,
        evidenceFile: range.evidence,
        ...(feedProduct ? { feedHandle: feedProduct.handle, feedProductId: feedProduct.id, feedTags: feedProduct.tags, feedVendor: feedProduct.vendor } : {}),
      },
    }));
  }
  return records;
}

// ---------------------------------------------------------------------------------------------
// Feed products (priced, fixed-size variants).
// ---------------------------------------------------------------------------------------------
const test = (pattern, value) => !pattern || new RegExp(pattern, "i").test(value || "");
function optionRole(name = "") {
  if (/size/i.test(name)) return "size";
  if (/glass/i.test(name)) return "glass";
  if (/fixing/i.test(name)) return "fixingSide";
  if (/colou?r|metal|finish/i.test(name)) return "finish";
  return slug(name);
}
function parseSize(value = "") {
  const read = (letter) => Number(String(value).match(new RegExp(`${letter}\\s*(\\d{3,4})`, "i"))?.[1]) || null;
  return { heightMm: read("H"), widthMm: read("W"), depthMm: read("D") };
}

async function feedRecords(supplier, feedProducts, startOrder) {
  const config = supplier.feedProducts;
  if (!config) return { records: [], skipped: [] };
  const records = [];
  const skipped = [];
  const madeToOrderHandles = new Set(supplier.ranges.map((range) => range.feedHandle).filter(Boolean));
  const excluded = new Map((supplier.notImported || []).map((item) => [item.handle, item.reason]));
  for (const product of feedProducts) {
    if (madeToOrderHandles.has(product.handle)) continue;
    if (excluded.has(product.handle)) { skipped.push({ handle: product.handle, reason: excluded.get(product.handle) }); continue; }
    const rule = config.rules.find((item) => test(item.match.productType, product.product_type) && test(item.match.title, product.title));
    if (!rule) { skipped.push({ handle: product.handle, reason: "No category mapping rule matched" }); continue; }
    const variants = product.variants.filter((variant) => Number(variant.price) > 0);
    if (!variants.length) { skipped.push({ handle: product.handle, reason: "No priced variant in the feed" }); continue; }
    const body = stripHtml(product.body_html);
    const facts = {};
    for (const fact of config.facts || []) {
      if (!test(fact.titleMatch, product.title)) continue;
      if (flat(body).includes(flat(fact.quote))) Object.assign(facts, fact.set);
    }
    const roles = product.options.map((option) => ({ ...option, role: optionRole(option.name) })).filter((option) => !(option.values.length === 1 && option.values[0] === "Default Title"));
    const variantRows = variants.map((variant) => {
      const options = Object.fromEntries(roles.map((option) => [option.role, variant[`option${option.position}`]]));
      return { sku: variant.sku || "", price: Number(variant.price), available: variant.available !== false, options, ...parseSize(options.size) };
    });
    const values = (role) => unique(variantRows.map((variant) => variant.options[role]));
    const sizes = values("size").map((size) => size.replace(/\s*\(mm\)/i, "mm").replace(/\s+X\s+/g, " x "));
    const prices = variantRows.map((variant) => variant.price);
    const shape = (config.shapes || []).find((item) => test(item.title, product.title))?.shape || "";
    const frameFinish = (config.frameFinishes || []).find((item) => test(item.title, product.title))?.finish || "";
    const finishes = values("finish").length ? values("finish") : (frameFinish ? [frameFinish] : []);
    const isScreen = rule.requirement === "shower-screen";
    const isCabinet = rule.requirement === "shaving-cabinet";
    const url = `${supplier.feed.productUrlBase}${product.handle}`;
    const imageSource = product.images?.[0]?.src || "";
    const image = await localImage(supplier, product.handle, imageSource);
    // The supplier's own product title, unchanged.
    const name = product.title;
    records.push(record(supplier, {
      requirement: rule.requirement,
      order: startOrder + records.length,
      code: code("SSM", supplier.codePrefix, "ONLINE", product.handle),
      range: rule.range,
      name,
      model: variantRows.length === 1 ? variantRows[0].sku : "",
      sku: variantRows.length === 1 ? variantRows[0].sku : "",
      description: body.split("\n").filter(Boolean).slice(0, 2).join(" "),
      finishSummary: finishes.join(", "),
      configurationSummary: rule.supplierConfiguration || shape,
      image,
      imageSource,
      imageExact: true,
      url,
      sourceType: "official_supplier_feed",
      sourceName: `${supplier.legalName} online store product feed (${supplier.feed.file})`,
      price: Math.min(...prices),
      priceFrom: new Set(prices).size > 1,
      priceBasis: supplier.pricing.feedPriceBasis,
      keySpec: [
        isScreen ? rule.supplierScreenType : isCabinet ? "Mirror cabinet" : rule.frameStyle,
        isScreen ? rule.supplierConfiguration : shape,
        sizes.length === 1 ? sizes[0] : `${sizes.length} sizes`,
        `${variantRows.length} SKU${variantRows.length === 1 ? "" : "s"}`,
      ].filter(Boolean).join(" · "),
      facets: isScreen
        ? { "Screen Type": rule.screenType, Configuration: rule.configuration, Door: rule.doorType, Finish: finishes, Glass: values("glass"), Size: sizes }
        : isCabinet
          ? { Shape: shape, Finish: finishes, Mounting: facts.mounting || "", Size: sizes }
          : { "Mirror Type": rule.mirrorGroup, Shape: shape, Edge: facts.edgeType || "", Finish: finishes, Size: sizes },
      specifications: {
        ...(isScreen
          ? { screenType: rule.screenType, supplierScreenType: rule.supplierScreenType, configuration: rule.configuration, supplierConfiguration: rule.supplierConfiguration, doorType: rule.doorType }
          : { mirrorGroup: rule.mirrorGroup || "", shape, frameStyle: rule.frameStyle || "", frameFinish, mirroredDoor: isCabinet }),
        glassOptions: values("glass"),
        finishOptions: finishes,
        standardSizes: sizes,
        madeToMeasure: false,
        ...facts,
      },
      configurator: {
        madeToMeasure: false,
        priceMode: "variant",
        options: roles.map((option) => ({ key: option.role, label: option.role === "size" ? "Size" : option.role === "glass" ? "Glass" : option.role === "finish" ? "Finish" : option.name, values: option.values })),
        dimensions: null,
        variants: variantRows,
      },
      supplierMetadata: { supplierCategory: product.product_type, feedHandle: product.handle, feedProductId: product.id, feedTags: product.tags, feedVendor: product.vendor, feedUpdatedAt: product.updated_at },
    }));
  }
  return { records, skipped };
}

// ---------------------------------------------------------------------------------------------
// Existing Product Library data: no duplicates, no second spelling of a supplier.
// ---------------------------------------------------------------------------------------------
function existingCatalogueProducts() {
  const rows = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(file);
    if (!entry.name.endsWith(".json") || file === OUT_FILE || file === REPORT_FILE || /SAFETY|REPORT|AUDIT/i.test(entry.name)) return;
    try {
      const products = readJson(file).products;
      if (Array.isArray(products)) products.forEach((product) => rows.push({ file: path.relative(ROOT, file), product }));
    } catch { /* not a product catalogue */ }
  });
  walk(CATALOGUE_DIR);
  return rows;
}

function duplicateAudit(suppliers, records) {
  const names = new Map(suppliers.flatMap((supplier) => [supplier.supplier, ...(supplier.aliases || [])].map((name) => [slug(name), supplier.supplier])));
  const codes = new Set(records.map((item) => item.product_code));
  const existing = existingCatalogueProducts();
  const sameSupplier = existing.filter(({ product }) => [product.supplier, product.brand, product.manufacturer].some((value) => names.has(slug(value))));
  const sameCode = existing.filter(({ product }) => codes.has(product.product_code || product.productCode));
  const sameFamily = existing.filter(({ product }) => ["shower-screen", "mirror", "shaving-cabinet"].includes(product.family_key || product.familyKey));
  if (sameCode.length) problems.push(`Product codes already exist in another catalogue: ${sameCode.map((item) => item.product.product_code || item.product.productCode).join(", ")}`);
  const seen = new Set();
  for (const item of records) {
    if (seen.has(item.product_code)) problems.push(`Duplicate product code generated: ${item.product_code}`);
    seen.add(item.product_code);
  }
  return {
    existingProductsScanned: existing.length,
    existingProductsFromTheseSuppliers: sameSupplier.map(({ file, product }) => ({ file, productCode: product.product_code || product.productCode, supplier: product.supplier })),
    existingShowerScreenMirrorFamilyProducts: sameFamily.map(({ file, product }) => ({ file, productCode: product.product_code || product.productCode })),
    supplierNameNormalisation: Object.fromEntries(suppliers.map((supplier) => [supplier.supplier, supplier.aliases || []])),
  };
}

// ---------------------------------------------------------------------------------------------
async function main() {
  const supplierDir = path.join(EVIDENCE_DIR, "suppliers");
  const suppliers = fs.readdirSync(supplierDir).filter((name) => name.endsWith(".json")).sort().map((name) => readJson(path.join(supplierDir, name)));
  const products = [];
  const report = { suppliers: {} };
  for (const supplier of suppliers) {
    const feed = supplier.feed ? readJson(path.join(EVIDENCE_DIR, supplier.feed.file)) : null;
    const feedProducts = feed?.products || [];
    const feedByHandle = new Map(feedProducts.map((product) => [product.handle, product]));
    const supplierRecords = [];
    for (const range of supplier.ranges) supplierRecords.push(...await rangeRecords(supplier, range, feedByHandle, supplierRecords.length));
    const fromFeed = await feedRecords(supplier, feedProducts, supplierRecords.length);
    supplierRecords.push(...fromFeed.records);
    products.push(...supplierRecords);
    const by = (requirement) => supplierRecords.filter((item) => item.requirement_keys === requirement);
    report.suppliers[supplier.supplier] = {
      total: supplierRecords.length,
      showerScreens: by("shower-screen").length,
      mirrors: by("mirror").length,
      shavingCabinets: by("shaving-cabinet").length,
      screenTypes: unique(by("shower-screen").map((item) => item.attributes.specifications.screenType)),
      supplierScreenTerms: unique(by("shower-screen").map((item) => item.attributes.specifications.supplierScreenType)),
      screenConfigurations: unique(by("shower-screen").map((item) => item.attributes.specifications.configuration)),
      mirrorRanges: unique(by("mirror").map((item) => item.range)),
      mirrorGroups: unique(by("mirror").map((item) => item.attributes.specifications.mirrorGroup)),
      pricedProducts: supplierRecords.filter((item) => item.price_status === "current").length,
      quoteRequiredProducts: supplierRecords.filter((item) => item.price_status === "quote_required").length,
      skuVariants: supplierRecords.reduce((total, item) => total + item.attributes.configurator.variants.length, 0),
      withImage: supplierRecords.filter((item) => item.primary_image_url).length,
      withoutImage: supplierRecords.filter((item) => !item.primary_image_url).map((item) => item.product_code),
      feedProductsNotImported: fromFeed.skipped,
      notImported: supplier.notImported || [],
      pricingNote: supplier.pricing?.note || "",
      availability: supplier.availability || "",
    };
  }
  const audit = duplicateAudit(suppliers, products);
  if (problems.length) {
    console.error(`Import failed - ${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  const generatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify({
    catalogue: "AU-SHOWER-SCREENS-MIRRORS-CATALOGUE",
    generatedAt,
    note: "Canonical Product Library range for Client Selections > Shower Screens & Mirrors. Built by scripts/import-shower-screens-mirrors.mjs from the supplier definitions and saved supplier pages / feeds in data/product-library/source-evidence/shower-screens-mirrors. Made-to-measure ranges are quote_required (PRICE ON APPLICATION); only a supplier's published online price is stored as a price.",
    taxonomy: { screenTypes: SCREEN_TYPES, mirrorGroups: MIRROR_GROUPS, requirements: Object.keys(REQUIREMENTS) },
    officialSources: unique(products.map((item) => item.source_url)),
    products,
  }, null, 2)}\n`);
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify({ generatedAt, totalProducts: products.length, ...report, dataQuality: audit, warnings }, null, 2)}\n`);
  console.log(`Wrote ${products.length} products to ${path.relative(ROOT, OUT_FILE)}`);
  for (const [name, summary] of Object.entries(report.suppliers)) console.log(`  ${name}: ${summary.total} (screens ${summary.showerScreens}, mirrors ${summary.mirrors}, cabinets ${summary.shavingCabinets}; priced ${summary.pricedProducts}, quote ${summary.quoteRequiredProducts}; images ${summary.withImage})`);
  if (warnings.length) console.log(`Warnings:\n- ${warnings.join("\n- ")}`);
}

main();
