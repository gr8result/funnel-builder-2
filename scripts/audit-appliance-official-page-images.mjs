import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const cataloguePath = path.join(ROOT, "data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json");
const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));

function absoluteUrl(sourceUrl, candidate) {
  if (!candidate) return "";
  try {
    return new URL(candidate, sourceUrl).toString();
  } catch {
    return candidate;
  }
}

function findOgImage(html, sourceUrl) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return absoluteUrl(sourceUrl, match[1]);
  }
  return "";
}

const rows = [];
for (const product of catalogue.products.filter((item) => item.productPageUrl)) {
  try {
    const response = await fetch(product.productPageUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 ProductLibraryAudit/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const html = await response.text();
    rows.push({
      product_id: product.productId,
      brand: product.brandName,
      model: product.manufacturerModel,
      status: response.status,
      source_url: product.productPageUrl,
      image_url: findOgImage(html, product.productPageUrl),
    });
  } catch (error) {
    rows.push({
      product_id: product.productId,
      brand: product.brandName,
      model: product.manufacturerModel,
      status: "error",
      source_url: product.productPageUrl,
      image_url: "",
      error: error.message,
    });
  }
}

console.log(JSON.stringify(rows, null, 2));
