// Public Australian manufacturer catalogue, including Hycraft. No retailer price inference.
import fs from "node:fs";
import path from "node:path";

export const key = "godfrey-hirst";
export const name = "Godfrey Hirst";
export const manufacturerSource = true;
const ORIGIN = "https://www.godfreyhirst.com";
const API = "https://node-api.godfreyhirst.com/products";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const array = (value) => Array.isArray(value) ? value : value ? [value] : [];
const text = (value) => array(value).filter(Boolean).join("; ") || null;

export async function fetchVariants({ cacheDir, refreshPages = false, log = () => {} }) {
  async function read(url, file) {
    const target = path.join(cacheDir, file);
    if (!refreshPages && fs.existsSync(target)) return fs.readFileSync(target, "utf8");
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
        const body = await response.text();
        fs.writeFileSync(target, body);
        return body;
      } catch (error) { if (attempt === 2) throw error; await delay(1000 * (attempt + 1)); }
    }
  }
  const sources = [`${ORIGIN}/au/product-search/carpet`];
  const discovered = new Map();
  let expected = null;
  for (let page = 0; ; page++) {
    // Read all AU residential catalogue pages and classify from each record's actual productType.
    // The gateway silently ignores unknown filter parameters, so never rely on a URL filter alone.
    const url = `${API}?website=GHRES&region=au&pageSize=100&page=${page}`;
    const response = JSON.parse(await read(url, `listing-${page}.json`));
    if (!Array.isArray(response.items) || !response.pagination) throw new Error("Manufacturer listing schema changed");
    expected ??= response.pagination.totalItems;
    response.items.forEach((item) => discovered.set(item.productCode, item));
    if (page + 1 >= response.pagination.totalPages) break;
    if (!response.items.length || page > 100) throw new Error("Incomplete manufacturer pagination");
  }
  if (discovered.size !== expected) throw new Error(`Incomplete manufacturer listing: ${discovered.size}/${expected}`);
  const ranges = [...discovered.values()].filter((item) => item.productType?.id === "CPT" && item.market === "residential" && item.status === "Published" && item.region?.includes("au"));
  log(`Discovered ${ranges.length} current Australian residential carpet ranges`);
  const variants = [], failures = [];
  for (const item of ranges) {
    const url = `${ORIGIN}/au/products/${item.slug}`;
    try {
      const html = await read(url, `${item.productCode}.html`);
      const data = JSON.parse(html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1] || "null");
      const p = data?.props?.pageProps?.product;
      if (p?.productCode !== item.productCode || p?.productType?.id !== "CPT" || !p.variants?.length || p.variants.length !== item.variantCount) throw new Error("Product identity / colour count mismatch");
      const highlights = (p.highlights || []).filter((h) => !h.websites?.length || h.websites.includes("GHRES-AU"));
      const ratings = array(p.accsRating);
      const fibre = text(p.productSubTypes?.map((s) => s.name.replace(/\s+Carpet$/i, ""))) || p.yarn || null;
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&"));
      const specs = {
        fibre, yarn: p.yarn || null, style: p.surfaceTexture || text(p.style), construction: p.construction || null,
        rollWidthM: Number(p.rollSize) > 0 ? Number(p.rollSize) : null, rollWidthPublished: p.rollSize || null,
        totalThicknessMm: p.thickness || null, pileHeightMm: p.pileHeight || null, pileWeight: p.pileWeight || null,
        gauge: p.gauge || null, patternRepeat: p.patternRepeat || null, backing: p.backing || null, secondaryBacking: p.secondaryBacking || null,
        accsRating: ratings, residentialRating: text(ratings.filter((r) => /residential/i.test(r))), commercialRating: text(ratings.filter((r) => /contract|commercial/i.test(r))),
        warranty: text(p.residentialWarranty), australianMade: highlights.some((h) => h.slug === "au-made") ? true : p.country === "Australia" ? true : null,
        countryOfManufacture: p.country || null, stainResistance: p.stainResistance || null,
        petFriendly: highlights.some((h) => h.slug === "pet-friendly") ? true : null,
        petSuitability: highlights.find((h) => h.slug === "pet-friendly")?.shortDescription || null,
        budget: highlights.find((h) => h.groupedHighlightsIds?.includes("budget"))?.name || null,
        sustainability: Object.fromEntries(["accreditation", "declareLabel", "indoorAirQuality", "greenStar", "pvcMinimisation", "productStewardship"].map((field) => [field, p[field] || null])),
        installation: p.installationMethod || null,
        specificationUrl: hrefs.find((href) => href.includes("/spec-sheet.pdf")) ? new URL(hrefs.find((href) => href.includes("/spec-sheet.pdf")), ORIGIN).href : null,
        documents: hrefs.filter((href) => href.includes("cloudinary.com/") && href.includes("f_pdf")).map((url) => ({ url })),
      };
      const imageUrls = [...html.matchAll(/https:\/\/res\.cloudinary\.com\/[^"<> ]+/g)].map((m) => m[0]);
      const checkedAt = fs.statSync(path.join(cacheDir, `${item.productCode}.html`)).mtime.toISOString();
      for (const v of p.variants) {
        if (!v.globalItemId || !v.colourId || !v.name) throw new Error("Colour missing manufacturer identity");
        const imageUrl = imageUrls.find((url) => url.includes(`/variants/${v.globalItemId}/swatches/`));
        variants.push({
          sku: v.globalItemId, externalProductId: v.airtableId, manufacturerProductId: p.productCode, manufacturerVariantId: v.globalItemId,
          groupKey: p.productCode, flooringType: "carpet", material: `${fibre} Carpet`, brand: text(p.brands?.map((b) => b.name)),
          manufacturer: p.manufacturer || null, supplier: "", collection: p.name, productName: `${p.name} ${v.name}`,
          colour: v.name, colourCode: v.colourId, colourGroup: text(v.predominantColours),
          officialImageUrl: imageUrl || null, productUrl: url, manufacturerUrl: url, specificationUrl: specs.specificationUrl,
          description: p.description || p.shortDescription || "", carpetSpecs: specs,
          rollWidthM: specs.rollWidthM, layingDirection: v.layingDirection || null, pattern: v.pattern || null,
          regularPricePerM2: null, salePricePerM2: null, regularPricePerPack: null, salePricePerPack: null,
          packCoverageM2: null, currency: "AUD", priceBasis: "Supplier quote required", priceSource: "", priceRetrievedAt: checkedAt,
          checkedAt, currentStatus: p.status,
        });
      }
      sources.push(url);
      log(`${p.name}: ${p.variants.length} colours (${fibre})`);
      await delay(100);
    } catch (error) { failures.push({ url, productCode: item.productCode, reason: error.message }); }
  }
  // An incomplete crawl must never mark previously selected ranges discontinued.
  if (failures.length) {
    fs.writeFileSync(path.join(cacheDir, "failures.json"), JSON.stringify(failures, null, 2));
    throw new Error(`Manufacturer import incomplete: ${failures.length} failed ranges; catalogue left unchanged. See ${cacheDir}/failures.json`);
  }
  return { variants, failures, listedCount: ranges.length, sources };
}
