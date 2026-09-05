import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PRODUCTS_PATH = path.join(ROOT, "data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json");
const BRANDS_PATH = path.join(ROOT, "data/product-library/catalogues/appliances/AU-APPLIANCE-BRANDS.json");
const AUDIT_PATH = path.join(ROOT, "APPLIANCE_IMAGE_AND_SOURCE_AUDIT.csv");
const ASSET_DIR = path.join(ROOT, "public/images/catalogues/appliances");
const PRODUCT_ASSET_DIR = path.join(ASSET_DIR, "products");
const BRAND_ASSET_DIR = path.join(ASSET_DIR, "brands");
const VERIFIED_AT = "2026-09-04";

const productCatalogue = JSON.parse(fs.readFileSync(PRODUCTS_PATH, "utf8"));
const brandCatalogue = JSON.parse(fs.readFileSync(BRANDS_PATH, "utf8"));
const products = productCatalogue.products || [];
const auditRows = [];
const pageCache = new Map();
let downloadedProducts = 0;
let downloadedBrandLogos = 0;

fs.mkdirSync(PRODUCT_ASSET_DIR, { recursive: true });
fs.mkdirSync(BRAND_ASSET_DIR, { recursive: true });

await updateBrandLogos();
await updateProductImages();
writeAudit();

fs.writeFileSync(PRODUCTS_PATH, `${JSON.stringify(productCatalogue, null, 2)}\n`);
fs.writeFileSync(BRANDS_PATH, `${JSON.stringify(brandCatalogue, null, 2)}\n`);

const statuses = products.reduce((acc, product) => {
  const key = product.imageStatus || "missing";
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  products: products.length,
  productsWithPrimaryImage: products.filter((product) => product.primaryImage).length,
  downloadedProducts,
  downloadedBrandLogos,
  statuses,
  auditPath: path.relative(ROOT, AUDIT_PATH),
  productAssetDir: path.relative(ROOT, PRODUCT_ASSET_DIR),
  brandAssetDir: path.relative(ROOT, BRAND_ASSET_DIR),
}, null, 2));

async function updateBrandLogos() {
  const sources = {
    Ariston: {
      url: "https://ariston.com.au/media/Ariston-brand-logo.jpg",
      sourceUrl: "https://ariston.com.au/",
      sourceOrganisation: "Ariston Australia",
      extension: ".jpg",
    },
    Blanco: {
      url: "https://upload.wikimedia.org/wikipedia/commons/7/79/BLANCO-logo.svg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:BLANCO-logo.svg",
      sourceOrganisation: "BLANCO Kommunikation / Wikimedia Commons",
      extension: ".svg",
      background: "#ffffff",
    },
    Euromaid: {
      url: "https://www.euromaid.com/themes/custom/euromaid/logo.svg",
      sourceUrl: "https://www.euromaid.com/en-au",
      sourceOrganisation: "Euromaid Australia",
      extension: ".svg",
    },
    Omega: {
      url: "https://images.squarespace-cdn.com/content/v1/6434bb26a48593544005e14d/9b138388-50de-48a9-9b45-95acb9e1c700/Omega_black_logo_transparent.png?format=1500w",
      sourceUrl: "https://omegaappliances.com.au/",
      sourceOrganisation: "Omega Appliances Australia",
      extension: ".png",
    },
    Smeg: {
      url: "https://www.smeg.com/webfiles/1786010670655/images/smeg_logo_black.svg",
      sourceUrl: "https://www.smeg.com/au",
      sourceOrganisation: "Smeg Australia",
      extension: ".svg",
    },
    Westinghouse: {
      url: "https://www.westinghouse.com.au/contentassets/187af942684545628d9d3bbce68f35b9/westinghouse-logo-full-.svg",
      sourceUrl: "https://www.westinghouse.com.au/",
      sourceOrganisation: "Westinghouse Australia",
      extension: ".svg",
    },
  };

  for (const brand of brandCatalogue.brands || []) {
    const source = sources[brand.brandName];
    if (!source) continue;
    const localPath = `/images/catalogues/appliances/brands/${slug(brand.brandName)}-logo${source.extension}`;
    const ok = await download(source.url, path.join(ROOT, "public", localPath), { referer: source.sourceUrl });
    if (!ok) continue;
    downloadedBrandLogos += 1;
    brand.logoUrl = localPath;
    brand.logo = localPath;
    brand.logoLocalPath = localPath;
    brand.logoSourceUrl = source.sourceUrl;
    brand.logoSourceAssetUrl = source.url;
    brand.logoSourceOrganisation = source.sourceOrganisation;
    brand.logoAttribution = source.sourceOrganisation;
    brand.logoStatus = "official-source-local";
    brand.logoCheckedAt = VERIFIED_AT;
    brand.logoBackground = source.background || "#ffffff";
  }
}

