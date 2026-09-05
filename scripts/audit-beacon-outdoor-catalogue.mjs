import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const SOURCES = [
  ["Outdoor Lighting", "https://www.beaconlighting.com.au/lighting/outdoor-lighting"],
  ["Outdoor Wall Lights", "https://www.beaconlighting.com.au/lighting/outdoor-lighting/outdoor-wall-lights"],
  ["Security Sensor Lighting", "https://www.beaconlighting.com.au/lighting/outdoor-lighting/security-sensor-lighting"],
  ["Solar Lighting", "https://www.beaconlighting.com.au/lighting/outdoor-lighting/solar-lighting"],
  ["Outdoor Pendant Lights", "https://www.beaconlighting.com.au/lighting/outdoor-lighting/outdoor-ceiling-lighting/outdoor-pendant-lights"],
  ["Outdoor Floodlights", "https://www.beaconlighting.com.au/led-outdoor-flood-lights"],
];

const OUT_DIR = path.join(process.cwd(), "test-results", "beacon-outdoor-catalogue");

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function titleFromUrl(url = "") {
  try {
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
    return slug
      .replace(/\.html$/i, "")
      .split("-")
      .map((part) => {
        if (/^\d+v$/i.test(part)) return part.toUpperCase();
        if (/^led$/i.test(part)) return "LED";
        if (/^ip\d+$/i.test(part)) return part.toUpperCase();
        if (/^diy$/i.test(part)) return "DIY";
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  } catch {
    return "";
  }
}

async function scrapeSource(page, [category, url]) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const products = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("li.product-item, .product-item, [data-product-id]"));
    return cards.map((card) => {
      const link = card.querySelector("a.product-item-link, a.product-item-photo, a[href*='.html'], a[href*='beaconlighting.com.au']");
      const image = card.querySelector("img.product-image-photo, img");
      const price = card.querySelector(".special-price .price, .price-final_price .price, .price-box .price, [data-price-amount]");
      const skuText = card.querySelector(".sku")?.textContent || card.getAttribute("data-sku") || "";
      return {
        name: link?.textContent?.replace(/\s+/g, " ").trim() || card.querySelector(".product-item-name")?.textContent?.replace(/\s+/g, " ").trim() || "",
        sku: skuText.replace(/^#/, "").trim(),
        url: link?.href || "",
        image: image?.currentSrc || image?.src || image?.getAttribute("data-src") || "",
        price: price?.textContent?.replace(/\s+/g, " ").trim() || "",
        rawText: card.textContent?.replace(/\s+/g, " ").trim().slice(0, 500) || "",
      };
    }).filter((product) => product.name || product.url || product.sku);
  });
  return products.map((product) => ({ category, sourceUrl: url, ...product }));
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 1000 },
  });
  const page = await browser.newPage();
  const results = [];
  for (const source of SOURCES) {
    const products = await scrapeSource(page, source);
    results.push(...products);
    console.log(`${source[0]}: ${products.length}`);
  }
  await browser.close();

  const byUrl = new Map();
  for (const product of results) {
    const key = product.url || `${product.category}:${product.name}:${product.sku}`;
    if (!key || byUrl.has(key)) continue;
    byUrl.set(key, {
      ...product,
      name: cleanText(product.name || product.rawText.split("$")[0]),
      sku: cleanText(product.sku || product.rawText.match(/#?\b\d{5,7}\b/)?.[0]?.replace(/^#/, "") || ""),
      price: cleanText(product.price || product.rawText.match(/\$\d+(?:\.\d{2})?/)?.[0] || ""),
    });
  }

  const output = Array.from(byUrl.values())
    .filter((product) => /\/[^/]+$/.test(product.url) && !/buying-guide|catalog\/product_viewed/i.test(product.url))
    .map((product) => ({
      ...product,
      name: titleFromUrl(product.url) || product.name,
      sku: /^\d{6}$/.test(product.sku) ? product.sku : "",
    }));
  await fs.writeFile(path.join(OUT_DIR, "beacon-outdoor-products.audit.json"), `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Unique products: ${output.length}`);
  console.log(`Audit file: ${path.join(OUT_DIR, "beacon-outdoor-products.audit.json")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
