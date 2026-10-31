import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateSmsGlobalWebhook,
  isSmsOptOutKeyword,
  makeSmsWebhookEventHash,
  normalizeAustralianPhone,
  normalizeSmsDeliveryStatus,
} from "../lib/smsglobal/webhookSecurity.mjs";

const secret = "test-only-shared-secret-1234567890";

test("webhook authentication fails closed without a configured secret", () => {
  assert.deepEqual(authenticateSmsGlobalWebhook({ headers: {}, query: {} }, {}), { configured: false, authorized: false });
  assert.equal(authenticateSmsGlobalWebhook({ headers: {}, query: {} }, { SMSGLOBAL_WEBHOOK_SECRET: secret }).authorized, false);
});

test("webhook accepts constant-time shared secret from the configured header or bearer token", () => {
  const env = { SMSGLOBAL_WEBHOOK_SECRET: secret };
  assert.equal(authenticateSmsGlobalWebhook({ headers: { "x-smsglobal-webhook-secret": secret }, query: {} }, env).authorized, true);
  assert.equal(authenticateSmsGlobalWebhook({ headers: { authorization: `Bearer ${secret}` }, query: {} }, env).authorized, true);
  assert.equal(authenticateSmsGlobalWebhook({ headers: {}, query: { webhook_token: secret } }, env).authorized, false);
  assert.equal(authenticateSmsGlobalWebhook({ headers: {}, query: { webhook_token: secret } }, { ...env, SMSGLOBAL_WEBHOOK_QUERY_TOKEN_ENABLED: "true" }).authorized, true);
});

test("Australian phone formats normalize consistently", () => {
  assert.equal(normalizeAustralianPhone("0412 345 678"), "61412345678");
  assert.equal(normalizeAustralianPhone("+61 (0) 412-345-678"), "61412345678");
});

test("only explicit opt-out keywords are acted on", () => {
  for (const word of ["STOP", "unsubscribe", "Cancel", "END", "QUIT."]) assert.equal(isSmsOptOutKeyword(word), true);
  for (const word of ["Please stop calling", "STOP NOW", "hello", ""]) assert.equal(isSmsOptOutKeyword(word), false);
});

test("delivery status mapping and receipt hashing are deterministic", () => {
  assert.equal(normalizeSmsDeliveryStatus("Delivery Success"), "delivered");
  assert.equal(normalizeSmsDeliveryStatus("undelivered"), "failed");
  assert.equal(normalizeSmsDeliveryStatus("pending"), "sent");
  assert.equal(normalizeSmsDeliveryStatus("unexpected"), null);
  const one = makeSmsWebhookEventHash({ kind: "dlr", providerId: "p1", status: "delivered", timestamp: "t1" });
  const two = makeSmsWebhookEventHash({ kind: "dlr", providerId: "p1", status: "delivered", timestamp: "t1" });
  assert.equal(one, two);
  assert.notEqual(one, makeSmsWebhookEventHash({ kind: "dlr", providerId: "p1", status: "failed", timestamp: "t1" }));
});