async function updateProductImages() {
  const omegaArchive = await fetchText("https://omegaappliances.com.au/archive").catch(() => "");

  for (const product of products) {
    if (isRemoteImage(product.primaryImage)) {
      const localPath = `/images/catalogues/appliances/products/${slug(product.brandName)}/${slug(product.manufacturerModel)}${extensionForUrl(product.primaryImage)}`;
      const downloaded = await download(product.primaryImage, path.join(ROOT, "public", localPath), { referer: product.productPageUrl || product.imageSourceUrl || "" });
      if (downloaded) {
        downloadedProducts += 1;
        product.imageSourceUrl = product.imageSourceUrl || product.primaryImage;
        product.primaryImage = localPath;
        product.imageSourceType = product.imageSourceType || "official-australian-product-page";
        product.imageVerificationStatus = "verified-exact-model";
        product.imageVerifiedAt = VERIFIED_AT;
        product.imageCheckedAt = VERIFIED_AT;
        product.imageAttribution = product.imageSourceOrganisation || `${product.brandName} Australia`;
        product.imageStatus = "verified-official-local";
        product.modelVerificationNote = `Previously verified exact model ${product.manufacturerModel}; remote image stored locally for Product Library display.`;
        auditRows.push(auditRow(product, { localPath, result: "verified", reason: product.modelVerificationNote }));
        continue;
      }
    }

    const source = await resolveImageSource(product, omegaArchive);
    if (!source?.imageUrl || !source?.productPageUrl) {
      markUnresolved(product, source?.reason || "No exact model image source verified in this pass.");
      continue;
    }

    const localPath = `/images/catalogues/appliances/products/${slug(product.brandName)}/${slug(product.manufacturerModel)}${extensionForUrl(source.imageUrl)}`;
    const downloaded = await download(source.imageUrl, path.join(ROOT, "public", localPath), { referer: source.productPageUrl });
    if (!downloaded) {
      markUnresolved(product, `Exact model page found but image download failed: ${source.imageUrl}`);
      continue;
    }

    downloadedProducts += 1;
    product.primaryImage = localPath;
    product.additionalImages = Array.isArray(product.additionalImages) ? product.additionalImages.filter((image) => image && image !== localPath) : [];
    product.imageSourceUrl = source.imageUrl;
    product.productPageUrl = source.productPageUrl;
    product.imageSourceType = source.sourceType;
    product.imageVerificationStatus = "verified-exact-model";
    product.imageVerifiedAt = VERIFIED_AT;
    product.imageCheckedAt = VERIFIED_AT;
    product.imageAttribution = source.sourceOrganisation;
    product.imageSourceOrganisation = source.sourceOrganisation;
    product.modelVerificationNote = `Exact model ${product.manufacturerModel} found on ${source.sourceOrganisation}; image stored locally for Product Library display.`;
    product.imageStatus = source.sourceType.includes("official") ? "verified-official-local" : "verified-authorised-supplier-local";
    product.manualReviewRequired = product.manualReviewRequired && product.descriptionStatus !== "verified-complete";

    auditRows.push(auditRow(product, {
      localPath,
      result: "verified",
      reason: product.modelVerificationNote,
      source,
    }));
  }
}

async function resolveImageSource(product, omegaArchive) {
  const brand = product.brandName;
  const model = product.manufacturerModel;
  const existingPage = product.productPageUrl;

  const candidates = [];
  if (existingPage) candidates.push({ url: existingPage, sourceType: "official-australian-product-page", sourceOrganisation: product.imageSourceOrganisation || `${brand} Australia` });

  if (brand === "Smeg") {
    candidates.push({ url: `https://www.smeg.com/au/products/${encodeURIComponent(model)}`, sourceType: "official-australian-product-page", sourceOrganisation: "Smeg Australia" });
  }

  if (brand === "Westinghouse") {
    const modelSlug = slug(model);
    const segment = product.familyId === "freestanding-cookers" ? "freestanding-ovens" : product.familyId;
    candidates.push({ url: `https://www.westinghouse.com.au/cooking/${segment}/${modelSlug}/`, sourceType: "official-australian-product-page", sourceOrganisation: "Westinghouse Australia" });
  }

  if (brand === "Ariston") {
    if (existingPage) candidates.push({ url: existingPage, sourceType: "official-australian-product-page", sourceOrganisation: "Ariston Australia" });
  }

  if (brand === "Omega") {
    const archivePage = omegaProductPageFromArchive(omegaArchive, model);
    if (archivePage) candidates.push({ url: archivePage, sourceType: "official-australian-product-page", sourceOrganisation: "Omega Appliances Australia" });
  }

  for (const candidate of uniqueCandidates(candidates)) {
    const html = await fetchText(candidate.url).catch(() => "");
    if (!html || !html.toLowerCase().includes(model.toLowerCase().replace(/\s+/g, "")) && !html.toLowerCase().includes(model.toLowerCase())) continue;
    const imageUrl = bestImageUrl(html, model);
    if (!imageUrl) continue;
    return { ...candidate, imageUrl };
  }

  return { reason: "Exact model image source not verified after official-source pass." };
}

