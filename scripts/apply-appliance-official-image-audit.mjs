import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const cataloguePath = path.join(ROOT, "data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json");
const imageAuditPath = path.join(ROOT, "APPLIANCE_PRODUCT_IMAGE_AUDIT.csv");
const missingImagePath = path.join(ROOT, "APPLIANCE_MISSING_IMAGE_REVIEW.csv");

const verifiedImages = new Map([
  ["product:appliances:cooktops:smeg:pga64", "https://assets.4flow.cloud/THUMB_PGA64.jpg.jpg?pEFs=cVY2M1MyN1ZOMFFadEQ5ZlVOMzhVeUdiMU5kUXRGaGxrNnNZVGRqQmlIb01KMnVOQ05LWjZVQ05QYjZnQVBtYjluYjhaQ2tzTm45VnhUNmM1bG5aWU9wRmY1K3FMZlZCZzRMRnB6VjVQYjBTRzJkVWttaW54ZUZ6TU02eGd1OGdCRmJSeFZCNlFpUS9rMGU1bGtpR1JXQ0VIYWJNQWFpWk52OU55VGI0Y3Z3PQ"],
  ["product:appliances:cooktops:smeg:sai4954d", "https://assets.4flow.cloud/THUMB_SAI4954D.jpg.jpg?pEFs=cVY2M1MyN1ZOMFFadEQ5ZlVOMzhVMWd2SEg1bFN2MnZHYVlRMko1S3lpRENMOGZyaml2dzUreTZqZ3RTTkJjNHR4WmFMblhtQTA3eU1NK0UrVGZ3NUl6ZnlwanRFRG1BRE94SWNmdVk3RGxmbVhTanUzRjFaQ2kyeWJqbWl3MUVjY0FoS0RSd2phMXZLNURPOGo2T1lQNVpTZ2lqRCt1eW9ycGhtRXptd2NzPQ"],
  ["product:appliances:cooktops:westinghouse:whc642bc", "https://www.westinghouse.com.au/resourceimageelectrolux/Public/Image2/product/111278/63236.png?width=1200&height=630"],
  ["product:appliances:cooktops:westinghouse:whg644sc", "https://www.westinghouse.com.au/resourceimageelectrolux/Public/Image2/product/111227/63237.png?width=1200&height=630"],
  ["product:appliances:cooktops:westinghouse:whg958sc", "https://www.westinghouse.com.au/resourceimageelectrolux/Public/Image2/product/111233/40883.png?width=1200&height=630"],
  ["product:appliances:cooktops:westinghouse:whi955bd", "https://www.westinghouse.com.au/resourceimageelectrolux/Public/Image2/product/114564/58266.png?width=1200&height=630"],
  ["product:appliances:dishwashers:smeg:dwau6315x3", "https://assets.4flow.cloud/THUMB_DWAU6315X3.jpg.jpg?pEFs=cVY2M1MyN1ZOMFFadEQ5ZlVOMzhVd29CV1BXb0plM0xyZUlOUGM1Tm43RjFyUlRvQ0NYdFFibm4vSS9yUEJ6K3BpRFBVTzFQNHNTN00wVG9TdklTdkZQN3YwRVVmaVZKeWs2TURlWnZFaFNma2dWVytYdFhsVU5ISXlXVS91ZlE0MHFtZ0h2RFl2aEdBQmpSNGRPYi9LS1pSVzFITExld3ZpM2pOVzRHLzI4PQ"],
  ["product:appliances:freestanding-cookers:smeg:fs9606as-1", "https://assets.4flow.cloud/THUMB_FS9606AS-1.jpg.jpg?pEFs=cVY2M1MyN1ZOMFFadEQ5ZlVOMzhVOThLblkyMnN1UWh3S3NIZFJMblBXYkpOREQrN0hndjlzQWo3V3p5SVRQYU1HTEpnTkhLSzFCYm1wdy95aFVZb05qNmFVK3MzWjMxeUJMWjMySVVycHJ4S1d2QmZNRWJXaldXNXJSSTFVVE9iVjN2VE5aSXRDSjQydmwxOVBCcHcyKzB5c0loRmFZa2x5aXhCczIxZDZ3PQ"],
  ["product:appliances:freestanding-cookers:westinghouse:wfe9515sd", "https://www.westinghouse.com.au/resourceimageelectrolux/Public/Image2/product/114100/63277.png?width=1200&height=630"],
  ["product:appliances:ovens:westinghouse:wve6314dd", "https://www.westinghouse.com.au/resourceimageelectrolux/Public/Image2/product/113700/63221.png?width=1200&height=630"],
  ["product:appliances:rangehoods:smeg:pum601x", "https://assets.4flow.cloud/THUMB_PUM601X.jpg.jpg?pEFs=cVY2M1MyN1ZOMFFadEQ5ZlVOMzhVOVlBeDZHWisxelBwYll5VWpNVDF5SVFpSGZ6OUdodHFQNzZQRDJJRDBCemhqUmJNSXlsK25NdmdzSUhnb3JNeGdGeTd0MVVUOXFLaFNxVlczaDVFcG5LU1luYVFvWFdGNXRoNXBiNmtSWCtJNVprSitybW1uOHptVDArdngrbHFJd2RNWkEvR0F2RTU5TEdwTGUzelRBPQ"],
  ["product:appliances:rangehoods:smeg:shw610x1", "https://assets.4flow.cloud/THUMB_SHW610X1.jpg.jpg?pEFs=cVY2M1MyN1ZOMFFadEQ5ZlVOMzhVOWJhOTlTbEZiT3QxLzBLVUpQSE1qdzBHRzUyN3l1UWx0MWl1cFZEcklzSzgyQU5KRStYUHBXaStCQUxHV3ZsSWUrdDdTU3IzWkxBMHUxNXhlRTRlTUVyMWUvbzI4aVFjdWpPNVgvVW9OZzYwSXpNMit3cGZmVVZ0QThVZTNvN0lyZXBYSk1Ydzdmd1MzOVZxMklsN3h3PQ"],
  ["product:appliances:rangehoods:smeg:shw910x2", "https://assets.4flow.cloud/THUMB_SHW910X2.jpg.jpg?pEFs=cVY2M1MyN1ZOMFFadEQ5ZlVOMzhVKzVrblRZa1pNbC9uYnRrTGZqS2piZ3A3cUxkOXQvcUxuUWlMMWlHNkJ2QW1oc0pmeEhJa29sdTdFVG05Y3p2elA3dkF5TWNiSGlLQ1dFejBjQVRoY0xZNkc4NVFWSktTVkQ1TG1tNzVCUzJBaStaVTBXaDBTWEozZlBEMVlLOE96R1JaRFI4Slo2T0RYMlY1RURkbUdvPQ"],
  ["product:appliances:rangehoods:westinghouse:wrc614sd", "https://www.westinghouse.com.au/resourceimageelectrolux/Public/Image2/product/116488/63251.png?width=1200&height=630"],
  ["product:appliances:rangehoods:westinghouse:wrc914sd", "https://www.westinghouse.com.au/resourceimageelectrolux/Public/Image2/product/116487/63249.png?width=1200&height=630"],
  ["product:appliances:rangehoods:westinghouse:wrf610wa", "https://www.westinghouse.com.au/resourceimageelectrolux/Public/Image2/product/106581/63263.png?width=1200&height=630"],
  ["product:appliances:rangehoods:westinghouse:wrf910wa", "https://www.westinghouse.com.au/resourceimageelectrolux/Public/Image2/product/106583/40948.png?width=1200&height=630"],
  ["product:appliances:rangehoods:westinghouse:wrr614sb", "https://www.westinghouse.com.au/resourceimageelectrolux/Public/Image2/product/111317/63259.png?width=1200&height=630"],
]);

