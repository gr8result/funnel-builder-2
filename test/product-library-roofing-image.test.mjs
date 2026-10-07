import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAMILY_IMAGE_FALLBACKS,
  GENERIC_IMAGE_URLS,
  resolveProductLibraryImage,
} from "../lib/product-library/catalogueModel.js";

test("roofing family resolves a valid roofing-specific image", () => {
  const resolved = resolveProductLibraryImage({ familyKey: "roofing" });

  assert.equal(resolved, GENERIC_IMAGE_URLS.roofing);
  assert.equal(resolved, FAMILY_IMAGE_FALLBACKS.roofing);
  assert.match(resolved, /^\/images\/product-library\/colorbond-roofing-freshwater\.jpg$/);
  assert.notEqual(resolved, "");
  assert.notEqual(resolved, GENERIC_IMAGE_URLS.cladding);
  assert.notEqual(resolved, FAMILY_IMAGE_FALLBACKS.cladding);
  assert.doesNotMatch(resolved, /55162|cladding|wall/i);
});
