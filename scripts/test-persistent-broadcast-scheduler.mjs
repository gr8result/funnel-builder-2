import test from "node:test";
import assert from "node:assert/strict";
import { hasCurrentEmailPermission, isProductionDeliveryEnabled, processDueBroadcastDeliveries } from "../lib/email/persistentBroadcastScheduler.mjs";

function makeHarness({ scheduledAt = "2026-10-14T10:00:00.000Z", consent = true } = {}) {
  const state = {
    delivery: { id: "delivery-1", workspace_id: "workspace-1", broadcast_id: "broadcast-1", contact_id: "contact-1", scheduled_at: scheduledAt, status: "pending" },
    broadcast: { id: "broadcast-1", workspace_id: "workspace-1", status: "scheduled", audience_list_table: "lead_lists", list_id: "list-1" },
    contact: { id: "contact-1", email: "builder-test@example.invalid", is_demo: false },
    membership: { status: "active", purpose: "marketing", lawful_basis: "express consent" },
    events: consent ? [{ id: "event-1", channel: "email", event_type: "granted", lawful_basis: "express consent", occurred_at: "2026-10-14T09:00:00.000Z" }] : [],
    attempts: [],
    calls: 0,
  };
  const repository = {
    async listDueDeliveries({ now }) {
      const current = Date.parse(now);
      return state.delivery.status === "pending" && Date.parse(state.delivery.scheduled_at) <= current ? [{ ...state.delivery }] : [];
    },
    async claimDelivery({ claimToken, now }) {
      if (state.delivery.status !== "pending" || Date.parse(state.delivery.scheduled_at) > Date.parse(now)) return null;
      state.delivery.status = "sending";
      state.delivery.claim_token = claimToken;
      state.delivery.attempt_count = (state.delivery.attempt_count || 0) + 1;
      return { ...state.delivery };
    },
    async startAttempt({ delivery }) {
      state.attempts.push({ deliveryId: delivery.id, status: "sending" });
      return state.attempts.length;
    },
    async getScheduledBroadcast() { return state.broadcast; },
    async getCurrentRecipientState() {
      return { contact: state.contact, membership: state.membership, consentEvents: state.events };
    },
    async finishDelivery({ delivery, claimToken, status, attemptId, error }) {
      assert.equal(state.delivery.claim_token, claimToken);
      assert.equal(state.delivery.id, delivery.id);
      state.delivery.status = status;
      state.delivery.last_error = error || null;
      if (attemptId) state.attempts[attemptId - 1].status = status;
    },
  };
  return { repository, state };
}

const sendEnabled = { EMAIL_BROADCAST_SCHEDULER_ENABLED: "true", EMAIL_BROADCAST_PROVIDER_MODE: "mock", NODE_ENV: "test" };
const fixedNow = () => new Date("2026-10-14T10:00:00.000Z");

test("delivery remains disabled unless explicitly enabled; production requires a second approval gate", () => {
  assert.equal(isProductionDeliveryEnabled({ NODE_ENV: "test" }), false);
  assert.equal(isProductionDeliveryEnabled({ NODE_ENV: "production", EMAIL_BROADCAST_SCHEDULER_ENABLED: "true" }), false);
  assert.equal(isProductionDeliveryEnabled({ NODE_ENV: "production", EMAIL_BROADCAST_SCHEDULER_ENABLED: "true", EMAIL_BROADCAST_PRODUCTION_APPROVED: "true", EMAIL_BROADCAST_PROVIDER_MODE: "sendgrid_live" }), true);
});

test("permission requires active marketing membership, lawful basis and latest positive consent", () => {
  const contact = { id: "c1", email: "a@example.invalid" };
  const membership = { status: "active", purpose: "marketing", lawful_basis: "express consent" };
  assert.equal(hasCurrentEmailPermission({ contact, membership, consentEvents: [{ channel: "email", event_type: "granted", lawful_basis: "express consent", occurred_at: "2026-10-01" }] }), true);
  assert.equal(hasCurrentEmailPermission({ contact, membership, consentEvents: [{ channel: "email", event_type: "granted", occurred_at: "2026-10-01" }] }), false, "a grant without a lawful basis is not permission");
  assert.equal(hasCurrentEmailPermission({ contact, membership, suppressed: true, consentEvents: [{ channel: "email", event_type: "granted", lawful_basis: "express consent", occurred_at: "2026-10-01" }] }), false, "suppressed address");
  const optOutThenManualGrant = [
    { channel: "email", event_type: "unsubscribed", occurred_at: "2026-10-01" },
    { channel: "email", event_type: "granted", lawful_basis: "builder says ok", source: "crm-manual", occurred_at: "2026-10-02" },
  ];
  assert.equal(hasCurrentEmailPermission({ contact, membership, consentEvents: optOutThenManualGrant }), false, "a builder-entered grant cannot lift an unsubscribe");
  assert.equal(hasCurrentEmailPermission({ contact, membership, consentEvents: [...optOutThenManualGrant,
    { channel: "email", event_type: "granted", lawful_basis: "confirmed opt-in", source: "provider:email-confirmed-optin", occurred_at: "2026-10-03" }] }), true, "a provider-verified opt-in after the unsubscribe restores permission");
  assert.equal(hasCurrentEmailPermission({ contact, membership: { ...membership, lawful_basis: null }, consentEvents: [{ channel: "email", event_type: "granted", occurred_at: "2026-10-01" }] }), false);
  assert.equal(hasCurrentEmailPermission({ contact, membership, consentEvents: [{ channel: "email", event_type: "granted", occurred_at: "2026-10-01" }, { channel: "email", event_type: "unsubscribed", occurred_at: "2026-10-02" }] }), false);
  assert.equal(hasCurrentEmailPermission({ contact, membership, consentEvents: [
    { channel: "email", event_type: "granted", lawful_basis: "express consent", occurred_at: "2026-10-01" },
    { channel: "email", event_type: "unsubscribed", occurred_at: "2026-10-02" },
    { channel: "email", event_type: "lawful_basis_recorded", lawful_basis: "express consent", occurred_at: "2026-10-03" },
  ] }), false);
});

