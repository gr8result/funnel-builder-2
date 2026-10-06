import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

// Import only the manufacturer's explicit Laminate > Benchtops application list.
// A colour is one selectable record; finishes and manufacturer sheet SKUs are variants.
// Neither local catalogue IDs nor colour URL slugs are represented as manufacturer SKUs.
const ORIGIN = "https://www.polytec.com.au";
const SOURCE = `${ORIGIN}/specify/product-by-application/benchtops/benchtops/`;
const OUT_DIR = path.resolve("data/product-library/catalogues/benchtops");
const EVIDENCE_PATH = path.resolve("data/product-library/source-evidence/benchtops/polytec-laminate-source-manifest.json");
const BASENAME = "AU-POLYTEC-LAMINATE-BENCHTOPS";
const verifiedAt = new Date().toISOString().slice(0, 10);
const dryRun = process.argv.includes("--dry-run");

function decode(value = "") {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#(?:0?39|x27);/gi, "'")
    .replace(/&nbsp;/g, " ").replace(/&rsquo;/g, "'").replace(/&ndash;/g, "-");
}
function plain(value = "") { return decode(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(); }
function attr(html, name) {
  const rx = new RegExp(`${name}=(?:'([^']*)'|"([^"]*)")`);
  const match = html.match(rx);
  return decode(match?.[1] ?? match?.[2] ?? "");
}
function absolute(value) { return value ? new URL(value, ORIGIN).href : ""; }
function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function unique(values) { return [...new Set(values)]; }
async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "GR8-Result-catalogue-verification/1.0" }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return { html: await response.text(), finalUrl: response.url, status: response.status };
}

