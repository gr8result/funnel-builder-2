// /pages/api/twilio/status-callback.js
// FULL REPLACEMENT
//
// ✅ Receives Twilio status callbacks (x-www-form-urlencoded OR JSON)
// ✅ Upserts into public.crm_calls using twilio_sid = CallSid (correct)
// ✅ Multi-tenant correctness:
//    - If lead_id is present, derives user_id + caller_name from leads table
//    - Also fills our_number/contact_number for easier filtering
//
// SECURITY (optional):
//   If you set TWILIO_WEBHOOK_SECRET, require ?key=...
//
// ENV REQUIRED:
//   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE / SUPABASE_SERVICE_KEY / SUPABASE_SERVICE)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE;

function s(v) {
  return String(v ?? "").trim();
}

function normDirection(dir) {
  const d = s(dir).toLowerCase();
  if (d.includes("outbound")) return "outbound";
  if (d.includes("inbound")) return "inbound";
  return d || "inbound";
}

function normalizePhone(raw) {
  let v = String(raw || "").trim();
  if (!v) return "";
  v = v.replace(/[^\d+]/g, "");
  if (!v.startsWith("+") && v.startsWith("61")) v = "+" + v;
  if (!v.startsWith("+") && v.startsWith("0") && v.length >= 9) v = "+61" + v.slice(1);
  return v;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");

  // JSON?
  try {
    return JSON.parse(raw);
  } catch {}

  // x-www-form-urlencoded
  const out = {};
  raw
    .split("&")
    .map((p) => p.split("="))
    .forEach(([k, v]) => {
      if (!k) return;
      out[decodeURIComponent(k)] = decodeURIComponent((v || "").replace(/\+/g, " "));
    });
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

    const secret = s(process.env.TWILIO_WEBHOOK_SECRET);
    const key = s(req.query.key);
    if (secret && key !== secret) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env" });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await readBody(req);

    const callSid = s(body.CallSid);
    if (!callSid) return res.status(400).json({ ok: false, error: "Missing CallSid" });

    const callStatus = s(body.CallStatus || body.CallStatusCallbackEvent || body.Status || body.CallStatusEvent);
    const direction = normDirection(body.Direction);

    const fromNumber = normalizePhone(body.From);
    const toNumber = normalizePhone(body.To);

    const duration = body.Duration != null && String(body.Duration).trim() !== "" ? Number(body.Duration) : null;

    const leadId = s(req.query.lead_id || body.lead_id || "");
    let userId = null;
    let callerName = null;

    if (leadId) {
      const { data: leadRow } = await supabase
        .from("leads")
        .select("id,user_id,name,first_name,last_name,full_name,phone,mobile")
        .eq("id", leadId)
        .maybeSingle();

      userId = leadRow?.user_id || null;
      callerName =
        s(leadRow?.name) ||
        s(leadRow?.full_name) ||
        s([leadRow?.first_name, leadRow?.last_name].filter(Boolean).join(" ")) ||
        null;
    }

    // our_number / contact_number helpers (based on direction)
    const our_number =
      direction === "outbound" ? fromNumber || null : toNumber || null;
    const contact_number =
      direction === "outbound" ? toNumber || null : fromNumber || null;

    const payload = {
      twilio_sid: callSid, // ✅ CRITICAL: this must be set
      lead_id: leadId || null,
      user_id: userId || null,
      direction,
      from_number: fromNumber || null,
      to_number: toNumber || null,
      status: callStatus || null,
      duration: Number.isFinite(duration) ? duration : null,
      caller_name: callerName,
      our_number,
      contact_number,
      raw_payload: body,
    };

    // ✅ Upsert by twilio_sid
    const { error } = await supabase
      .from("crm_calls")
      .upsert(payload, { onConflict: "twilio_sid" });

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("status-callback error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