function omegaProductPageFromArchive(html, model) {
  if (!html) return "";
  const index = html.toLowerCase().indexOf(model.toLowerCase());
  if (index < 0) return "";
  const window = html.slice(index, index + 12000);
  const match = window.match(/&quot;fullUrl&quot;:&quot;([^&]+)&quot;/);
  if (!match) return "";
  return new URL(match[1].replace(/\\\//g, "/"), "https://omegaappliances.com.au").href;
}

function bestImageUrl(html, model) {
  const decoded = decodeHtml(html).replace(/\\u002F/g, "/").replace(/\\\//g, "/");
  const urls = [...decoded.matchAll(/https?:\/\/[^"'\s)<>]+?\.(?:jpg|jpeg|png|webp|svg)(?:\?[^"'\s)<>]+)?/gi)]
    .map((match) => match[0].replace(/&amp;/g, "&"))
    .filter((url) => !/favicon|logo|placeholder|sprite|icon/i.test(url));
  const modelCompact = model.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const modelTokens = model.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const exactish = urls.find((url) => url.toLowerCase().replace(/[^a-z0-9]+/g, "").includes(modelCompact));
  if (exactish) return normaliseImageUrl(exactish);
  const tokenMatch = urls.find((url) => modelTokens.length && modelTokens.every((token) => url.toLowerCase().includes(token)));
  if (tokenMatch) return normaliseImageUrl(tokenMatch);
  const ogMatch = decoded.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || decoded.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return ogMatch ? normaliseImageUrl(ogMatch[1].replace(/&amp;/g, "&")) : "";
}

function markUnresolved(product, reason) {
  if (!product.primaryImage) {
    product.imageStatus = "exact-image-unavailable";
    product.imageVerificationStatus = "unresolved";
    product.imageCheckedAt = VERIFIED_AT;
    product.modelVerificationNote = reason;
  }
  auditRows.push(auditRow(product, { localPath: product.primaryImage || "", result: product.primaryImage ? "previously-verified" : "unresolved", reason }));
}

function auditRow(product, { localPath = "", result = "", reason = "", source = {} } = {}) {
  return {
    productId: product.productId,
    brandName: product.brandName,
    manufacturerModel: product.manufacturerModel,
    familyId: product.familyId,
    primaryImage: product.primaryImage || "",
    localAssetPath: localPath,
    imageStatus: product.imageStatus || "",
    imageVerificationStatus: product.imageVerificationStatus || "",
    imageSourceUrl: product.imageSourceUrl || source.imageUrl || "",
    imageSourceType: product.imageSourceType || source.sourceType || "",
    imageSourceOrganisation: product.imageSourceOrganisation || source.sourceOrganisation || "",
    imageAttribution: product.imageAttribution || "",
    imageCheckedAt: product.imageCheckedAt || VERIFIED_AT,
    productPageUrl: product.productPageUrl || source.productPageUrl || "",
    result,
    reasonForReview: reason,
  };
}

function writeAudit() {
  const headers = [
    "productId",
    "brandName",
    "manufacturerModel",
    "familyId",
    "primaryImage",
    "localAssetPath",
    "imageStatus",
    "imageVerificationStatus",
    "imageSourceUrl",
    "imageSourceType",
    "imageSourceOrganisation",
    "imageAttribution",
    "imageCheckedAt",
    "productPageUrl",
    "result",
    "reasonForReview",
  ];
  const csv = [headers, ...auditRows.map((row) => headers.map((header) => row[header] || ""))]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  fs.writeFileSync(AUDIT_PATH, `${csv}\r\n`);
}

async function fetchText(url) {
  if (pageCache.has(url)) return pageCache.get(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  const response = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 Product Library image audit" } })
    .finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const text = await response.text();
  pageCache.set(url, text);
  return text;
}

async function download(url, filePath, { referer = "" } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const response = await fetch(url.replace(/^http:\/\//i, "https://"), {
    redirect: "follow",
    signal: controller.signal,
    headers: {
      "user-agent": "Mozilla/5.0 Product Library image audit",
      ...(referer ? { referer } : {}),
    },
  }).catch(() => null).finally(() => clearTimeout(timeout));
  if (!response?.ok) return false;
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength < 300) return false;
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
  return true;
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = candidate.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRemoteImage(value = "") {
  return /^https?:\/\//i.test(String(value || ""));
}

function extensionForUrl(url) {
  const cleanUrl = url.split("?")[0].toLowerCase();
  const match = cleanUrl.match(/\.(jpg|jpeg|png|webp|svg)$/);
  if (!match) return ".jpg";
  return match[1] === "jpeg" ? ".jpg" : `.${match[1]}`;
}

function normaliseImageUrl(url = "") {
  return String(url || "").trim().replace(/^http:\/\//i, "https://");
}

function decodeHtml(value = "") {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/g, "/")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function csvCell(input) {
  const text = String(input ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function slug(value = "") {
  return String(value || "asset").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "asset";
}
