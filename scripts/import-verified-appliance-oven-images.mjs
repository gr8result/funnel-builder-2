import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const VERIFIED_AT = "2026-09-04";
const cataloguePath = path.join(ROOT, "data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json");
const auditPath = path.join(ROOT, "data/product-library/catalogues/appliances/AU-APPLIANCE-IMAGE-SOURCE-AUDIT.json");
const assetRoot = path.join(ROOT, "public/images/catalogues/appliances/products");

const VERIFIED = [
  {
    model: "FA5834HIXAAUS",
    brand: "ariston",
    fileBase: "ariston-fa5834hixaaus",
    productPageUrl: "https://www.lazada.co.id/products/oven-ariston-built-in-electric-oven-fa5834hixaaus-i1257608344.html",
    imageSourceUrl: "https://img.lazcdn.com/g/p/af06a9456e00d143f7800eb5f591d280.png_720x720q80.png_.webp",
    additionalSourceUrls: [
      "https://img.lazcdn.com/g/p/67c01626f26435f501af2883861da261.png_720x720q80.png_.webp",
    ],
    sourceType: "authorised-international-retailer-local",
    sourceOrganisation: "Lazada Indonesia / KitchenArt",
    attribution: "Product image sourced from Lazada Indonesia product listing for Ariston FA5834HIXAAUS.",
    note: "Exact FA5834HIXAAUS listing and product image. Australian official/manufacturer page was not found during this pass.",
  },
  {
    model: "BOSE65XM",
    brand: "blanco",
    fileBase: "blanco-bose65xm",
    productPageUrl: "https://www.appliancesonline.com.au/product/blanco-bose65xm-electric-oven/",
    imageSourceUrl: "https://www.appliancesonline.com.au/ak/2/f/0/f/2f0fd57cf60c85082b2189a60c9d4db94c4a9346_Blanco_BOSE65XM_Electric_Oven_Hero_Image_high-high.jpeg?width=814",
    additionalSourceUrls: [
      "https://www.appliancesonline.com.au/ak/7/c/7/4/7c7495bed2969fcd91e89c0805295c63692cb821_Blanco_BOSE65XM_Electric_Oven_Control_Panel_high-high.jpeg?width=814",
      "https://www.appliancesonline.com.au/ak/7/5/4/0/7540729c525274ef4d4f1a5e3611c1c5369d57ac_Blanco_BOSE65XM_Electric_Oven_Inside_high-high.jpeg?width=814",
    ],
    sourceType: "authorised-australian-retailer-local",
    sourceOrganisation: "Appliances Online Australia",
    attribution: "Product image sourced from Appliances Online Australia listing for Blanco BOSE65XM.",
    note: "Exact BOSE65XM listing, image and specifications verified from Appliances Online Australia.",
  },
  {
    model: "OBO660X",
    brand: "omega",
    fileBase: "omega-obo660x",
    productPageUrl: "https://omegaappliances.com.au/archive/p/60cm-4-function-oven-obo660x",
    imageSourceUrl: "https://images.squarespace-cdn.com/content/v1/6434bb26a48593544005e14d/1683087380633-JURF0XYNHNGBLANHR4G9/omega_product_web_OBO660X.jpg?format=1500w",
    additionalSourceUrls: [],
    sourceType: "official-australian-manufacturer-archive-local",
    sourceOrganisation: "Omega Appliances Australia",
    attribution: "Product image sourced from Omega Appliances Australia archive page for OBO660X.",
    note: "Exact OBO660X image verified from the official Omega Appliances Australia archive.",
  },
  {
    model: "OBO960X1",
    brand: "omega",
    fileBase: "omega-obo960x1",
    productPageUrl: "https://omegaappliances.com.au/archive/p/90cm-9-function-electric-wall-oven-stainless-steel-obo960x1",
    imageSourceUrl: "https://images.squarespace-cdn.com/content/v1/6434bb26a48593544005e14d/1721953159335-FWZWR19POGWVZENHUK52/OBO960XTGG%2BFeature%2B2.jpg?format=1500w",
    additionalSourceUrls: [
      "https://images.squarespace-cdn.com/content/v1/6434bb26a48593544005e14d/1721953160228-35PW78CJZV1RNDV6JPPJ/OBO960XTGG%2BFront%2BOpen.jpg?format=1500w",
    ],
    sourceType: "official-australian-manufacturer-archive-local",
    sourceOrganisation: "Omega Appliances Australia",
    attribution: "Product image sourced from Omega Appliances Australia archive page for OBO960X1.",
    note: "Exact OBO960X1 page verified from Omega archive. The official page references image files named OBO960XTGG for the shared visual variant.",
  },
  {
    model: "SF64M3TVX",
    brand: "smeg",
    fileBase: "smeg-sf64m3tvx",
    productPageUrl: "https://www.smeg.com/products/SF64M3TVX",
    imageSourceUrl: "https://assets.4flow.cloud/SF64M3TVX.png?pEFs=cVY2M1MyN1ZOMFFadEQ5ZlVOMzhVNkxMdFJxVHNhT3ZEeXo3MkhDNWcvcVVKQzRRaHFkWG9vQmJtWTNWWDBCY0FmTDJLczhjMnJmNHgvVzdjWEVQazk1ak8wSGJQektVbDJuV3kraG94ZUlvRzBhY0lxaGZ0SXliQ3V0aUludmxMbTN2K1hGczB4R1MzeXRxWTNsNDJmd0E0WTJISVZYS0d3Wk9zaS9nWm00PQ",
    additionalSourceUrls: [
      "https://assets.4flow.cloud/SF64M3TVX.jpg?pEFs=cVY2M1MyN1ZOMFFadEQ5ZlVOMzhVeGhDaHdsWkRxNVJzQkprUU92amRMcFo5UjhwU2FITGpBN1ljbTdyMmgyS1JKQzVFOEIrMFVOenQ4SnRiNkRPWk5Ha3c4b3QxV3BHZk9UQmpmVkZ4cU4zS2padVlCdjhEdTBIdnl5elhnRFNoekoya2syMTB4dmRiSm9MOHFwYjUwQTM5V2RWWnZzZUNTRUl4d01GYlBJPQ",
    ],
    sourceType: "official-manufacturer-local",
    sourceOrganisation: "Smeg",
    attribution: "Product image sourced from Smeg official product page for SF64M3TVX.",
    note: "Exact SF64M3TVX product code and official media asset verified from Smeg.",
  },
  {
    model: "SFPA9395X1",
    brand: "smeg",
    fileBase: "smeg-sfpa9395x1",
    productPageUrl: "https://www.appliancesonline.com.au/product/smeg-sfp9395x1-90cm-classic-aesthetic-pyrolytic-built-in-oven/",
    imageSourceUrl: "https://www.appliancesonline.com.au/ak/e/8/3/5/e835a632dc13edc3dd219d4750ae61acd62be286_SFP9395X1_Hero_Image_high-high.jpeg?width=814",
    additionalSourceUrls: [
      "https://www.appliancesonline.com.au/ak/5/2/3/0/523017c3de96be4f20977225d4e19d6c00c03495_SFP9395X1_Closeup_high-high.jpeg?width=814",
    ],
    sourceType: "authorised-australian-retailer-local",
    sourceOrganisation: "Appliances Online Australia",
    attribution: "Product image sourced from Appliances Online Australia listing for Smeg SFP9395X1/SFPA9395X1.",
    note: "Catalogue model SFPA9395X1 is represented by the Appliances Online exact listing slug/title SFP9395X1 and model number SFP9395X1; manual review retained for the A/non-A suffix discrepancy.",
  },
  {
    model: "WVE916SC",
    brand: "westinghouse",
    fileBase: "westinghouse-wve916sc",
    productPageUrl: "https://electronicscentre.com.au/product/westinghouse-90cm-electric-built-in-oven-wve916sc/",
    imageSourceUrl: "https://electronicscentre.com.au/wp-content/uploads/2025/05/45.jpg",
    additionalSourceUrls: [
      "https://electronicscentre.com.au/wp-content/uploads/2025/05/46-600x600.jpg",
      "https://electronicscentre.com.au/wp-content/uploads/2025/05/47-600x600.jpg",
    ],
    sourceType: "authorised-australian-retailer-local",
    sourceOrganisation: "Electronics Centre Australia",
    attribution: "Product image sourced from Electronics Centre listing for Westinghouse WVE916SC.",
    note: "Exact WVE916SC listing and images verified from Australian retailer page.",
  },
];

