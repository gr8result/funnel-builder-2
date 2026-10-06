/**
 * Repairs dead Beacon Lighting image URLs in the exterior finishes catalogue.
 *
 * Beacon migrated product media from
 *   https://www.beaconlighting.com.au/media/catalog/product/<a>/<b>/<sku>.jpg?...
 * to
 *   https://assets.beaconlighting.com.au/images/<sku>.jpg
 * and the old URLs now return 404, so every External Lighting tile renders blank.
 *
 * Rather than guessing the new filename, this re-reads each product's own official
 * page (already stored on the record as official_product_url) and takes the
 * og:image the supplier publishes there, then verifies that URL actually serves an
 * image before writing it back. Nothing is invented: a product whose page or image
 * cannot be confirmed is left untouched and listed in the report.
 *
 * Usage:
 *   node scripts/repair-beacon-exterior-lighting-images.mjs [--dry-run] [--limit N]
 */
import fs from "node:fs/promises";
import path from "node:path";

const CATALOGUE = path.join(process.cwd(), "data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json");
const REPORT = path.join(process.cwd(), "data/product-library/source-evidence/beacon-exterior-lighting/IMAGE-REPAIR-REPORT.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i === -1 ? Infinity : Number(args[i + 1]) || Infinity;
})();
const CONCURRENCY = 4;
const TODAY = new Date().toISOString().slice(0, 10);

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** The supplier's own published image for this product page. */
function extractOgImage(html) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og) return og[1];
  const ld = html.match(/"image"\s*:\s*"([^"]+)"/);
  return ld ? ld[1] : "";
}

async function imageIsReal(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    const type = res.headers.get("content-type") || "";
    const len = Number(res.headers.get("content-length") || 0);
    if (!res.ok || !type.startsWith("image/")) return { ok: false, reason: `status ${res.status} type ${type || "none"}` };
    // A 1x1 tracking pixel or empty body is not a product photo.
    if (len && len < 1024) return { ok: false, reason: `suspiciously small (${len} bytes)` };
    return { ok: true, type, bytes: len };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index], index);
        await new Promise((r) => setTimeout(r, 250));
      }
    })
  );
  return results;
}

async function main() {
  const catalogue = JSON.parse(await fs.readFile(CATALOGUE, "utf8"));
  const lighting = catalogue.products.filter((p) => p.family_key === "external-lighting");
  const targets = lighting.slice(0, LIMIT === Infinity ? lighting.length : LIMIT);

  console.log(`External Lighting products: ${lighting.length}${targets.length !== lighting.length ? ` (processing ${targets.length})` : ""}`);
  console.log(DRY_RUN ? "DRY RUN - no files will be written\n" : "");

  let done = 0;
  const outcomes = await mapWithConcurrency(targets, CONCURRENCY, async (product) => {
    const code = product.product_code;
    const page = product.official_product_url;
    const base = { product_code: code, product_name: product.product_name, page, previous_image: product.primary_image_url };
    if (!page) return { ...base, status: "skipped", reason: "no official_product_url" };

    let html;
    try {
      html = await fetchText(page);
    } catch (error) {
      process.stdout.write(`  [${++done}/${targets.length}] ${code} PAGE FAIL\n`);
      return { ...base, status: "failed", reason: `product page: ${error.message}` };
    }

    const image = extractOgImage(html);
    if (!image) {
      process.stdout.write(`  [${++done}/${targets.length}] ${code} NO IMAGE ON PAGE\n`);
      return { ...base, status: "failed", reason: "no og:image on product page" };
    }

    const check = await imageIsReal(image);
    if (!check.ok) {
      process.stdout.write(`  [${++done}/${targets.length}] ${code} IMAGE UNVERIFIED (${check.reason})\n`);
      return { ...base, status: "failed", reason: `image not served: ${check.reason}`, candidate_image: image };
    }

    process.stdout.write(`  [${++done}/${targets.length}] ${code} ok\n`);
    return { ...base, status: image === product.primary_image_url ? "already-current" : "repaired", new_image: image, bytes: check.bytes };
  });

  const byCode = new Map(outcomes.filter((o) => o.status === "repaired").map((o) => [o.product_code, o]));

  for (const product of catalogue.products) {
    const fix = byCode.get(product.product_code);
    if (!fix) continue;
    product.primary_image_url = fix.new_image;
    product.thumbnail_url = fix.new_image;
    product.gallery_image_urls = fix.new_image;
    product.image_source_url = product.official_product_url;
    product.image_source_type = "official_product_page";
    product.image_status = "verified_official_product_page";
    product.image_verified_at = TODAY;
  }

  const summary = {
    repairedAt: TODAY,
    reason: "Beacon Lighting migrated product media to assets.beaconlighting.com.au; the previously stored www.beaconlighting.com.au/media/catalog URLs now return 404.",
    method: "Re-read each product's own official_product_url and took the supplier-published og:image, then verified the URL serves image/* before writing it back.",
    counts: {
      total: outcomes.length,
      repaired: outcomes.filter((o) => o.status === "repaired").length,
      alreadyCurrent: outcomes.filter((o) => o.status === "already-current").length,
      failed: outcomes.filter((o) => o.status === "failed").length,
      skipped: outcomes.filter((o) => o.status === "skipped").length,
    },
    products: outcomes,
  };

  console.log("\n--- summary ---");
  console.log(JSON.stringify(summary.counts, null, 2));

  if (DRY_RUN) {
    console.log("\nDry run: catalogue not written.");
    return;
  }

  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  if (summary.counts.repaired > 0) {
    catalogue.beaconExteriorLightingCatalogue = {
      ...catalogue.beaconExteriorLightingCatalogue,
      imageRepair: {
        repairedAt: TODAY,
        repaired: summary.counts.repaired,
        failed: summary.counts.failed,
        report: path.relative(process.cwd(), REPORT).replace(/\\/g, "/"),
      },
    };
    await fs.writeFile(CATALOGUE, `${JSON.stringify(catalogue, null, 2)}\n`, "utf8");
    console.log(`\nWrote ${summary.counts.repaired} repaired image URLs to the catalogue.`);
  } else {
    console.log("\nNothing repaired; catalogue left unchanged.");
  }
  console.log(`Report: ${path.relative(process.cwd(), REPORT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