function parseListing(html) {
  const start = html.indexOf("<h1>Laminate Colours</h1>");
  if (start < 0) throw new Error("Manufacturer Laminate Colours section not found; refusing import.");
  const tail = html.slice(start);
  const end = tail.search(/<div class=['"]reveal\b/);
  const section = end < 0 ? tail : tail.slice(0, end);
  const records = [];
  for (const match of section.matchAll(/<a\b([^>]*class=['"]colour-tile[^>]*)>([\s\S]*?)<\/a>/g)) {
    const href = attr(match[1], "href");
    const parts = href.match(/^\/colour\/([^/]+)\/([^/]+)\/$/);
    if (!parts) throw new Error(`Unexpected official colour URL: ${href}`);
    const name = plain(match[2].match(/<span>([\s\S]*?)<\/span>/)?.[1]);
    const finishSlug = parts[2];
    const finish = name.slice(name.lastIndexOf(" ") + 1);
    if (finish.toLowerCase() !== finishSlug) throw new Error(`Unrecognized finish in ${name}: ${href}`);
    records.push({ colourSlug: parts[1], colourName: name.slice(0, -(finish.length + 1)), finish, finishSlug, officialProductUrl: absolute(href), imageUrl: absolute(attr(match[2].match(/<img\b[^>]*>/)?.[0] || "", "src")) });
  }
  if (records.length < 100 || new Set(records.map((row) => row.officialProductUrl)).size !== records.length) {
    throw new Error(`Unexpected/duplicate manufacturer listing count: ${records.length}`);
  }
  return records;
}

function parsePage(html, colour) {
  const panels = [...html.matchAll(/<div class=['"]tabs-panel content[^>]*>/g)];
  return colour.listedFinishes.map((listed) => {
    const panelIndex = panels.findIndex((panel) => attr(panel[0], "data-finish") === listed.finish);
    if (panelIndex < 0) throw new Error(`Missing ${listed.finish} tab for ${colour.colourName}`);
    const panelMatch = panels[panelIndex];
    const panel = html.slice(panelMatch.index, panels[panelIndex + 1]?.index || html.length);
    const heading = panel.match(/<h4>\s*<i[^>]*><\/i>\s*Laminate<\/h4>/);
    const laminateTail = heading ? panel.slice(heading.index + heading[0].length) : "";
    const nextHeading = laminateTail.indexOf("<h4>");
    const laminateSection = nextHeading < 0 ? laminateTail : laminateTail.slice(0, nextHeading);
    const manufacturerProducts = [];
    for (const item of laminateSection.matchAll(/<span class=['"]label secondary radius['"]>([^<]+)<\/span>[\s\S]*?<h5>([\s\S]*?)<\/h5>\s*<ul class=['"]item-attributes['"]>([\s\S]*?)<\/ul>/g)) {
      const productName = plain(item[2]);
      if (!/^Laminate\b/i.test(productName)) continue;
      const attributes = Object.fromEntries([...item[3].matchAll(/<li><strong>([^<]+):<\/strong>([\s\S]*?)<\/li>/g)].map((entry) => [plain(entry[1]), plain(entry[2])]));
      if (attributes.Finish !== listed.finish) throw new Error(`Finish mismatch: ${productName}`);
      const code = plain(item[1]);
      manufacturerProducts.push({ productCode: code, sku: code, productName, finish: attributes.Finish,
        ...(attributes.Thickness ? { thicknessMm: Number(attributes.Thickness) } : {}),
        ...(attributes.Length ? { lengthMm: Number(attributes.Length) } : {}),
        ...(attributes.Width ? { widthMm: Number(attributes.Width) } : {}),
        sourceUrl: listed.officialProductUrl });
    }
    const products = [...new Map(manufacturerProducts.map((product) => [product.sku, product])).values()];
    const colourDescription = plain(panel.match(/<p class=['"]description['"]><b>Colour:<\/b>([\s\S]*?)<\/p>/)?.[1]);
    const finishDescription = plain(panel.match(/<p class=['"]description['"]><b>Finish:<\/b>([\s\S]*?)<\/p>/)?.[1]);
    const imageUrl = absolute(attr(panelMatch[0], "data-img")) || listed.imageUrl;
    return { id: `polytec-laminate-${colour.colourSlug}-${listed.finishSlug}`, finish: listed.finish,
      productCode: products.length === 1 ? products[0].productCode : "", sku: products.length === 1 ? products[0].sku : "",
      sourceUrl: listed.officialProductUrl, officialProductUrl: listed.officialProductUrl, imageUrl,
      colourDescription, finishDescription, manufacturerProducts: products,
      laminateSheetThicknessOptions: unique(products.map((product) => product.thicknessMm).filter(Number.isFinite)).map((mm) => `${mm}mm`),
      active: true, status: "active", availabilityStatus: "active", price: null, priceStatus: "quote_required",
      sourceNotes: products.length ? "Current manufacturer Laminate product rows; sheet thickness is not fabricated benchtop thickness." : "Listed for Laminate benchtops by the manufacturer; no ordering SKU exposed in the colour page. Confirm sheet availability with supplier." };
  });
}

const listing = await fetchText(SOURCE);
const listed = parseListing(listing.html);
const colours = [...Map.groupBy(listed, (entry) => entry.colourSlug)].map(([colourSlug, rows]) => ({ colourSlug, colourName: rows[0].colourName, listedFinishes: rows }));
const evidence = { verifiedAt, sourceUrl: SOURCE, sourceHttpStatus: listing.status, sourceSha256: hash(listing.html), listingColourFinishCount: listed.length, groupedColourCount: colours.length, pages: [], images: [], exclusions: [] };
const result = [];
let position = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  while (position < colours.length) {
    const colour = colours[position++];
    const url = `${ORIGIN}/colour/${colour.colourSlug}/`;
    const page = await fetchText(url);
    const parsedFinishVariants = parsePage(page.html, colour);
    // The broad application list includes metallic kickboard-only laminates. Require
    // an actual Laminate ordering row before advertising a benchtop material option.
    const finishVariants = parsedFinishVariants.filter((variant) => variant.manufacturerProducts.length);
    for (const variant of parsedFinishVariants.filter((entry) => !entry.manufacturerProducts.length)) {
      evidence.exclusions.push({ colourName: colour.colourName, finish: variant.finish, sourceUrl: url,
        reason: "No Laminate benchtop sheet product rows; the manufacturer's published ordering rows are kickboard products.",
        publishedProductNames: [...page.html.matchAll(/<span class=['"]label secondary radius['"]>([^<]+)<\/span>[\s\S]*?<h5>([\s\S]*?)<\/h5>/g)].map((match) => ({ sku: plain(match[1]), productName: plain(match[2]) })) });
    }
    if (!finishVariants.length) {
      evidence.pages.push({ url, finalUrl: page.finalUrl, httpStatus: page.status, sha256: hash(page.html), colourName: colour.colourName,
        finishes: [], manufacturerSkuCount: 0, finishVariantsWithoutOrderingCodes: parsedFinishVariants.map((variant) => variant.finish), excluded: true });
      continue;
    }
    const variants = finishVariants.flatMap((variant) => {
      const { manufacturerProducts, colourDescription, finishDescription, laminateSheetThicknessOptions, sourceNotes, ...finishVariant } = variant;
      return manufacturerProducts.length ? manufacturerProducts.map((product) => ({
        ...finishVariant, id: `polytec-laminate-sku-${product.sku}`, productCode: product.productCode, sku: product.sku,
        productName: product.productName,
        ...(product.thicknessMm ? { thickness: `${product.thicknessMm}mm`, thicknessMm: product.thicknessMm, thicknessKind: "laminate_sheet" } : {}),
        ...(product.lengthMm && product.widthMm ? { size: `${product.lengthMm}mm x ${product.widthMm}mm`, lengthMm: product.lengthMm, widthMm: product.widthMm } : {}),
      })) : [finishVariant];
    });
    const primary = variants[0];
    const id = `polytec-laminate-benchtop-${colour.colourSlug}`;
    const finishes = unique(variants.map((variant) => variant.finish));
    const manufacturerProducts = finishVariants.flatMap((variant) => variant.manufacturerProducts);
    result.push({ id, productId: id, canonicalIdentity: `polytec:laminate-benchtop:${colour.colourSlug}`, supplier: "Polytec", brand: "Polytec",
      range: "BENCHTOPS & laminate", collection: "BENCHTOPS & laminate", productRange: "BENCHTOPS & laminate", productFamily: "Laminate benchtops",
      productName: colour.colourName, colourName: colour.colourName, colourCode: "", productCode: "", sku: "",
      material: "Laminate", materialType: "High pressure laminate", application: "Residential cabinetry benchtops", benchtopSuitability: true, doorPanelSuitability: false,
      finish: primary.finish, finishes, finishOptions: finishes, variants,
      thicknessOptions: [], laminateSheetThicknessOptions: unique(finishVariants.flatMap((variant) => variant.laminateSheetThicknessOptions)),
      thicknessStatus: "Completed benchtop thickness/profile requires supplier confirmation; sheet thickness is stored separately.",
      imageUrl: primary.imageUrl, primarySwatchImage: primary.imageUrl, officialImageUrl: primary.imageUrl,
      officialProductUrl: url, sourceUrl: url, officialCatalogueUrl: SOURCE, sourceType: "official_supplier_catalogue",
      source: "Polytec Benchtops application list and official colour pages", sourceVerifiedAt: verifiedAt, verifiedAt,
      description: `${colour.colourName} high pressure laminate for benchtops. ${finishVariants[0].colourDescription}`.trim(),
      active: true, status: "active", availabilityStatus: "active", availabilityRegion: "AU - confirm stock with supplier",
      availabilityNotes: "Active means currently listed in the manufacturer catalogue, not verified local inventory.",
      price: null, priceStatus: "quote_required", pricingTier: "supplier_quote_required",
      pricingNotes: "Manufacturer public page does not expose a verified retail price; supplier quote required.",
      identityNotes: "Canonical id identifies the colour family. Actual manufacturer ordering codes are stored per sheet in variants; no invented family SKU." });
    evidence.pages.push({ url, finalUrl: page.finalUrl, httpStatus: page.status, sha256: hash(page.html), colourName: colour.colourName,
      finishes, manufacturerSkuCount: manufacturerProducts.length, finishVariantsWithoutOrderingCodes: finishVariants.filter((variant) => !variant.manufacturerProducts.length).map((variant) => variant.finish) });
  }
}));
const imageUrls = unique(result.flatMap((record) => record.variants.map((variant) => variant.imageUrl)));
let imagePosition = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  while (imagePosition < imageUrls.length) {
    const url = imageUrls[imagePosition++];
    const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30000) });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.startsWith("image/")) throw new Error(`Swatch verification failed: ${url} (${response.status}, ${contentType})`);
    evidence.images.push({ url, httpStatus: response.status, contentType });
  }
}));
result.sort((a, b) => a.colourName.localeCompare(b.colourName));
evidence.pages.sort((a, b) => a.colourName.localeCompare(b.colourName));
evidence.images.sort((a, b) => a.url.localeCompare(b.url));
const catalogue = { title: "Polytec Laminate Benchtops", familyKey: "laminate-benchtops", verifiedAt, sourceUrl: SOURCE,
  countDefinition: "One record per verified colour; finish and sheet SKU choices are nested variants.", products: result };
const report = { verifiedAt, sourceUrl: SOURCE, rawRecords: result.length, finishVariants: result.reduce((sum, item) => sum + item.finishes.length, 0),
  productVariants: result.reduce((sum, item) => sum + item.variants.length, 0),
  manufacturerSheetSkus: result.reduce((sum, item) => sum + item.variants.filter((variant) => variant.sku).length, 0),
  images: result.filter((item) => item.imageUrl).length, availableRecords: result.filter((item) => item.active).length,
  duplicateIds: result.length - new Set(result.map((item) => item.id)).size,
  excludedSourceEntries: evidence.exclusions,
  verifiedSwatchUrls: evidence.images.length,
  priceStatus: "All supplier quote required. No retail prices imported.",
  thicknessScope: "Actual laminate sheet thickness from manufacturer SKU rows; no fabricated benchtop thickness inferred.",
  availabilityScope: "Currently manufacturer-listed Laminate benchtop colours; local inventory not verified.",
  excludedRanges: ["Compact laminate", "Xenolith", "Decorative doors and panels", "Commercial-only colour lists"], evidencePath: path.relative(process.cwd(), EVIDENCE_PATH).replaceAll("\\", "/") };
if (!dryRun) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(EVIDENCE_PATH), { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, `${BASENAME}.js`), `// Generated by scripts/sync-polytec-laminate-benchtops.mjs from official Polytec sources.\nexport default ${JSON.stringify(catalogue, null, 2)};\n`);
  await fs.writeFile(path.join(OUT_DIR, `${BASENAME}.report.json`), `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
