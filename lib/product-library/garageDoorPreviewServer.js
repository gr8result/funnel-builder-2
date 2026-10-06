import path from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import OpenAI, { toFile } from "openai";
import { normalizeMasterProductRecord } from "./catalogueModel.js";
import {
  garageDoorColourOptionsForProduct,
  garageDoorProfileImage,
  garageDoorProfileOptions,
} from "../builders/clientSelectionWorkflow.js";

const PREVIEW_TIMEOUT_MS = 150000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const UNAVAILABLE_MESSAGE = "AI colour previews are not connected yet. You can still review and save your door selection.";
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function previewError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function sameOrigin(req) {
  const origin = req.headers?.origin;
  if (req.headers?.["sec-fetch-site"] === "cross-site") return false;
  if (!origin) return true; // Bearer-authenticated non-browser API clients.
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && url.host === req.headers?.host;
  } catch {
    return false;
  }
}

// The existing selection wizard works without a Supabase session on localhost.
// Permit that only on the development server, from a real loopback socket and
// a same-origin browser. A forged Host header cannot grant production access.
export function isLocalGaragePreviewRequest(req, env = process.env) {
  if (env.NODE_ENV !== "development" || !LOOPBACK_ADDRESSES.has(req.socket?.remoteAddress)) return false;
  if (req.headers?.["x-forwarded-for"] || !sameOrigin(req)) return false;
  try {
    const host = new URL(`http://${req.headers?.host || ""}`).hostname;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) return false;
    return req.method === "GET" || Boolean(req.headers?.origin);
  } catch {
    return false;
  }
}

async function authenticate(req, env) {
  if (isLocalGaragePreviewRequest(req, env)) return "localhost-development";
  const token = String(req.headers?.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) throw previewError(401, "authentication_required", "Sign in to generate a colour preview.");
  const { supabaseAdmin } = await import("../supabaseAdmin.js");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) throw previewError(401, "authentication_required", "Your session has expired. Sign in to generate a colour preview.");
  return data.user.id;
}

export async function loadGaragePreviewProducts() {
  const source = await readFile(path.join(process.cwd(), "data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json"), "utf8");
  return JSON.parse(source).products.map(normalizeMasterProductRecord).filter((product) => product.familyKey === "garage-doors");
}

export function resolveGaragePreviewSelection(body, products) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw previewError(400, "invalid_selection", "Choose a garage door, profile and colour first.");
  const { productId, profile, colourId } = body;
  if (![productId, profile, colourId].every((value) => typeof value === "string" && value.length > 0 && value.length < 200)) {
    throw previewError(400, "invalid_selection", "Choose a garage door, profile and colour first.");
  }
  // Client-provided image URLs, colours and prompts are deliberately never used.
  const product = products.find((item) => [item.productId, item.productCode].includes(productId));
  if (!product || product.familyKey !== "garage-doors" || product.active === false || product.archived || product.discontinued) {
    throw previewError(400, "invalid_product", "This garage door is no longer available in the supplier catalogue.");
  }
  if (!garageDoorProfileOptions(product).includes(profile)) throw previewError(400, "invalid_profile", "Choose a profile offered for this door range.");
  const colour = garageDoorColourOptionsForProduct(product, { profile }).find((item) => item.colourId === colourId);
  if (!colour) throw previewError(400, "invalid_colour", "Choose a colour offered for this supplier and profile.");
  const dimensions = {};
  for (const key of ["openingWidth", "openingHeight"]) {
    const value = body[key];
    if (value === undefined || value === null || value === "") continue;
    const dimension = Number(value);
    if (!Number.isFinite(dimension) || dimension < 300 || dimension > 15000) throw previewError(400, "invalid_size", "Enter a valid opening size between 300 and 15,000 mm.");
    dimensions[key] = Math.round(dimension);
  }
  const referenceImageUrl = garageDoorProfileImage(profile, product);
  if (!/^\/images\/product-library\/garage-doors\/[a-z0-9/_-]+\.(?:webp|png|jpe?g)$/i.test(referenceImageUrl)) {
    throw previewError(422, "reference_unavailable", "An exact supplier image is not available for this profile yet.");
  }
  return { product, profile, colour, referenceImageUrl, ...dimensions };
}

async function readReference(referenceImageUrl) {
  const root = await realpath(path.join(process.cwd(), "public/images/product-library/garage-doors"));
  const filename = await realpath(path.join(process.cwd(), "public", referenceImageUrl.slice(1)));
  const relative = path.relative(root, filename);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw previewError(422, "reference_unavailable", "The supplier profile image could not be loaded.");
  const fileStat = await stat(filename);
  if (!fileStat.isFile() || fileStat.size > 10 * 1024 * 1024) throw previewError(422, "reference_unavailable", "The supplier profile image could not be loaded.");
  return { bytes: await readFile(filename), filename: path.basename(filename) };
}

export function garagePreviewPrompt(selection) {
  const { product, profile, colour } = selection;
  const timber = /timber|wood/i.test(`${colour.finishFamily} ${colour.finishType}`);
  return [
    "Edit the attached supplier garage-door reference photograph to create an indicative colour-selection preview.",
    `The door is ${product.manufacturer || product.supplier}, ${product.range || product.productName}, profile ${profile}.`,
    "Preserve the exact door profile: every groove, rib, panel recess, seam, spacing, orientation and surface texture shown in the reference. Preserve the door geometry, camera angle and background. Do not redesign the door or add windows, handles, trim or extra panels.",
    `Change only the door's finished surface to ${colour.officialName}, ${colour.finishType}, approximate sRGB ${colour.swatchValue}. Preserve natural shading, realistic highlights and visible profile detail.`,
    timber ? "Apply a restrained timber-look grain consistent with the named finish, while retaining every structural profile detail." : "Use the selected solid steel finish; do not invent wood grain or patterns.",
    "Keep the whole door visible. Do not add labels, text, logos, dimension marks or a colour swatch. This is a visual reference, not a dimensioned fabrication drawing.",
  ].join("\n");
}

