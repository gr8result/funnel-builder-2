import { randomUUID } from "node:crypto";

const PERMISSION_EVENTS = new Set(["granted", "withdrawn", "unsubscribed"]);
const OPT_OUT_EVENTS = new Set(["withdrawn", "unsubscribed"]);
const VERIFIED_OPT_IN_SOURCE = /^provider:.*optin$/;

export function isProductionDeliveryEnabled(env = process.env) {
  if (env.EMAIL_BROADCAST_SCHEDULER_ENABLED !== "true") return false;
  if (env.NODE_ENV === "production") {
    return env.EMAIL_BROADCAST_PRODUCTION_APPROVED === "true"
      && env.EMAIL_BROADCAST_PROVIDER_MODE === "sendgrid_live";
  }
  return env.EMAIL_BROADCAST_PROVIDER_MODE === "mock";
}

const eventTime = (event) => Date.parse(event.occurred_at || event.recorded_at);

// Mirrors public.marketing_permission_granted in the migration draft: the latest email event must be a grant with
// a lawful basis, and after any opt-out only a provider-verified opt-in (e.g. recipient replied START) restores it.
export function hasEmailMarketingPermission(consentEvents = []) {
  const events = consentEvents
    .filter((event) => event.channel === "email" && PERMISSION_EVENTS.has(event.event_type))
    .sort((a, b) => (eventTime(b) - eventTime(a))
      || (Date.parse(b.recorded_at || 0) - Date.parse(a.recorded_at || 0))
      || String(b.id || "").localeCompare(String(a.id || "")));
  const latest = events[0];
  if (!latest || latest.event_type !== "granted" || !String(latest.lawful_basis || "").trim()) return false;
  const optOutTimes = events.filter((event) => OPT_OUT_EVENTS.has(event.event_type)).map(eventTime);
  if (!optOutTimes.length) return true;
  const lastOptOut = Math.max(...optOutTimes);
  return events.some((event) => event.event_type === "granted"
    && VERIFIED_OPT_IN_SOURCE.test(String(event.source || ""))
    && eventTime(event) > lastOptOut);
}

export function hasCurrentEmailPermission({ contact, membership, consentEvents = [], suppressed = false }) {
  if (!contact?.id || !contact.email || contact.is_demo || suppressed) return false;
  if (!membership || membership.status !== "active" || membership.purpose !== "marketing") return false;
  if (!String(membership.lawful_basis || "").trim()) return false;
  return hasEmailMarketingPermission(consentEvents);
}

function isDue(delivery, nowMs) {
  const scheduledAt = Date.parse(delivery?.scheduled_at || "");
  return Number.isFinite(scheduledAt) && scheduledAt <= nowMs;
}

function failureState(error) {
  return error?.definitiveNoSend === true ? "failed" : "unknown";
}

export async function processDueBroadcastDeliveries({
  repository,
  send,
  now = () => new Date(),
  createClaimToken = () => randomUUID(),
  limit = 20,
  env = process.env,
}) {
  const disabled = { enabled: false, considered: 0, claimed: 0, sent: 0, suppressed: 0, failed: 0, unknown: 0, skipped: 0 };
  if (!isProductionDeliveryEnabled(env)) return disabled;
  await repository.expireStaleClaims?.();

  const currentTime = now();
  const nowMs = currentTime.getTime();
  const candidates = await repository.listDueDeliveries({ now: currentTime.toISOString(), limit });
  const result = { enabled: true, considered: candidates.length, claimed: 0, sent: 0, suppressed: 0, failed: 0, unknown: 0, skipped: 0 };

  for (const candidate of candidates) {
    if (!isDue(candidate, nowMs) || candidate.status !== "pending") {
      result.skipped += 1;
      continue;
    }

    const claimToken = createClaimToken();
    const delivery = await repository.claimDelivery({ deliveryId: candidate.id, claimToken, now: currentTime.toISOString() });
    if (!delivery) {
      result.skipped += 1;
      continue;
    }
    result.claimed += 1;

    let attemptId = null;
    try {
      const broadcast = await repository.getScheduledBroadcast({ workspaceId: delivery.workspace_id, broadcastId: delivery.broadcast_id });
      if (!broadcast || broadcast.status !== "scheduled") {
        await repository.finishDelivery({ delivery, claimToken, status: "cancelled", attemptId, finishedAt: now().toISOString() });
        result.skipped += 1;
        continue;
      }

      const current = await repository.getCurrentRecipientState({
        workspaceId: delivery.workspace_id,
        contactId: delivery.contact_id,
        listTable: broadcast.audience_list_table,
        listId: broadcast.list_id,
      });
      if (!current || !hasCurrentEmailPermission(current)) {
        await repository.finishDelivery({
          delivery,
          claimToken,
          status: "suppressed",
          attemptId,
          finishedAt: now().toISOString(),
          error: "Current membership or email consent is absent, withdrawn, or suppressed.",
        });
        result.suppressed += 1;
        continue;
      }

      attemptId = await repository.startAttempt({ delivery, broadcast, contact: current.contact, claimToken, startedAt: currentTime.toISOString() });
      const response = await send({ broadcast, contact: current.contact, delivery });
      await repository.finishDelivery({
        delivery,
        claimToken,
        status: "sent",
        attemptId,
        finishedAt: now().toISOString(),
        providerMessageId: response?.providerMessageId || null,
      });
      result.sent += 1;
    } catch (error) {
      const status = failureState(error);
      await repository.finishDelivery({
        delivery,
        claimToken,
        status,
        attemptId,
        finishedAt: now().toISOString(),
        error: String(error?.message || "Delivery outcome unknown").slice(0, 1000),
      });
      result[status] += 1;
    }
  }

  if (repository.finalizeBroadcast) {
    const broadcasts = new Map();
    for (const delivery of candidates) {
      const key = `${delivery.workspace_id}:${delivery.broadcast_id}`;
      broadcasts.set(key, { workspaceId: delivery.workspace_id, broadcastId: delivery.broadcast_id });
    }
    for (const broadcast of broadcasts.values()) {
      await repository.finalizeBroadcast(broadcast);
    }
  }

  return result;
}
