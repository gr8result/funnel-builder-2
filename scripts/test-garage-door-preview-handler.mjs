import assert from "node:assert/strict";
import {
  createGaragePreviewHandler,
  loadGaragePreviewProducts,
  resolveGaragePreviewSelection,
} from "../lib/product-library/garageDoorPreviewServer.js";
import { garageDoorColourOptionsForProduct, garageDoorProfileOptions } from "../lib/builders/clientSelectionWorkflow.js";

// The colour preview reads the catalogue and the supplier reference image from disk.
// A missing node:fs/promises import turned every request into a generic 502
// ("The colour preview could not be generated"), so exercise the real file reads.
const products = await loadGaragePreviewProducts();
assert.ok(products.length > 0, "The garage door catalogue must load from disk");

function firstSelectableCombination() {
  for (const product of products) {
    for (const profile of garageDoorProfileOptions(product)) {
      const colour = garageDoorColourOptionsForProduct(product, { profile })[0];
      if (colour) return { productId: product.productId || product.productCode, profile, colourId: colour.colourId };
    }
  }
  return null;
}

const selection = firstSelectableCombination();
assert.ok(selection, "The catalogue must offer at least one product/profile/colour combination");

const resolved = resolveGaragePreviewSelection(selection, products);
assert.match(resolved.referenceImageUrl, /^\/images\/product-library\/garage-doors\/.+\.(webp|png|jpe?g)$/);

function runHandler(handler, body) {
  const req = {
    method: "POST",
    headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    socket: { remoteAddress: "127.0.0.1" },
    body,
  };
  let status = 0;
  let payload = null;
  const res = { setHeader() {}, status(code) { status = code; return this; }, json(value) { payload = value; return value; } };
  return handler(req, res).then(() => ({ status, payload }));
}

// The paid image edit is the only stubbed step; the disk reads are real.
const editedPrompts = [];
const handler = createGaragePreviewHandler({
  env: { OPENAI_API_KEY: "test-key", NODE_ENV: "development" },
  authenticateRequest: async () => "test-user",
  editImage: async (sel) => { editedPrompts.push(sel.colour.officialName); return "data:image/webp;base64,AAAA"; },
});

const ok = await runHandler(handler, selection);
assert.equal(ok.status, 200, `Expected a generated preview, got ${ok.status}: ${JSON.stringify(ok.payload)}`);
assert.equal(ok.payload.ok, true);
assert.equal(ok.payload.imageUrl, "data:image/webp;base64,AAAA");
assert.equal(ok.payload.colourName, resolved.colour.officialName);
assert.equal(editedPrompts.length, 1, "The image edit must run once for a fresh selection");
console.log(`PASS the colour preview generates for ${resolved.profile} in ${resolved.colour.officialName}.`);

// A repeat request is served from cache rather than paying for a second edit.
const cached = await runHandler(handler, selection);
assert.equal(cached.status, 200);
assert.equal(cached.payload.cached, true, "A repeat selection must be served from cache");
assert.equal(editedPrompts.length, 1, "A cached preview must not trigger another image edit");
console.log("PASS a repeated selection is served from cache without a second edit.");

// Validation still rejects a colour that the profile does not offer.
const bad = await runHandler(handler, { ...selection, colourId: "not-a-real-colour" });
assert.equal(bad.status, 400);
assert.equal(bad.payload.code, "invalid_colour");
console.log("PASS an invalid colour is rejected with a specific reason.");

// Without a key the endpoint reports unavailability instead of a generic failure.
const noKey = createGaragePreviewHandler({
  env: { NODE_ENV: "development" },
  authenticateRequest: async () => "test-user",
  editImage: async () => { throw new Error("must not be called"); },
});
const unavailable = await runHandler(noKey, selection);
assert.equal(unavailable.status, 503);
assert.equal(unavailable.payload.code, "preview_unavailable");
console.log("PASS a missing API key reports preview_unavailable, not a generic failure.");