const UNRESOLVED = [
  {
    model: "FI9 891 SP IX A AUS",
    reason: "No exact FI9 891 SP IX A AUS product image located. Research found Ariston FI7 891 SP IX A AUS Australian official/manual pages and Hotpoint FI9 891 SP IX HA, but neither is the exact catalogue model.",
    attempts: [
      "https://ariston.com.au/inventory/built-in-oven-fi7-891-sp-ix-aus/",
      "https://www.notice-facile.com/en/manual/1325647/ariston%2Bthermo%2Bfi7-891-sp-ix-a-aus",
      "https://manuals.plus/hotpoint/hotpoint-fi9-891-sp-ix-ha-multifunction-oven-quick-start-guide",
    ],
  },
  {
    model: "BOSE90X",
    reason: "No exact BOSE90X product image located. Research found BOSE902X and BOSE900X product images plus BOSE90X spare-part compatibility pages; similar Blanco 90 cm models were not imported as exact BOSE90X.",
    attempts: [
      "https://www.appliancesonline.com.au/product/900mm90cm-blanco-electric-oven-bose902x/",
      "https://www.electsales.com.au/blanco/blanco-bose900x",
      "https://spares.bigwarehouse.com.au/product_info.php?cPath=69520_80395_86986&products_id=1618625",
    ],
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function normaliseModel(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function publicPath(brand, fileName) {
  return `/images/catalogues/appliances/products/${brand}/${fileName}`;
}

async function downloadBuffer(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 ProductLibraryImageImport/1.0",
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const contentType = response.headers.get("content-type") || "";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error(`Zero-byte image for ${url}`);
  return { buffer, contentType };
}

async function createLocalImages(source) {
  const targetDir = path.join(assetRoot, source.brand);
  fs.mkdirSync(targetDir, { recursive: true });
  const { buffer, contentType } = await downloadBuffer(source.imageSourceUrl);
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Image failed to decode for ${source.model}`);
  const detailName = `${source.fileBase}.webp`;
  const thumbName = `${source.fileBase}-thumb.webp`;
  const detailPath = path.join(targetDir, detailName);
  const thumbPath = path.join(targetDir, thumbName);
  await sharp(buffer)
    .resize({ width: 1200, height: 900, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(detailPath);
  await sharp(buffer)
    .resize({ width: 420, height: 320, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toFile(thumbPath);
  const detailMeta = await sharp(detailPath).metadata();
  const thumbMeta = await sharp(thumbPath).metadata();
  return {
    primaryImage: publicPath(source.brand, detailName),
    thumbnailImage: publicPath(source.brand, thumbName),
    importedContentType: contentType,
    sourceDimensions: { width: metadata.width, height: metadata.height },
    localDimensions: {
      detail: { width: detailMeta.width, height: detailMeta.height },
      thumbnail: { width: thumbMeta.width, height: thumbMeta.height },
    },
  };
}

const catalogue = readJson(cataloguePath);
const audit = fs.existsSync(auditPath) ? readJson(auditPath) : { products: [] };
const auditByProductId = new Map((audit.products || []).map((entry) => [entry.productId, entry]));
const imported = [];

for (const source of VERIFIED) {
  const product = (catalogue.products || []).find((item) => normaliseModel(item.manufacturerModel) === normaliseModel(source.model));
  if (!product) throw new Error(`Product not found for ${source.model}`);
  const local = await createLocalImages(source);
  product.primaryImage = local.primaryImage;
  product.thumbnailImage = local.thumbnailImage;
  product.additionalImages = Array.from(new Set([local.primaryImage, local.thumbnailImage, ...(source.additionalSourceUrls || [])]));
  product.imageSourceUrl = source.imageSourceUrl;
  product.productPageUrl = source.productPageUrl;
  product.imageSourceType = source.sourceType;
  product.imageSourceOrganisation = source.sourceOrganisation;
  product.imageAttribution = source.attribution;
  product.imageVerificationStatus = source.sourceType.startsWith("official") ? "verified-official-exact-model" : "verified-authorised-exact-model";
  product.imageStatus = source.sourceType.startsWith("official") ? "verified-official-local" : "verified-authorised-supplier-local";
  product.imageVerifiedAt = VERIFIED_AT;
  product.imageCheckedAt = VERIFIED_AT;
  product.productPageStatus = "verified-exact-model";
  product.sourceCheckedAt = VERIFIED_AT;
  product.manualReviewRequired = source.model === "SFPA9395X1" || product.specificationStatus !== "complete";
  product.manualReviewReason = source.model === "SFPA9395X1"
    ? "Image verified from SFP9395X1 source; retain manual review for SFPA/SFP model-code discrepancy and partial specifications."
    : product.manualReviewReason;
  product.modelVerificationNote = source.note;
  product.research = {
    ...(product.research || {}),
    verificationStatus: product.manualReviewRequired ? "image-verified-specification-review-required" : "verified-exact-model",
    sourceType: source.sourceType,
    sourceOrganisation: source.sourceOrganisation,
    checkedAt: VERIFIED_AT,
  };
  auditByProductId.set(product.productId, {
    productId: product.productId,
    model: product.manufacturerModel,
    status: product.imageStatus,
    productPageUrl: source.productPageUrl,
    imageSourceUrl: source.imageSourceUrl,
    localPrimaryImage: local.primaryImage,
    localThumbnailImage: local.thumbnailImage,
    imageSourceType: source.sourceType,
    imageAttribution: source.attribution,
    imageVerifiedAt: VERIFIED_AT,
    note: source.note,
    validation: local,
  });
  imported.push({ model: source.model, primaryImage: local.primaryImage, thumbnailImage: local.thumbnailImage });
}

for (const unresolved of UNRESOLVED) {
  const product = (catalogue.products || []).find((item) => normaliseModel(item.manufacturerModel) === normaliseModel(unresolved.model));
  if (!product) throw new Error(`Product not found for unresolved model ${unresolved.model}`);
  product.primaryImage = "";
  product.thumbnailImage = "";
  product.additionalImages = [];
  product.imageStatus = "exact-image-unavailable";
  product.imageVerificationStatus = "unresolved";
  product.imageCheckedAt = VERIFIED_AT;
  product.productPageStatus = "not-found-after-exact-model-research";
  product.modelVerificationNote = unresolved.reason;
  product.manualReviewRequired = true;
  product.manualReviewReason = unresolved.reason;
  product.research = {
    ...(product.research || {}),
    verificationStatus: "manual-review-required",
    checkedAt: VERIFIED_AT,
  };
  auditByProductId.set(product.productId, {
    productId: product.productId,
    model: product.manufacturerModel,
    status: "unresolved",
    attempts: unresolved.attempts,
    note: unresolved.reason,
    imageVerifiedAt: VERIFIED_AT,
  });
}

const sortedAuditProducts = Array.from(auditByProductId.values())
  .sort((left, right) => String(left.productId || "").localeCompare(String(right.productId || "")));

writeJson(cataloguePath, catalogue);
writeJson(auditPath, {
  ...audit,
  updatedAt: VERIFIED_AT,
  products: sortedAuditProducts,
});

console.log(JSON.stringify({ imported, unresolved: UNRESOLVED.map((item) => item.model) }, null, 2));
