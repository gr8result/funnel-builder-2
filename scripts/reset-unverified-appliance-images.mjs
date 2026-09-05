import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cataloguePath = path.join(root, "data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json");
const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));

let reset = 0;
for (const product of catalogue.products || []) {
  if (product.imageStatus !== "review-required-local") continue;
  product.primaryImage = "";
  product.additionalImages = [];
  product.imageStatus = "exact-image-unavailable";
  product.imageVerificationStatus = "unresolved";
  product.manualReviewRequired = true;
  product.manualReviewReason = "Automated source pass found a local image candidate, but it was not confirmed as the exact model and must not be shown.";
  product.modelVerificationNote = "Exact model image remains unresolved; review-required candidate intentionally withheld from live cards.";
  reset += 1;
}

fs.writeFileSync(cataloguePath, `${JSON.stringify(catalogue, null, 2)}\n`);
console.log(JSON.stringify({ reset }, null, 2));
