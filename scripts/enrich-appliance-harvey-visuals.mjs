import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cataloguePath = path.join(root, "data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json");
const auditPath = path.join(root, "data/product-library/catalogues/appliances/AU-APPLIANCE-IMAGE-SOURCE-AUDIT.json");
const productAssetRoot = path.join(root, "public/images/catalogues/appliances/products");

const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));
const products = catalogue.products || [];
const checkedAt = "2026-09-04";

function slug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compactModel(value = "") {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function extFromContentType(contentType = "") {
  if (/png/i.test(contentType)) return ".png";
  if (/webp/i.test(contentType)) return ".webp";
  return ".jpg";
}

function absoluteUrl(url = "", base = "") {
  if (!url) return "";
  try {
    return new URL(url, base || undefined).href;
  } catch {
    return "";
  }
}

function htmlImageCandidates(html = "", pageUrl = "") {
  const candidates = [];
  const metaPatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/gi,
  ];
  for (const pattern of metaPatterns) {
    for (const match of html.matchAll(pattern)) candidates.push(absoluteUrl(match[1], pageUrl));
  }
  for (const match of html.matchAll(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi)) {
    candidates.push(absoluteUrl(match[1], pageUrl));
  }
  return Array.from(new Set(candidates.filter(Boolean))).filter((url) => !/logo|favicon|placeholder|spinner|loader/i.test(url));
}

function imageLooksRelevant(url = "", product = {}) {
  const text = decodeURIComponent(url).toLowerCase();
  const model = compactModel(product.manufacturerModel).toLowerCase();
  const looseModel = slug(product.manufacturerModel).replace(/-/g, "");
  if (model && text.replace(/[^a-z0-9]/g, "").includes(model)) return true;
  if (looseModel && text.replace(/[^a-z0-9]/g, "").includes(looseModel)) return true;
  return /resourceimage|product|cdn|media|images|catalogue|products/i.test(url);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const response = await fetch(url, {
    redirect: "follow",
    signal: controller.signal,
    headers: {
      "user-agent": "Mozilla/5.0 ProductLibraryVisualAudit/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return await response.text();
}

async function fetchImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const response = await fetch(url, {
    redirect: "follow",
    signal: controller.signal,
    headers: {
      "user-agent": "Mozilla/5.0 ProductLibraryVisualAudit/1.0",
      accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
    },
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const contentType = response.headers.get("content-type") || "";
  if (!/^image\//i.test(contentType)) throw new Error(`not an image: ${contentType}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 3000) throw new Error(`image too small: ${buffer.length}`);
  return { buffer, contentType };
}

function candidatePages(product = {}) {
  const compact = compactModel(product.manufacturerModel);
  const brand = slug(product.brandName);
  const existing = [product.productPageUrl, product.imageSourceUrl].filter(Boolean);
  return Array.from(new Set([
    ...existing,
    `https://harveynormancommercial.com.au/products/${compact}`,
    `https://harveynormancommercial.com.au/products/${encodeURIComponent(product.manufacturerModel)}`,
    brand === "omega" ? `https://omegaappliances.com.au/?s=${encodeURIComponent(product.manufacturerModel)}` : "",
    brand === "euromaid" ? `https://www.euromaid.com/en-au/search?search=${encodeURIComponent(product.manufacturerModel)}` : "",
    brand === "smeg" ? `https://www.smeg.com/au/products/${compact}` : "",
    brand === "westinghouse" ? `https://www.westinghouse.com.au/search/?q=${encodeURIComponent(product.manufacturerModel)}` : "",
    brand === "blanco" ? `https://www.blanco.com/au-en/search/?query=${encodeURIComponent(product.manufacturerModel)}` : "",
    brand === "ariston" ? `https://ariston.com.au/?s=${encodeURIComponent(product.manufacturerModel)}` : "",
  ].filter(Boolean))).slice(0, 4);
}

async function enrichProduct(product) {
  if (product.primaryImage && String(product.primaryImage).startsWith("/images/")) {
    return { productId: product.productId, model: product.manufacturerModel, status: "already-local", image: product.primaryImage };
  }
  console.log(`Checking ${product.brandName} ${product.manufacturerModel}`);
  const attempts = [];
  for (const pageUrl of candidatePages(product)) {
    try {
      const html = await fetchText(pageUrl);
      const title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || "";
      const pageText = html.replace(/<[^>]+>/g, " ");
      const exactModelOnPage = compactModel(pageText).includes(compactModel(product.manufacturerModel));
      const images = htmlImageCandidates(html, pageUrl).filter((imageUrl) => imageLooksRelevant(imageUrl, product)).slice(0, 3);
      attempts.push({ pageUrl, title, exactModelOnPage, images: images.slice(0, 8) });
      for (const imageUrl of images) {
        try {
          const { buffer, contentType } = await fetchImage(imageUrl);
          const brandDir = path.join(productAssetRoot, slug(product.brandName));
          fs.mkdirSync(brandDir, { recursive: true });
          const relativePath = `/images/catalogues/appliances/products/${slug(product.brandName)}/${slug(product.manufacturerModel)}${extFromContentType(contentType)}`;
          fs.writeFileSync(path.join(root, "public", relativePath.replace(/^\//, "")), buffer);
          product.primaryImage = relativePath;
          product.additionalImages = Array.from(new Set([...(product.additionalImages || []), relativePath]));
          product.imageStatus = exactModelOnPage ? "verified-authorised-supplier-local" : "review-required-local";
          product.imageVerificationStatus = exactModelOnPage ? "verified-exact" : "review-required";
          product.imageSourceUrl = imageUrl;
          product.imageSourcePageUrl = pageUrl;
          product.imageSourceOrganisation = /harveynormancommercial/i.test(pageUrl)
            ? "Harvey Norman Commercial"
            : (product.brandName || product.supplierName || "");
          product.imageCheckedAt = checkedAt;
          if (exactModelOnPage) {
            product.manualReviewRequired = product.specificationStatus !== "complete";
            product.modelVerificationNote = "Exact model image stored locally from verified page.";
          }
          return { productId: product.productId, model: product.manufacturerModel, status: product.imageStatus, image: relativePath, imageUrl, pageUrl, attempts };
        } catch (error) {
          attempts.push({ pageUrl, imageError: `${imageUrl}: ${error.message}` });
        }
      }
    } catch (error) {
      attempts.push({ pageUrl, error: error.message });
    }
  }
  product.imageCheckedAt = checkedAt;
  product.imageStatus = product.imageStatus || "exact-image-unavailable";
  product.imageVerificationStatus = "unresolved";
  product.modelVerificationNote = "Exact model image not verified by automated authorised-source pass.";
  return { productId: product.productId, model: product.manufacturerModel, status: "unresolved", attempts };
}

const audit = [];
for (const product of products) {
  audit.push(await enrichProduct(product));
}

catalogue.sourceCheckedAt = checkedAt;
catalogue.visualCatalogueUpdatedAt = checkedAt;
fs.writeFileSync(cataloguePath, `${JSON.stringify(catalogue, null, 2)}\n`);
fs.writeFileSync(auditPath, `${JSON.stringify({ updatedAt: checkedAt, products: audit }, null, 2)}\n`);

const summary = audit.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify(summary, null, 2));
