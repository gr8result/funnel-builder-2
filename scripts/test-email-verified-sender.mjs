import assert from "node:assert/strict";
import { resolveVerifiedSender } from "../lib/email/verifiedSender.js";

assert.equal(resolveVerifiedSender({}, "sender@example.com").ok, false);
assert.equal(resolveVerifiedSender({ dkim_verified: true }, "sender@example.com").ok, false);
assert.equal(resolveVerifiedSender({ dkim_verified: true, dkim_domain: "example.com" }, "sender@other.com").ok, false);
assert.deepEqual(
  resolveVerifiedSender({ dkim_verified: true, dkim_domain: "example.com", sendgrid_from_email: "sales@example.com" }),
  { ok: true, email: "sales@example.com", domain: "example.com" },
);

console.log("Verified sender checks passed");