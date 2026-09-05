import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data/product-library/catalogues/benchtops");
const JSON_PATH = path.join(DATA_DIR, "AU-STONE-BENCHTOP-CATALOGUE.json");
const MODULE_PATH = path.join(DATA_DIR, "AU-STONE-BENCHTOP-CATALOGUE.js");
const REPORT_PATH = path.join(DATA_DIR, "AU-STONE-BENCHTOP-CATALOGUE.report.json");
const IMAGE_ROOT = path.join(ROOT, "public/images/catalogues/benchtops");
const VERIFIED_AT = "2026-09-01";

const SUPPLIERS = {
  neolith: { name: "Neolith", url: "https://www.neolith.com/en/all-colours/" },
  smartstone: { name: "Smartstone", url: "https://www.smartstone.com.au/stone-benchtops" },
  caesarstone: { name: "Caesarstone", url: "https://www.caesarstone.com.au/colours/" },
  "stone-ambassador": { name: "Stone Ambassador", url: "https://stoneambassador.com.au/catalogue/" },
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("--validate") || args.includes("--validation");
const supplierArg = args.find((arg) => arg.startsWith("--supplier="))?.split("=")[1];
const selectedSupplierKeys = supplierArg ? [supplierArg] : Object.keys(SUPPLIERS);
const SOURCE_NOTE = "Official supplier catalogue page; fields not exposed in the listing are marked for supplier confirmation.";

const CAESARSTONE_FIXTURE = [
  ["8251", "Taj Whisper", "ICON", "Mineral Surface", "M1", "Polished Finish", ["20mm"], "Grande = 327 cm +/-1.5% (L) x 164 cm +/-1.5% (W)", "https://www.caesarstone.com.au/colours/8251-taj-whisper/"],
  ["8252", "Sedara", "ICON", "Mineral Surface", "M1", "Polished Finish", ["20mm"], "Grande = 327 cm +/-1.5% (L) x 164 cm +/-1.5% (W)", "https://www.caesarstone.com.au/colours/8252-sedara/"],
  ["6011", "Intense White", "ICON", "Mineral Surface", "M1", "Polished Finish", ["20mm"], "Grande = 327 cm +/-1.5% (L) x 164 cm +/-1.5% (W)", "https://www.caesarstone.com.au/colours/6011-intense-white/", "https://www.caesarstone.com.au/wp-content/uploads/2020/12/6011_Intense-White_6011_CU_50x70cm_1920x890px-1.jpg"],
  ["1141", "Pure White", "ICON", "Mineral Surface", "M1", "Polished Finish", ["20mm"], "Grande = 327 cm +/-1.5% (L) x 164 cm +/-1.5% (W)", "https://www.caesarstone.com.au/colours/1141-pure-white/"],
  ["4011", "Cloudburst Concrete", "ICON", "Mineral Surface", "M3", "Natural Finish", ["20mm"], "Grande = 327 cm +/-1.5% (L) x 164 cm +/-1.5% (W)", "https://www.caesarstone.com.au/colours/4011-cloudburst-concrete/"],
  ["5102", "Laceline", "ICON", "Mineral Surface", "M1", "Polished Finish", ["20mm"], "Grande = 327 cm +/-1.5% (L) x 164 cm +/-1.5% (W)", "https://www.caesarstone.com.au/colours/5102-laceline/"],
  ["5103", "Lightcrest", "ICON", "Mineral Surface", "M1", "Polished Finish", ["20mm"], "Grande = 327 cm +/-1.5% (L) x 164 cm +/-1.5% (W)", "https://www.caesarstone.com.au/colours/5103-lightcrest/"],
  ["506", "Mirabel", "Porcelain", "Porcelain Surface", "Porcelain", "Silk Finish", ["12 mm", "20mm"], "Grande = 1600 mm x 3200 mm", "https://www.caesarstone.com.au/colours/506-mirabel/"],
  ["502", "Sleet", "Porcelain", "Porcelain Surface", "Porcelain", "Silk Finish", ["12 mm", "20mm"], "Grande = 1600 mm x 3200 mm", "https://www.caesarstone.com.au/colours/502-sleet/"],
  ["580", "Fume", "Porcelain", "Porcelain Surface", "Porcelain", "Honed Finish", ["12 mm"], "Grande = 1600 mm x 3200 mm", "https://www.caesarstone.com.au/colours/580-fume/"],
  ["410", "Aluminous", "Porcelain", "Porcelain Surface", "Porcelain", "Ultra Rough Finish", ["12 mm"], "Grande = 1600 mm x 3200 mm", "https://www.caesarstone.com.au/colours/410-aluminous/"],
  ["584", "Opal Taj", "Porcelain", "Porcelain Surface", "Porcelain", "Honed Finish, Luster Effect", ["12 mm", "20mm"], "Grande = 1600 mm x 3200 mm", "https://www.caesarstone.com.au/colours/584-opal-taj/"],
];

const NEOLITH_FIXTURE = [
  ["Calacatta Roma", "The New Classtone", "Sintered stone", ["Ultrasoft"], ["6 mm", "12 mm", "20 mm"], "https://www.neolith.com/en/collections/classtone/calacatta-roma", "https://a.storyblok.com/f/150360/2000x3945/3ed0cbb471/calacatta-roma_2000x3945px.jpg"],
  ["Calacatta Gold", "The New Classtone", "Sintered stone", ["Polished", "Silk"], ["6 mm", "12 mm", "20 mm"], "https://www.neolith.com/en/collections/classtone/calacatta-gold"],
  ["Nero Marquina", "The New Classtone", "Sintered stone", ["Polished", "Silk"], ["6 mm", "12 mm", "20 mm"], "https://www.neolith.com/en/collections/classtone/nero-marquina"],
  ["Abu Dhabi White", "The New Classtone", "Sintered stone", ["Silk"], ["6 mm", "12 mm", "20 mm"], "https://www.neolith.com/en/collections/classtone/abu-dhabi-white"],
  ["Mont Blanc", "The New Classtone", "Sintered stone", ["Silk"], ["6 mm", "12 mm", "20 mm"], "https://www.neolith.com/en/collections/classtone/mont-blanc"],
  ["Estatuario", "The New Classtone", "Sintered stone", ["Silk", "Polished"], ["6 mm", "12 mm", "20 mm"], "https://www.neolith.com/en/collections/classtone/estatuario"],
  ["Pietra di Luna", "Fusion", "Sintered stone", ["Silk"], ["6 mm", "12 mm", "20 mm"], "https://www.neolith.com/en/collections/fusion/pietra-di-luna"],
  ["Iron Frost", "Fusion", "Sintered stone", ["Silk"], ["6 mm", "12 mm", "20 mm"], "https://www.neolith.com/en/collections/fusion/iron-frost"],
  ["Beton", "Fusion", "Sintered stone", ["Silk"], ["6 mm", "12 mm", "20 mm"], "https://www.neolith.com/en/collections/fusion/beton"],
  ["Strata Argentum", "Fusion", "Sintered stone", ["Riverwashed"], ["6 mm", "12 mm", "20 mm"], "https://www.neolith.com/en/collections/fusion/strata-argentum"],
  ["Basalt Black", "Fusion", "Sintered stone", ["Satin"], ["6 mm", "12 mm", "20 mm"], "https://www.neolith.com/en/collections/fusion/basalt-black"],
  ["Arctic White", "Colorfeel", "Sintered stone", ["Silk"], ["6 mm", "12 mm", "20 mm"], "https://www.neolith.com/en/collections/colorfeel/arctic-white"],
];

const SMARTSTONE_FIXTURE = [
  ["Arabescato Chiaro", "Classic", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/arabescato-chiaro", "https://a.storyblok.com/f/245774/1080x1080/28cd33d7f3/kitchen-benchtop_arabescato-chiaro_1x1.webp"],
  ["Bellini Bianco", "Classic", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/bellini-bianco", "https://a.storyblok.com/f/245774/1080x810/4598291469/kitchen-benchtop_bellini-bianco_3x4_3.webp"],
  ["Bianco Angelico", "Classic", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/bianco-angelico", "https://a.storyblok.com/f/245774/1080x1080/c957d6215b/kitchen-benchtop_bianco-angelico_1x1_.webp"],
  ["Bianco Puro", "Pure", "Whites/Creams", "No veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/bianco-puro", "https://a.storyblok.com/f/245774/1080x1080/ef5af1c3b2/bianco-puro_slab_1x1.webp"],
  ["Calacatta Bianco", "Classic", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/calacatta-bianco", "https://a.storyblok.com/f/245774/1080x1080/2e984fec89/calacatta-bianco_slab_1x1.webp"],
  ["Calacatta Borghini", "Deluxe", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/calacatta-borghini", "https://a.storyblok.com/f/245774/1080x1080/9271af3eb1/kitchen-benchtop_calacatta-borghini_1x1_2.webp"],
  ["Calacatta Lusso", "Deluxe", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/calacatta-lusso", "https://a.storyblok.com/f/245774/1080x1080/4df310e9cf/kitchen-benchtop_calacatta-lusso_1x1_.webp"],
  ["Calacatta Oro", "Deluxe", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/calacatta-oro", "https://a.storyblok.com/f/245774/1080x1080/bb4bb8e6f6/calacatta-oro_slab_1x1.webp"],
  ["Calacatta Verde", "Deluxe", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/calacatta-verde", "https://a.storyblok.com/f/245774/1080x1080/47d0fbfd6e/kitchen-benchtop_calacatta-verde_1x1_2.webp"],
  ["Calacatta Viola", "Deluxe", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/calacatta-viola", "https://a.storyblok.com/f/245774/1080x1080/a44cd39c55/kitchen-benchtop_calacatta-viola_1x1_1.webp"],
  ["Carrara", "Classic", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/carrara", "https://a.storyblok.com/f/245774/3047x3047/9fb9ef452b/carrara_swatch_1x1.webp"],
  ["Cemento Bianco", "Pure", "Whites/Creams", "No veins", "Suede", "https://www.smartstone.com.au/stone-benchtops/cemento-bianco", "https://a.storyblok.com/f/245774/1080x1080/c728d97967/kitchen-benchtop_cemento-bianco_1x1.webp"],
  ["Concreto Grigio", "Pure", "Greys/Blacks", "No veins", "Suede", "https://www.smartstone.com.au/stone-benchtops/concreto-grigio", "https://a.storyblok.com/f/245774/1080x1080/04832eb6fc/concreto-grigio_close-up_1x1.webp"],
  ["Crema Naturale", "Pure", "Whites/Creams", "No veins", "Suede", "https://www.smartstone.com.au/stone-benchtops/crema-naturale", "https://a.storyblok.com/f/245774/1080x1080/cf698da754/kitchen-benchtop_crema-naturale_1x1_.webp"],
  ["Grafite Titanio", "Deluxe", "Greys/Blacks", "No veins", "Suede", "https://www.smartstone.com.au/stone-benchtops/grafite-titanio", "https://a.storyblok.com/f/245774/1080x1080/59cc6af44a/kitchen-benchtop_grafite-titanio_1x1.webp"],
  ["Grigio Caldo", "Pure", "Greys/Blacks", "No veins", "Suede", "https://www.smartstone.com.au/stone-benchtops/grigio-caldo", "https://a.storyblok.com/f/245774/1080x1080/6b59d8a335/kitchen-benchtop_grigio-caldo_1x1.webp"],
  ["Grigio Solido", "Pure", "Greys/Blacks", "No veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/grigio-solido", "https://a.storyblok.com/f/245774/1080x810/7e4e0d2769/grigio-solido_close-up_3x4.webp"],
  ["Nero Puro", "Pure", "Greys/Blacks", "No veins", "Suede", "https://www.smartstone.com.au/stone-benchtops/nero-puro", "https://a.storyblok.com/f/245774/1080x1080/3c9341833f/kitchen-benchtop_nero-puro_1x1_.webp"],
  ["Pietra Luna", "Classic", "Greys/Blacks", "No veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/pietra-luna", "https://a.storyblok.com/f/245774/2756x2756/db145f4a68/pietra-luna-1x1.webp"],
  ["Pietra Scuro", "Classic", "Greys/Blacks", "No veins", "Suede", "https://www.smartstone.com.au/stone-benchtops/pietra-scuro", "https://a.storyblok.com/f/245774/1080x1080/812612b49d/kitchen-benchtop_pietra-scuro_1x1_.webp"],
  ["Statuario Grigio", "Deluxe", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/statuario-grigio", "https://a.storyblok.com/f/245774/1080x1080/c06d6e114e/kitchen-benchtop_statuario-grigio_in-focus2_1x1.webp"],
  ["Super White", "Deluxe", "Whites/Creams", "No veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/super-white", "https://a.storyblok.com/f/245774/1080x810/ec467441c1/super-white_close-up_3x4.webp"],
  ["Taj Mahal", "Classic", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/taj-mahal", "https://a.storyblok.com/f/245774/824x824/17f088b2d4/taj-mahal-1x1-crop.webp"],
  ["Volakas Gold", "Deluxe", "Whites/Creams", "Veins", "Matt", "https://www.smartstone.com.au/stone-benchtops/volakas-gold", "https://a.storyblok.com/f/245774/1080x1080/972e3f3012/kitchen-benchtop_volakas-gold_1x1_1.webp"],
];

function decodeHtml(value = "") {
  return String(value)
    .replace(/&nbsp;|\u00a0|Â /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#038;/g, "&")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value = "") {
  return String(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "surface";
}

function colourFamilyFor(value = "") {
  if (/white|blanco|bianco|albus|ivory|cream|snow|bliss|linen|pearl|opal|taj|calacatta|carrara|statuario|vanilla|le blanc|lumena|pure/i.test(value)) return "Whites/Creams";
  if (/black|nero|graph|grey|gris|grigio|fume|sleet|basalt|scuro|concrete|luna|aluminous|mottle|pietra/i.test(value)) return "Greys/Blacks";
  if (/gold|rose|rosso|red|blue|verde|green|brown|sienna|sahara|marrakesh/i.test(value)) return "Warm/Accents";
  return "Natural/Neutral";
}

function patternTypeFor(value = "", explicit = "") {
  if (/no veins/i.test(explicit)) return "No veins";
  if (/veins/i.test(explicit)) return "Veins";
  if (/calacatta|carrara|statuario|taj|venat|arabesk|whisper|river|vein|marquina|travertino|swirl|lace|striata/i.test(value)) return "Veins";
  return "No veins/low movement";
}

function canonicalRecord(input) {
  const officialProductUrl = input.officialProductUrl || input.officialCatalogueUrl || "";
  const productCode = input.productCode || slug(input.colourName);
  const id = `${slug(input.supplier)}-${slug(productCode)}-${slug(input.colourName)}`;
  const local = input.primarySwatchImage ? `/images/catalogues/benchtops/${slug(input.supplier)}/${slug(productCode)}-${slug(input.colourName)}${path.extname(new URL(input.primarySwatchImage).pathname) || ".jpg"}` : "";
  return {
    id,
    supplier: input.supplier,
    brand: input.brand || input.supplier,
    productCode,
    colourName: input.colourName,
    collection: input.collection || "",
    priceGroup: input.priceGroup || "",
    materialType: input.materialType || "",
    colourFamily: input.colourFamily || colourFamilyFor(input.colourName),
    patternType: input.patternType || patternTypeFor(input.colourName, input.surfaceDesign),
    finishOptions: input.finishOptions?.length ? input.finishOptions : ["Supplier confirmation required"],
    thicknessOptions: input.thicknessOptions?.length ? input.thicknessOptions : ["Supplier confirmation required"],
    slabSizes: input.slabSizes?.length ? input.slabSizes : ["Confirm with supplier"],
    indoorSuitable: input.indoorSuitable ?? true,
    outdoorSuitable: input.outdoorSuitable ?? "Confirm with supplier",
    bookmatchAvailable: input.bookmatchAvailable ?? "Confirm with supplier",
    throughBodyVeining: input.throughBodyVeining ?? "Confirm with supplier",
    primarySwatchImage: local,
    slabImage: local,
    lifestyleImages: input.lifestyleImages || [],
    officialProductUrl,
    officialCatalogueUrl: input.officialCatalogueUrl || officialProductUrl,
    sampleOrderUrl: input.sampleOrderUrl || input.officialProductUrl || input.officialCatalogueUrl || "",
    availabilityRegion: input.availabilityRegion || "AU - confirm local availability",
    availabilityStatus: input.availabilityStatus || "active",
    pricingTier: input.pricingTier || "supplier_quote_required",
    priceStatus: input.priceStatus || "supplier_quote_required",
    description: input.description || `${input.supplier} ${input.colourName} benchtop surface. ${SOURCE_NOTE}`,
    warrantySummary: input.warrantySummary || "Confirm current supplier warranty for selected product, use and installation.",
    verifiedAt: VERIFIED_AT,
    source: input.source || SOURCE_NOTE,
    officialImageUrl: input.primarySwatchImage || "",
    surfaceDesign: input.surfaceDesign || "",
    requiresManualVerification: Boolean(input.requiresManualVerification),
  };
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "gr8-result-stone-catalogue-sync/1.0" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function parseStoneAmbassador() {
  const html = await fetchText(SUPPLIERS["stone-ambassador"].url);
  const rx = /<div class="[^"]*colour__card[^"]*item-(\d+)" data-filter="([^"]+)"[\s\S]*?<img src="([^"]+)"[\s\S]*?<a href="([^"]+)" class="thumbnail__link"><\/a>[\s\S]*?<h4 class="item__title text-dark">([\s\S]*?)<\/h4>/g;
  const records = [];
  for (const match of html.matchAll(rx)) {
    const filters = match[2];
    const colourName = decodeHtml(match[5]);
    const isPorcelain = /porcelain|category-/i.test(filters);
    const isKaya = /kaya/i.test(filters);
    const range = isKaya ? "Kaya Surfaces" : isPorcelain ? "Vasari Porcelain" : "Zenith Surfaces (VCS)";
    const priceGroup = (filters.match(/category-\d/i)?.[0] || filters.match(/essential|deluxe|premium|prestige|signature/i)?.[0] || "Confirm category").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const region = /wa-only/i.test(match[4]) ? "WA only" : "AU - confirm local availability";
    records.push(canonicalRecord({
      supplier: "Stone Ambassador",
      productCode: match[1],
      colourName,
      collection: range,
      priceGroup,
      materialType: isPorcelain ? "Porcelain" : isKaya ? "Kaya Surfaces" : "Zenith Surfaces (VCS)",
      finishOptions: ["Confirm with Stone Ambassador"],
      thicknessOptions: ["Confirm with Stone Ambassador"],
      slabSizes: ["Confirm with Stone Ambassador"],
      primarySwatchImage: match[3],
      officialProductUrl: match[4],
      officialCatalogueUrl: SUPPLIERS["stone-ambassador"].url,
      sampleOrderUrl: match[4],
      availabilityRegion: region,
      source: "Stone Ambassador catalogue HTML card",
    }));
  }
  return records;
}

function parseSmartstoneFixture() {
  return SMARTSTONE_FIXTURE.map(([colourName, priceGroup, colourFamily, surfaceDesign, finish, url, image]) => canonicalRecord({
    supplier: "Smartstone",
    productCode: slug(colourName),
    colourName,
    collection: "Sintered Collection",
    priceGroup,
    materialType: "Sintered stone",
    colourFamily,
    surfaceDesign,
    finishOptions: [finish],
    thicknessOptions: ["Confirm on current Smartstone product record"],
    slabSizes: ["Confirm on current Smartstone product record"],
    indoorSuitable: true,
    outdoorSuitable: true,
    primarySwatchImage: image,
    officialProductUrl: url,
    officialCatalogueUrl: SUPPLIERS.smartstone.url,
    sampleOrderUrl: "https://www.smartstone.com.au/stone-benchtops",
    throughBodyVeining: /calacatta|statuario|super/i.test(colourName) ? "Confirm; Smartstone describes through-body vein technology for the collection" : "Confirm with supplier",
    source: "Smartstone official Sintered Collection page and official linked product pages",
    requiresManualVerification: true,
  }));
}

function parseCaesarstoneFixture() {
  return CAESARSTONE_FIXTURE.map(([code, colourName, collection, materialType, priceGroup, finish, thicknesses, slabSize, url, image]) => canonicalRecord({
    supplier: "Caesarstone",
    productCode: code,
    colourName,
    collection,
    priceGroup,
    materialType,
    finishOptions: finish.split(",").map((item) => item.trim()).filter(Boolean),
    thicknessOptions: thicknesses,
    slabSizes: [slabSize],
    primarySwatchImage: image || "",
    officialProductUrl: url,
    officialCatalogueUrl: SUPPLIERS.caesarstone.url,
    sampleOrderUrl: url,
    source: "Caesarstone Australia official colour catalogue/product pages; direct local sync returned 403",
    requiresManualVerification: true,
  }));
}

function parseNeolithFixture() {
  return NEOLITH_FIXTURE.map(([colourName, collection, materialType, finishes, thicknesses, url, image]) => canonicalRecord({
    supplier: "Neolith",
    productCode: slug(colourName),
    colourName,
    collection,
    materialType,
    finishOptions: finishes,
    thicknessOptions: thicknesses,
    slabSizes: ["Confirm selected model/finish slab format with Neolith distributor"],
    indoorSuitable: true,
    outdoorSuitable: true,
    primarySwatchImage: image || "",
    officialProductUrl: url,
    officialCatalogueUrl: SUPPLIERS.neolith.url,
    sampleOrderUrl: url,
    source: "Neolith official all-colours and model pages; model option compatibility requires supplier confirmation",
    requiresManualVerification: true,
  }));
}

async function downloadImage(record, failures) {
  if (!record.officialImageUrl || dryRun || !record.primarySwatchImage) return false;
  const target = path.join(ROOT, "public", record.primarySwatchImage.replace(/^\//, ""));
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    try {
      await fs.access(target);
      return false;
    } catch {}
    const response = await fetch(record.officialImageUrl, { headers: { "user-agent": "gr8-result-stone-catalogue-sync/1.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await fs.writeFile(target, Buffer.from(await response.arrayBuffer()));
    return true;
  } catch (error) {
    failures.push({ id: record.id, supplier: record.supplier, colourName: record.colourName, url: record.officialImageUrl, reason: error.message });
    record.primarySwatchImage = "";
    record.slabImage = "";
    return false;
  }
}

async function recordsForSupplier(key) {
  if (key === "stone-ambassador") return parseStoneAmbassador();
  if (key === "smartstone") return parseSmartstoneFixture();
  if (key === "caesarstone") return parseCaesarstoneFixture();
  if (key === "neolith") return parseNeolithFixture();
  throw new Error(`Unsupported supplier: ${key}`);
}

async function main() {
  const records = [];
  const supplierReports = {};
  for (const key of selectedSupplierKeys) {
    const before = records.length;
    try {
      const next = await recordsForSupplier(key);
      records.push(...next);
      supplierReports[SUPPLIERS[key].name] = { sourceUrl: SUPPLIERS[key].url, activeProducts: next.length, syncStatus: key === "stone-ambassador" ? "live_html_extracted" : "official_source_fixture_manual_verification_required" };
    } catch (error) {
      supplierReports[SUPPLIERS[key]?.name || key] = { sourceUrl: SUPPLIERS[key]?.url || "", activeProducts: 0, syncStatus: "failed", error: error.message };
    }
    if (records.length === before && !supplierReports[SUPPLIERS[key]?.name || key]?.error) supplierReports[SUPPLIERS[key].name].syncStatus = "no_records";
  }

  const byId = new Map();
  const duplicates = [];
  records.forEach((record) => {
    if (byId.has(record.id)) duplicates.push(record.id);
    else byId.set(record.id, record);
  });
  const unique = Array.from(byId.values()).sort((left, right) => `${left.supplier}|${left.collection}|${left.colourName}`.localeCompare(`${right.supplier}|${right.collection}|${right.colourName}`));
  const existing = await fs.readFile(JSON_PATH, "utf8").then((text) => JSON.parse(text).products || []).catch(() => []);
  const currentIds = new Set(unique.map((record) => record.id));
  const inactive = supplierArg ? [] : existing.filter((record) => record.id && !currentIds.has(record.id)).map((record) => ({ ...record, availabilityStatus: "inactive", priceStatus: record.priceStatus || "price_pending" }));
  const finalRecords = [...unique, ...inactive];
  const imageFailures = [];
  let imagesStored = 0;
  for (const record of finalRecords.filter((item) => item.availabilityStatus === "active")) {
    if (await downloadImage(record, imageFailures)) imagesStored += 1;
  }
  const active = finalRecords.filter((record) => record.availabilityStatus === "active");
  const countsBySupplier = Object.fromEntries(Object.values(SUPPLIERS).map((supplier) => [supplier.name, active.filter((record) => record.supplier === supplier.name).length]));
  const imagesBySupplier = Object.fromEntries(Object.values(SUPPLIERS).map((supplier) => [supplier.name, active.filter((record) => record.supplier === supplier.name && record.primarySwatchImage).length]));
  const rangeTotals = active.reduce((acc, record) => {
    const key = `${record.supplier} / ${record.collection || "Unspecified"}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const report = {
    dryRun,
    suppliers: supplierReports,
    sourceUrls: Object.fromEntries(Object.entries(SUPPLIERS).map(([key, supplier]) => [key, supplier.url])),
    verifiedAt: VERIFIED_AT,
    activeProducts: active.length,
    activeProductsBySupplier: countsBySupplier,
    inactiveMarked: inactive.length,
    duplicatesDetected: duplicates.length,
    duplicateIds: duplicates,
    imagesStored,
    imagesAvailableBySupplier: imagesBySupplier,
    imageFailures,
    rangeTotals,
    manualVerificationRequired: active.filter((record) => record.requiresManualVerification).map((record) => record.id),
  };
  if (!dryRun) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const payload = { title: "Stone, Porcelain & Sintered Benchtops", familyKey: "stone-benchtops", verifiedAt: VERIFIED_AT, products: finalRecords };
    await fs.writeFile(JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`);
    await fs.writeFile(MODULE_PATH, `const stoneBenchtopCatalogue = ${JSON.stringify(payload, null, 2)};\n\nexport default stoneBenchtopCatalogue;\n`);
    await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
