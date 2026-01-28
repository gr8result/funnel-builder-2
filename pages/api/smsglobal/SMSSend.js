// /pages/api/smsglobal/SMSSend.js
// FULL REPLACEMENT
//
// ✅ Sends a single SMS immediately via SMSGlobal/Kudosity (TransmitSMS API)
// ✅ Supports { lead_id, message } OR { to, message }
// ✅ Auth: Authorization: Bearer <supabase_access_token>
// ✅ Multi-tenant safe (lead must belong to logged-in user)
// ✅ Uses SMSGLOBAL_API_KEY + SMSGLOBAL_API_SECRET (Basic Auth)
// ✅ Optional origin/sender: DEFAULT_SMS_ORIGIN (if supported by your account)
//
// ENV required:
//   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
//   NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)
//   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
//   SMSGLOBAL_API_KEY
//   SMSGLOBAL_API_SECRET
// Optional:
//   DEFAULT_SMS_ORIGIN
//
// Notes:
// - API docs show: POST https://api.transmitsms.com/send-sms.json with Basic Auth.
// - Body is x-www-form-urlencoded.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SMSGLOBAL_API_KEY = process.env.SMSGLOBAL_API_KEY;
const SMSGLOBAL_API_SECRET = process.env.SMSGLOBAL_API_SECRET;
const DEFAULT_SMS_ORIGIN = process.env.DEFAULT_SMS_ORIGIN || "";

function s(v) {
  return String(v ?? "").trim();
}

function digitsOnly(v) {
  return s(v).replace(/[^\d+]/g, "");
}

function normalizePhoneForSend(raw) {
  const t = s(raw);
  if (!t) return "";
  
  // Strip everything but digits and +
  let v = t.replace(/[^\d+]/g, "");
  if (!v) return "";
  
  // Strip leading + if present
  if (v.startsWith("+")) v = v.slice(1);
  
  // Convert 0XXXXXXXXX to 61XXXXXXXXX (AU)
  if (v.startsWith("0") && v.length >= 9) v = "61" + v.slice(1);
  
  // Ensure it starts with 61 for AU numbers without explicit country code
  if (!v.startsWith("61") && /^\d{9,}$/.test(v)) v = "61" + v;
  
  // SMSGlobal v2 API expects format without + (e.g., 61417004315)
  return v;
}

function pickLeadPhone(leadRow) {
  if (!leadRow || typeof leadRow !== "object") return "";

  const candidates = [
    leadRow.to_phone,
    leadRow.phone,
    leadRow.mobile,
    leadRow.mobile_phone,
    leadRow.phone_number,
    leadRow.cell,
    leadRow.cell_phone,
    leadRow.sms,
    leadRow.sms_phone,
    leadRow.contact_number,
    leadRow.contact_phone,
    leadRow.primary_phone,
    leadRow.tel,
    leadRow.telephone,
  ];

  for (const c of candidates) {
    const v = s(c);
    if (v) return v;
  }
  return "";
}

function isOwnedByUser(lead, userId) {
  if (!lead || typeof lead !== "object") return false;

  const checks = [
    lead.user_id,
    lead.owner_id,
    lead.created_by,
    lead.profile_id,
    lead.account_user_id,
  ].map((x) => s(x));

  for (const v of checks) {
    if (v && v === s(userId)) return true;
  }

  const hasAnyOwnershipField = checks.some((v) => v.length > 0);
  if (!hasAnyOwnershipField) return false;

  return false;
}

async function sendViaSmsGlobal({ to, message }) {
  if (!SMSGLOBAL_API_KEY || !SMSGLOBAL_API_SECRET) {
    const e = new Error("Missing SMSGlobal credentials in env.");
    e.code = "MISSING_SMSGLOBAL_ENV";
    throw e;
  }

  const url = "https://api.smsglobal.com/v2/sms/";

  // Generate MAC authentication header (SMSGlobal OAuth 2 MAC scheme)
  const crypto = require("crypto");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(8).toString("hex");
  
  // Build the signature base string for MAC
  const baseString = [timestamp, nonce, "POST", "/v2/sms/", "api.smsglobal.com", "443"].join("\n");
  const mac = crypto.createHmac("sha1", SMSGLOBAL_API_SECRET).update(baseString).digest("base64");
  
  const authHeader = `MAC id="${SMSGLOBAL_API_KEY}", ts="${timestamp}", nonce="${nonce}", mac="${mac}"`;

  const payload = {
    origin: DEFAULT_SMS_ORIGIN || "",
    destination: to,
    message,
  };

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await r.text();
  let j = {};
  try {
    j = JSON.parse(text);
  } catch {
    // keep as {}
  }

  if (!r.ok) {
    const err = new Error("SMSGlobal request failed");
    err.smsglobal_http = { status: r.status, body: text };
    throw err;
  }

  // Many responses include:
  // { message_id, error: { code, description } }
  if (j?.error && j.error.code && j.error.code !== "SUCCESS") {
    const err = new Error(j?.error?.description || "SMSGlobal error");
    err.smsglobal = j;
    throw err;
  }

  return j;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env vars" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Authorization header is empty or format is incorrect.",
      });
    }

    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const supaAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await supaUser.auth.getUser();
    const user_id = userData?.user?.id;

    if (userErr || !user_id) {
      return res.status(401).json({ ok: false, error: "Invalid session." });
    }

    const body = req.body || {};
    const message = s(body.message);
    const lead_id = s(body.lead_id);
    let to = s(body.to);

    if (!message) {
      return res.status(400).json({ ok: false, error: "Missing message" });
    }

    if (!lead_id && !to) {
      return res.status(400).json({ ok: false, error: "Provide lead_id or to" });
    }

    // If lead_id provided, load phone for that lead (must belong to user)
    if (lead_id) {
      const { data: lead, error: leadErr } = await supaAdmin
        .from("leads")
        .select("*")
        .eq("id", lead_id)
        .maybeSingle();

      if (leadErr) {
        return res.status(500).json({ ok: false, error: "Failed to load lead", detail: leadErr.message });
      }
      if (!lead || !isOwnedByUser(lead, user_id)) {
        return res.status(404).json({ ok: false, error: "Lead not found" });
      }

      const ph = pickLeadPhone(lead);

      if (!ph) {
        return res.status(400).json({ ok: false, error: "Lead has no phone number" });
      }

      to = ph;
    }

    to = normalizePhoneForSend(to);
    if (!to) {
      return res.status(400).json({ ok: false, error: "Invalid phone number" });
    }

    const resp = await sendViaSmsGlobal({ to, message });

    return res.status(200).json({
      ok: true,
      provider: "smsglobal",
      provider_id: resp?.message_id ?? null,
      response: resp,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Server error",
      detail:
        e?.smsglobal_http ||
        e?.smsglobal ||
        (e?.smsglobal_http?.body
          ? { raw: e.smsglobal_http.body, status: e.smsglobal_http.status }
          : null) ||
        e?.code ||
        null,
    });
  }
}
