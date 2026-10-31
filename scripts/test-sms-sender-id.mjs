import assert from "node:assert/strict";
import { validateAustralianBrandedSenderId } from "../lib/smsSenderId.js";

assert.equal(validateAustralianBrandedSenderId("GR8Result").ok, true);
assert.equal(validateAustralianBrandedSenderId("A").ok, false);
assert.equal(validateAustralianBrandedSenderId("12345").ok, false);
assert.equal(validateAustralianBrandedSenderId("SenderNameTooLong").ok, false);
assert.equal(validateAustralianBrandedSenderId("Unverified").ok, false);
assert.equal(validateAustralianBrandedSenderId("_GR8").ok, false);
assert.equal(validateAustralianBrandedSenderId("GR8_").ok, false);
assert.equal(validateAustralianBrandedSenderId("Gr8 Result").ok, true);

console.log("Australian SMS sender ID checks passed");