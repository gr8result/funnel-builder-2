// Collects public Bunnings retail listings (title, brand, item number, width, price, unit, URL) for
// the door and door-furniture brands the Product Library carries, as dated source evidence for
// price reconciliation. Read-only, a small fixed set of searches, throttled between requests.
// Output: data/product-library/source-evidence/bunnings/bunnings-listings-<date>.json
//
// Usage: node scripts/collect-bunnings-retail-prices.mjs
import fs from "node:fs";

const SEARCHES = ["hume entrance door", "hume internal door", "hume savoy", "corinthian entrance door", "corinthian internal door", "gainsborough", "lockwood"];
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const DELAY_MS = 3000;
const MAX_PAGES = 12;
const OUTPUT_DIR = "data/product-library/source-evidence/bunnings";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function listings(html) {
  const items = [];
  for (const match of html.matchAll(/\{"raw":\{/g)) {
    const start = match.index;
    let depth = 0;
    for (let index = start; index < html.length; index += 1) {
      const char = html[index];
      if (char === "\"") { index += 1; while (index < html.length && html[index] !== "\"") { if (html[index] === "\\") index += 1; index += 1; } continue; }
      if (char === "{") depth += 1;
      if (char === "}" && --depth === 0) {
        try {
          const raw = JSON.parse(html.slice(start, index + 1)).raw;
          if (raw?.objecttype === "Product" && raw.title && raw.price !== undefined) items.push(raw);
        } catch { /* not a product block */ }
        break;
      }
    }
  }
  return items;
}

const retrievedAt = new Date().toISOString();
const byItem = new Map();
for (const search of SEARCHES) {
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `https://www.bunnings.com.au/search/products?q=${encodeURIComponent(search)}${page > 1 ? `&page=${page}` : ""}`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
    const html = response.ok ? await response.text() : "";
    const found = listings(html);
    const total = Number((html.match(/"totalCount":(\d+)/i) || [])[1] || 0);
    console.log(`${search} p${page}: HTTP ${response.status}, ${found.length} listings${total ? ` of ${total}` : ""}`);
    for (const raw of found) {
      byItem.set(String(raw.itemnumber || raw.code), {
        itemNumber: String(raw.itemnumber || raw.code),
        title: raw.title,
        brand: raw.brandname || "",
        price: Number(raw.price),
        unit: raw.unitofprice || "",
        widthMm: Number(raw.size) || null,
        url: `https://www.bunnings.com.au${raw.productroutingurl}`,
        categories: raw.supercategoriescode || [],
        search,
      });
    }
    await sleep(DELAY_MS);
    if (!found.length || found.length < 36 || (total && page * 36 >= total)) break;
  }
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const file = `${OUTPUT_DIR}/bunnings-listings-${retrievedAt.slice(0, 10)}.json`;
fs.writeFileSync(file, `${JSON.stringify({ retailer: "Bunnings", retrievedAt, gstIncluded: true, searches: SEARCHES, listings: [...byItem.values()] }, null, 2)}\n`);
console.log(`${byItem.size} unique listings -> ${file}`);