test("future delivery is not claimed before its scheduled time", async () => {
  const { repository, state } = makeHarness({ scheduledAt: "2026-10-14T10:01:00.000Z" });
  let sends = 0;
  const result = await processDueBroadcastDeliveries({ repository, send: async () => { sends += 1; }, now: fixedNow, env: sendEnabled });
  assert.equal(result.considered, 0);
  assert.equal(sends, 0);
  assert.equal(state.delivery.status, "pending");
});

test("mock or live sends are not reached when the scheduler is disabled", async () => {
  const { repository, state } = makeHarness();
  let sends = 0;
  const result = await processDueBroadcastDeliveries({ repository, send: async () => { sends += 1; }, now: fixedNow, env: { NODE_ENV: "test" } });
  assert.equal(result.enabled, false);
  assert.equal(sends, 0);
  assert.equal(state.delivery.status, "pending");
});

test("current consent is rechecked immediately before provider call", async () => {
  const { repository, state } = makeHarness({ consent: false });
  let sends = 0;
  const result = await processDueBroadcastDeliveries({ repository, send: async () => { sends += 1; }, now: fixedNow, env: sendEnabled });
  assert.equal(result.suppressed, 1);
  assert.equal(sends, 0);
  assert.equal(state.delivery.status, "suppressed");
});

test("atomic claim prevents two workers from sending the same row", async () => {
  const { repository, state } = makeHarness();
  let sends = 0;
  const run = () => processDueBroadcastDeliveries({ repository, send: async () => { sends += 1; return { providerMessageId: "sg-1" }; }, now: fixedNow, env: sendEnabled });
  const results = await Promise.all([run(), run()]);
  assert.equal(sends, 1);
  assert.equal(results.reduce((sum, item) => sum + item.sent, 0), 1);
  assert.equal(state.delivery.status, "sent");
});

test("ambiguous provider outcome is held as unknown and never auto-retried", async () => {
  const { repository, state } = makeHarness();
  let sends = 0;
  const send = async () => { sends += 1; throw new Error("socket closed after request"); };
  const first = await processDueBroadcastDeliveries({ repository, send, now: fixedNow, env: sendEnabled });
  const second = await processDueBroadcastDeliveries({ repository, send, now: fixedNow, env: sendEnabled });
  assert.equal(first.unknown, 1);
  assert.equal(second.considered, 0);
  assert.equal(sends, 1);
  assert.equal(state.delivery.status, "unknown");
});

test("expired in-flight lease is reconciled as unknown and never resent", async () => {
  const { repository, state } = makeHarness();
  state.delivery.status = "sending";
  state.delivery.claim_expires_at = "2026-10-14T09:59:00.000Z";
  repository.expireStaleClaims = async () => {
    if (state.delivery.status === "sending" && Date.parse(state.delivery.claim_expires_at) <= fixedNow().getTime()) {
      state.delivery.status = "unknown";
    }
  };
  let sends = 0;
  const result = await processDueBroadcastDeliveries({ repository, send: async () => { sends += 1; }, now: fixedNow, env: sendEnabled });
  assert.equal(result.considered, 0);
  assert.equal(state.delivery.status, "unknown");
  assert.equal(sends, 0);
});

test("cancelled broadcast is not sent", async () => {
  const { repository, state } = makeHarness();
  state.broadcast.status = "cancelled";
  let sends = 0;
  const result = await processDueBroadcastDeliveries({ repository, send: async () => { sends += 1; }, now: fixedNow, env: sendEnabled });
  assert.equal(result.skipped, 1);
  assert.equal(sends, 0);
  assert.equal(state.delivery.status, "cancelled");
});
