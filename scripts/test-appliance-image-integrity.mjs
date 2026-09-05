import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const cataloguePath = path.join(ROOT, "data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json");
const publicRoot = path.join(ROOT, "public");

const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));
const products = catalogue.products || [];

function localFilePath(publicPath) {
  if (!publicPath || /^https?:\/\//i.test(publicPath)) return "";
  return path.join(publicRoot, publicPath.replace(/^\/+/, ""));
}

function isWebp(buffer) {
  return buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP";
}

function statusForProduct(product) {
  const image = product.primaryImage || "";
  if (!image) return { status: "missing image", detail: "no primaryImage" };
  if (/^https?:\/\//i.test(image)) return { status: "remote-only image", detail: image };
  const filePath = localFilePath(image);
  if (!fs.existsSync(filePath)) return { status: "broken path", detail: image };
  const buffer = fs.readFileSync(filePath);
  if (!buffer.length) return { status: "broken path", detail: `${image} is zero bytes` };
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".webp" && !isWebp(buffer)) return { status: "broken path", detail: `${image} MIME does not match .webp` };
  if (extension === ".jpg" || extension === ".jpeg") {
    if (!(buffer[0] === 0xff && buffer[1] === 0xd8)) return { status: "broken path", detail: `${image} MIME does not match .jpg` };
  }
  if (extension === ".png") {
    if (buffer.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") return { status: "broken path", detail: `${image} MIME does not match .png` };
  }
  return { status: "working exact local image", detail: filePath };
}

const rows = [];
const imageGroups = new Map();
for (const product of products) {
  const result = statusForProduct(product);
  let dimensions = "";
  if (result.status === "working exact local image") {
    const metadata = await sharp(result.detail).metadata();
    if (!metadata.width || !metadata.height) {
      result.status = "broken path";
      result.detail = `${product.primaryImage} decoded with zero dimensions`;
    } else {
      dimensions = `${metadata.width}x${metadata.height}`;
    }
  }
  const row = {
    productId: product.productId,
    brand: product.brandName,
    family: product.familyId,
    model: product.manufacturerModel,
    status: result.status,
    primaryImage: product.primaryImage || "",
    thumbnailImage: product.thumbnailImage || "",
    imageStatus: product.imageStatus || "",
    verificationStatus: product.imageVerificationStatus || "",
    dimensions,
    detail: result.detail,
  };
  rows.push(row);
  if (row.primaryImage) {
    if (!imageGroups.has(row.primaryImage)) imageGroups.set(row.primaryImage, []);
    imageGroups.get(row.primaryImage).push(row);
  }
}

const duplicateImageGroups = Array.from(imageGroups.entries())
  .filter(([, group]) => group.length > 1)
  .map(([image, group]) => ({
    image,
    models: group.map((item) => `${item.brand} ${item.model}`),
  }));

const counts = rows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  totalProducts: rows.length,
  counts,
  duplicateImageGroups,
  rows,
}, null, 2));

const failures = rows.filter((row) => ["broken path", "remote-only image"].includes(row.status));
if (failures.length) {
  console.error(`Appliance image integrity failures: ${failures.map((item) => item.model).join(", ")}`);
  process.exit(1);
}