const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));
let updated = 0;
for (const product of catalogue.products) {
  const imageUrl = verifiedImages.get(product.productId);
  if (!imageUrl) continue;
  product.primaryImage = imageUrl;
  product.imageStatus = "verified-official-remote-reference";
  product.imageSourceUrl = product.productPageUrl || imageUrl;
  product.imageSourceOrganisation = product.brandName;
  product.imageCheckedAt = "2026-09-03";
  product.manualReviewRequired = product.descriptionStatus !== "verified-complete" || product.specificationStatus !== "complete";
  updated += 1;
}
fs.writeFileSync(cataloguePath, `${JSON.stringify(catalogue, null, 2)}\n`);

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const imageRows = [[
  "product_id",
  "brand",
  "family",
  "model",
  "primary_image",
  "image_status",
  "image_source_url",
  "image_source_organisation",
  "product_page_url",
  "checked_at",
  "licence_status",
]];
for (const product of catalogue.products) {
  imageRows.push([
    product.productId,
    product.brandName,
    product.familyId,
    product.manufacturerModel,
    product.primaryImage,
    product.imageStatus,
    product.imageSourceUrl,
    product.imageSourceOrganisation,
    product.productPageUrl,
    product.imageCheckedAt,
    product.primaryImage ? "official-remote-reference" : product.imageStatus,
  ]);
}
fs.writeFileSync(imageAuditPath, imageRows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n");
const missingRows = [[
  "product_id",
  "brand",
  "family",
  "model",
  "image_status",
  "exact_model_source_url",
  "source_organisation",
  "required_action",
]];
for (const product of catalogue.products.filter((item) => !item.primaryImage || !String(item.imageStatus || "").startsWith("verified"))) {
  missingRows.push([
    product.productId,
    product.brandName,
    product.familyId,
    product.manufacturerModel,
    product.imageStatus,
    product.productPageUrl,
    product.imageSourceOrganisation,
    product.productPageUrl
      ? "Confirm supplier/manufacturer image licence or approved direct asset before storing primary image."
      : "Complete exact model image research; Product Library UI must use a category fallback until exact image is approved.",
  ]);
}
fs.writeFileSync(missingImagePath, missingRows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n");
console.log(`Applied ${updated} official remote image references.`);
