// /pages/api/telephony/make-call.js
// FULL REPLACEMENT
// POST { to, lead_id?, record? }
// ✅ Calls YOU first then bridges to target
// ✅ Recording enabled
// ✅ Status/recording callbacks log into BOTH lead_notes + leads.notes via /api/twilio/status-callback

import twilio from "twilio";

function normalizePhone(raw) {
  let v = String(raw || "").trim();
  if (!v) return "";
  v = v.replace(/[^\d+]/g, "");
  if (!v.startsWith("+") && v.startsWith("61")) v = "+" + v;
  if (!v.startsWith("+") && v.startsWith("0") && v.length >= 9) v = "+61" + v.slice(1);
  return v;
}

function getBaseUrl(req) {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const proto =
    (req.headers["x-forwarded-proto"] || "").toString().split(",")[0].trim() ||
    (req.connection && req.connection.encrypted ? "https" : "http");

  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  try {
    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_AGENT_PHONE = process.env.TWILIO_AGENT_PHONE;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "Missing Twilio env vars. Need TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
      });
    }
    if (!TWILIO_AGENT_PHONE || !String(TWILIO_AGENT_PHONE).startsWith("+")) {
      return res.status(500).json({
        ok: false,
        error: "Missing/invalid TWILIO_AGENT_PHONE (+countrycode...).",
      });
    }

    const { to, lead_id = null, record = true } = req.body || {};
    const toNum = normalizePhone(to);

    if (!toNum) return res.status(400).json({ ok: false, error: "to required" });
    if (!toNum.startsWith("+")) return res.status(400).json({ ok: false, error: "Phone must include +countrycode" });

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    const baseUrl = getBaseUrl(req);
    const statusCallback = `${baseUrl}/api/twilio/status-callback?lead_id=${encodeURIComponent(
      lead_id || ""
    )}&to=${encodeURIComponent(toNum)}`;

    const twiml = new twilio.twiml.VoiceResponse();
    const dial = twiml.dial({
      callerId: TWILIO_AGENT_PHONE,
      record: record ? "record-from-answer" : undefined,
      recordingStatusCallback: `${baseUrl}/api/twilio/status-callback?lead_id=${encodeURIComponent(
        lead_id || ""
      )}&to=${encodeURIComponent(toNum)}&event=recording`,
      recordingStatusCallbackEvent: ["completed"],
    });
    dial.number(toNum);

    const call = await client.calls.create({
      twiml: twiml.toString(),
      to: TWILIO_AGENT_PHONE,
      from: TWILIO_AGENT_PHONE,
      statusCallback,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });

    return res.status(200).json({ ok: true, callSid: call.sid, to: toNum, lead_id: lead_id || null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
