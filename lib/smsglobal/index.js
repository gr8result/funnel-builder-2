// /lib/smsglobal/index.js
// FULL REPLACEMENT
//
// Simple shared helper for SMSGlobal sending.
// We are using ONE shared pool origin for all users (DEFAULT_SMS_ORIGIN).
//
// Env required:
// - SMSGLOBAL_API_KEY
// - SMSGLOBAL_API_SECRET
// - DEFAULT_SMS_ORIGIN (example: "gr8result" or "Gr8 Result")

import { buildSmsGlobalMacHeader } from "./macAuth";

function s(v) {
  return String(v ?? "").trim();
}

function sanitizeOrigin(origin) {
  const raw = s(origin);
  // Just trim whitespace - SMSGlobal validates the actual origin value
  // It must match an approved sender ID in the account
  // Keeping spaces/hyphens intact as they may be part of approved origins
  return raw.length > 0 && raw.length <= 50 ? raw : "";
}

function digitsOnly(v) {
  return s(v).replace(/[^\d+]/g, "");
}

// Convert AU numbers into SMSGlobal format like 614xxxxxxxx (no +)
export function normalizeAUTo61(raw) {
  let v = digitsOnly(raw);
  if (!v) return "";
  if (v.startsWith("+")) v = v.slice(1);
  if (v.startsWith("0")) v = "61" + v.slice(1);
  return v;
}

export async function sendSmsGlobal({
  toPhone,
  message,
  origin,
  sender_id,
  apiKey: apiKeyOverride,
  apiSecret: apiSecretOverride,
}) {
  try {
    const url = "https://api.smsglobal.com/v2/sms/";

    const apiKey = s(apiKeyOverride) || s(process.env.SMSGLOBAL_API_KEY);
    const secretKey = s(apiSecretOverride) || s(process.env.SMSGLOBAL_API_SECRET);
    
    console.log("🔍 sendSmsGlobal called:", {
      hasApiKeyOverride: !!apiKeyOverride,
      hasSecretOverride: !!apiSecretOverride,
      hasEnvApiKey: !!process.env.SMSGLOBAL_API_KEY,
      hasEnvSecret: !!process.env.SMSGLOBAL_API_SECRET,
      finalHasApiKey: !!apiKey,
      finalHasSecret: !!secretKey,
      sender_id,
      toPhone,
    });
    
    if (!apiKey || !secretKey) {
      console.error("❌ Missing SMSGlobal credentials");
      return {
        ok: false,
        http: 500,
        body: { error: "Missing SMSGlobal API credentials (SMSGLOBAL_API_KEY / SMSGLOBAL_API_SECRET)" },
        used_origin: null,
        destination: null,
      };
    }

    // The 'origin' field is the SMS sender ID (e.g., "gr8result")
    // The 'sender_id' is the subaccount ID (e.g., "3q5959hs") - used for API routing/billing
    // They are DIFFERENT and should not be confused
    
    // Use origin parameter (passed from SMSSend/launch-sequence with DEFAULT_SMS_ORIGIN fallback)
    // If not provided, try DEFAULT_SMS_ORIGIN
    let safeOrigin = sanitizeOrigin(origin) || sanitizeOrigin(process.env.DEFAULT_SMS_ORIGIN) || "gr8result";

    if (!safeOrigin) {
      safeOrigin = "gr8result";
    }

    const destination = normalizeAUTo61(toPhone);
    const messageBody = s(message);

    if (!destination) {
      console.error("❌ Missing/invalid to_phone:", toPhone);
      return {
        ok: false,
        http: 400,
        body: { error: "Missing/invalid to_phone" },
        used_origin: safeOrigin,
        destination: null,
      };
    }

    if (!messageBody) {
      console.error("❌ Missing message body");
      return {
        ok: false,
        http: 400,
        body: { error: "Missing body/message" },
        used_origin: safeOrigin,
        destination,
      };
    }

    const { header } = buildSmsGlobalMacHeader({
      apiKey,
      secretKey,
      method: "POST",
      url,
    });

    async function postSms(dest) {
      const payload = {
        destination: dest,
        message: messageBody,
      };

      if (safeOrigin) payload.origin = safeOrigin;

      console.log("📤 Sending SMS to SMSGlobal:", {
        url,
        payload,
        rawOriginInput: origin,
        rawSenderIdInput: sender_id,
        sanitizedOrigin: safeOrigin,
        destination: dest,
        envDefaultOrigin: process.env.DEFAULT_SMS_ORIGIN,
      });
      console.log("✅ SMS Sender/Origin:", safeOrigin);

      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: header,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const txt = await r.text();
      let parsed = null;
      try {
        parsed = JSON.parse(txt);
      } catch {}

      console.log("📥 SMSGlobal response:", {
        ok: r.ok,
        status: r.status,
        body: parsed || txt,
      });

      return { r, parsed, txt };
    }

    const first = await postSms(destination);
    let r = first.r;
    let parsed = first.parsed;
    let txt = first.txt;

    if (!r.ok) {
      const errorDetail = parsed?.errors?.origin?.[0] || parsed?.errors?.[0] || parsed?.error || txt;
      console.error("❌ SMSGlobal Error Detail:", errorDetail);

      if (errorDetail && String(errorDetail).toLowerCase().includes("origin") && origin) {
        console.error(`❌ Origin "${safeOrigin}" was rejected by SMSGlobal. This sender ID must be registered in your SMSGlobal account.`);
        return {
          ok: false,
          http: r.status,
          body: parsed || txt,
          used_origin: safeOrigin,
          destination,
          error: `Sender ID "${safeOrigin}" is not valid. Please register it in your SMSGlobal account settings.`,
        };
      }

      const looksLikeDestinationIssue = String(errorDetail || "").toLowerCase().includes("destination");
      if (looksLikeDestinationIssue && !String(destination).startsWith("+")) {
        const retryDest = `+${destination}`;
        console.log("🔁 Retrying with + prefixed destination:", retryDest);
        const retry = await postSms(retryDest);
        r = retry.r;
        parsed = retry.parsed;
        txt = retry.txt;
      }
    }

    return {
      ok: r.ok,
      http: r.status,
      body: parsed || txt,
      used_origin: safeOrigin,
      destination,
    };
  } catch (err) {
    console.error("❌ sendSmsGlobal error:", err?.message || err, err?.stack);
    return {
      ok: false,
      http: 500,
      body: { error: err?.message || "Failed to send SMS" },
      used_origin: null,
      destination: null,
    };
  }
}
