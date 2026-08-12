import {
  loadLocalFreedomNotifications,
  recordLocalFreedomNotification,
  updateLocalFreedomNotification,
} from "./localPaperStore.js";

const SMS_ALERT_TYPES = new Set([
  "REVIEW_NOW",
  "TRADE_READY",
  "ENTRY_CONDITION_REACHED",
  "SAFETY_EXIT",
  "TAKE_SOME_PROFIT",
  "FINAL_EXIT",
  "CANCEL_SETUP",
]);

function cleanPhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function smsConfigured(settings = {}) {
  return Boolean(settings.smsEnabled && cleanPhone(settings.mobile) && process.env.FREEDOM_SMS_BEARER_TOKEN);
}

export function maskMobile(value) {
  const digits = cleanPhone(value);
  if (!digits) return "";
  return `${"*".repeat(Math.max(0, digits.length - 3))}${digits.slice(-3)}`;
}

export function buildFreedomSMS(input = {}) {
  const symbol = String(input.symbol || "").toUpperCase();
  const price = input.currentPrice ? `\nPrice: ${input.currency || "US$"}${input.currentPrice}` : "";
  if (input.alertType === "TRADE_READY") {
    return `FREEDOM - TRADE READY\n\n${symbol}\n\nEntry: ${input.entry}\nSafety Exit: ${input.safetyExit}\nTarget: ${input.target}\n\nOpen Freedom before entering the order in CMC.`;
  }
  if (["SAFETY_EXIT", "TAKE_SOME_PROFIT", "FINAL_EXIT"].includes(input.alertType)) {
    return `FREEDOM - ACTION REQUIRED\n\n${symbol} reached your ${String(input.alertType).replace(/_/g, " ")} condition.${price}\n\nReview CMC now.`;
  }
  return `FREEDOM ALERT - ${symbol}\n\n${input.message || "Unusual buying activity detected."}\nCapital Flow: ${input.capitalFlowScore ?? "--"}/100${price}\n\nStatus: ${String(input.triggerState || input.alertType || "REVIEW NOW").replace(/_/g, " ")}\n\nOpen Freedom for the current analysis.`;
}

export async function sendSMSViaExistingProvider({ to, message, fetchImpl = globalThis.fetch } = {}) {
  if (!process.env.FREEDOM_SMS_BEARER_TOKEN) {
    return { ok: false, error: "Freedom SMS bearer token is not configured." };
  }
  if (!process.env.NEXT_PUBLIC_SITE_URL && !process.env.SITE_URL) {
    return { ok: false, error: "Site URL is not configured for SMSGlobal reuse." };
  }
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  const response = await fetchImpl(`${baseUrl}/api/smsglobal/SMSSend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.FREEDOM_SMS_BEARER_TOKEN}`,
    },
    body: JSON.stringify({ to, message }),
  });
  const data = await response.json().catch(() => null);
  return response.ok && data?.ok ? { ok: true, provider: "SMSGlobal", data } : { ok: false, error: data?.error || "SMSGlobal send failed.", data };
}

export async function sendFreedomNotification(input = {}, options = {}) {
  const snapshot = await loadLocalFreedomNotifications();
  const settings = { ...(snapshot.settings || {}), ...(options.settings || {}) };
  const wantsSMS = Boolean(input.sms || SMS_ALERT_TYPES.has(input.alertType));
  const smsBody = input.smsBody || buildFreedomSMS(input);
  const stored = await recordLocalFreedomNotification({
    ...input,
    channel: wantsSMS ? "in-app+sms" : "in-app",
    smsBody: wantsSMS ? smsBody : null,
    smsStatus: wantsSMS ? "pending" : null,
  });
  if (stored.duplicate) return { ok: true, duplicate: true, notification: stored.notification, sms: null };
  if (!wantsSMS) return { ok: true, duplicate: false, notification: stored.notification, sms: null };
  if (!smsConfigured(settings)) {
    const updated = await updateLocalFreedomNotification(stored.notification.id, {
      smsStatus: "blocked",
      smsError: "SMS settings or Freedom SMS session token are not configured.",
      status: "visible",
    });
    return { ok: false, duplicate: false, notification: updated, sms: { ok: false, blocked: true, error: updated.smsError } };
  }
  const sms = await sendSMSViaExistingProvider({ to: settings.mobile, message: smsBody, fetchImpl: options.fetchImpl });
  const updated = await updateLocalFreedomNotification(stored.notification.id, {
    smsStatus: sms.ok ? "sent" : "failed",
    smsError: sms.ok ? null : sms.error,
    status: "visible",
  });
  return { ok: sms.ok, duplicate: false, notification: updated, sms };
}

export async function sendFreedomTestSMS(options = {}) {
  return sendFreedomNotification({
    symbol: "TEST",
    alertType: "TEST_SMS",
    triggerState: "TEST",
    sms: true,
    message: "Freedom Trader test alert. SMS notifications are working.",
    smsBody: "Freedom Trader test alert.\nSMS notifications are working.",
    force: true,
  }, options);
}
