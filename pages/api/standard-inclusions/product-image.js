import { withWorkspace } from "../../../lib/withWorkspace";
import { getEffectiveProductCatalogue } from "../../../lib/product-library/catalogueService.js";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const APPROVED_IMAGE_HOSTS = new Set([
  "admin.bnd.com.au",
  "asset.duluxgroup.com.au",
  "assets.beaconlighting.com.au",
  "bwassets.widen.net",
  "cdn.corinthian.com.au",
  "cdn.sanity.io",
  "cdn.shopify.com",
  "gw-assets.assaabloy.com",
  "handlehouse.com.au",
  "images.ctfassets.net",
  "images.salsify.com",
  "lysaght.com",
  "strproductcatprod.blob.core.windows.net",
  "www.csrassetlibrary.com",
  "www.dowell.com.au",
  "www.metroll.com.au",
  "www.modwood.com.au",
  "www.monier.com.au",
  "www.nationaltiles.com.au",
  "www.stramit.com.au",
  "www.westinghouse.com.au",
  "zanda.com.au",
]);

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const productId = String(req.query?.productId || "").trim();
  if (!productId) return res.status(400).json({ error: "Product ID is required." });

  const catalogue = getEffectiveProductCatalogue({ organisationId: req.workspaceId });
  const product = catalogue.canonicalProducts.find((entry) => entry.stableProductId === productId);
  if (!product?.imageReference) return res.status(404).json({ error: "No approved image is recorded for this workspace product." });

  let source;
  try {
    source = new URL(product.imageReference);
  } catch {
    return res.status(400).json({ error: "The approved product image reference is not an external URL." });
  }
  if (source.protocol !== "https:" || !APPROVED_IMAGE_HOSTS.has(source.hostname.toLowerCase())) {
    return res.status(403).json({ error: "The product image source is not approved for brochure export." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(source, { redirect: "follow", signal: controller.signal });
    if (!response.ok) return res.status(502).json({ error: `The approved product image source returned ${response.status}.` });
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) return res.status(502).json({ error: "The approved product image source did not return an image." });
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES) return res.status(413).json({ error: "The approved product image exceeds the export size limit." });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: "The approved product image exceeds the export size limit." });
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.status(200).send(buffer);
  } catch (error) {
    if (error?.name === "AbortError") return res.status(504).json({ error: "The approved product image source timed out." });
    return res.status(502).json({ error: `The approved product image could not be loaded: ${error.message}` });
  } finally {
    clearTimeout(timeout);
  }
}

export default withWorkspace(handler);
