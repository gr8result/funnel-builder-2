import assert from "node:assert/strict";
import { hasEmailMarketingConsent, hasSmsMarketingConsent, parseMarketingConsent } from "../lib/marketingConsent.js";

assert.equal(parseMarketingConsent("Subscribed"), true);
assert.equal(parseMarketingConsent("yes"), true);
assert.equal(parseMarketingConsent("unsubscribed"), false);
assert.equal(parseMarketingConsent("active"), false);
assert.equal(parseMarketingConsent("unknown"), false);
assert.equal(hasEmailMarketingConsent({ email_marketing_consent: true }), true);
assert.equal(hasEmailMarketingConsent({ email_marketing_consent: true, email_marketing_opt_out: true }), false);
assert.equal(hasSmsMarketingConsent({ sms_marketing_consent: true }), true);
assert.equal(hasSmsMarketingConsent({ sms_marketing_consent: true, sms_opt_out: true }), false);
assert.equal(hasSmsMarketingConsent({ sms_marketing_consent: true, opted_out: true }), false);

console.log("Marketing consent checks passed");