export async function editGaragePreview(selection, { apiKey, model, reference, clientFactory = (options) => new OpenAI(options) }) {
  const client = clientFactory({ apiKey, timeout: PREVIEW_TIMEOUT_MS, maxRetries: 0 });
  const extension = path.extname(reference.filename).toLowerCase();
  const type = extension === ".webp" ? "image/webp" : extension === ".png" ? "image/png" : "image/jpeg";
  const result = await client.images.edit({
    model,
    image: await toFile(reference.bytes, reference.filename, { type }),
    prompt: garagePreviewPrompt(selection),
    ...(model === "gpt-image-1" || model.startsWith("gpt-image-1.5") ? { input_fidelity: "high" } : {}),
    size: "1536x1024",
    quality: "medium",
    output_format: "webp",
    output_compression: 90,
    n: 1,
  });
  const b64 = result?.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || !b64 || b64.length > 12 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    throw previewError(502, "invalid_preview", "The preview service did not return an image. Please try again.");
  }
  return `data:image/webp;base64,${b64}`;
}

// Bounds protect one server process; authenticated access is also required on
// hosted servers. Cache and in-flight sharing avoid repeat paid edits when a
// user returns to Review or double-clicks the same selection.
export function createGaragePreviewHandler({
  env = process.env,
  authenticateRequest = authenticate,
  loadProducts = loadGaragePreviewProducts,
  loadReference = readReference,
  editImage = editGaragePreview,
  now = Date.now,
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const limits = new Map();
  return async function garagePreviewHandler(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    if (!["GET", "POST"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "Method not allowed." });
    }
    if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: "Open this preview from your selection page." });
    try {
      const userId = await authenticateRequest(req, env);
      const apiKey = String(env.OPENAI_API_KEY || "").trim();
      if (req.method === "GET") return res.status(200).json({ ok: true, available: Boolean(apiKey), ...(!apiKey ? { message: UNAVAILABLE_MESSAGE } : {}) });
      if (!apiKey) throw previewError(503, "preview_unavailable", UNAVAILABLE_MESSAGE);
      const selection = resolveGaragePreviewSelection(req.body, await loadProducts());
      const model = String(env.OPENAI_GARAGE_PREVIEW_MODEL || "gpt-image-2").trim();
      const cacheKey = createHash("sha256").update(JSON.stringify([userId, model, selection.product.productId, selection.profile, selection.colour.colourId, selection.referenceImageUrl, selection.openingWidth, selection.openingHeight])).digest("hex");
      for (const [key, value] of cache) if (now() - value.createdAt > CACHE_TTL_MS) cache.delete(key);
      for (const [key, value] of limits) if (now() - value.startedAt > CACHE_TTL_MS) limits.delete(key);
      const cached = cache.get(cacheKey);
      if (cached) return res.status(200).json({ ...cached.result, cached: true });
      let pending = inFlight.get(cacheKey);
      if (!pending) {
        const usage = limits.get(userId) || { startedAt: now(), count: 0 };
        if (usage.count >= 8 || inFlight.size >= 3) {
          res.setHeader("Retry-After", "60");
          throw previewError(429, "preview_limit", "The preview service is busy or your preview limit has been reached. Please try again later.");
        }
        const reference = await loadReference(selection.referenceImageUrl);
        // Recheck after the file read in case a duplicate arrived concurrently.
        pending = inFlight.get(cacheKey);
        if (!pending) {
          usage.count += 1;
          limits.set(userId, usage);
          pending = (async () => {
            const imageUrl = await editImage(selection, { apiKey, model, reference });
            const result = { ok: true, imageUrl, profile: selection.profile, colourName: selection.colour.officialName, referenceImageUrl: selection.referenceImageUrl };
            cache.set(cacheKey, { result, createdAt: now() });
            while (cache.size > 12) cache.delete(cache.keys().next().value);
            return result;
          })();
          inFlight.set(cacheKey, pending);
          pending.finally(() => inFlight.delete(cacheKey)).catch(() => {});
        }
      }
      return res.status(200).json(await pending);
    } catch (error) {
      if (error?.code === "ENOENT") return res.status(422).json({ ok: false, code: "reference_unavailable", error: "The supplier profile image could not be loaded. Your selection can still be saved." });
      const known = ["invalid_selection", "invalid_product", "invalid_profile", "invalid_colour", "invalid_size", "reference_unavailable", "authentication_required", "preview_unavailable", "preview_limit", "invalid_preview"].includes(error?.code);
      if (known) return res.status(error.status).json({ ok: false, code: error.code, error: error.message });
      const timeout = /timeout|timed out|abort/i.test(`${error?.name} ${error?.message}`);
      return res.status(timeout ? 504 : 502).json({ ok: false, code: timeout ? "preview_timeout" : "preview_failed", error: timeout ? "This preview took too long. Please try again." : "The colour preview could not be generated. Please try again shortly. Your selection can still be saved." });
    }
  };
}
