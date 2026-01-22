// /pages/api/smsglobal/SMSGlobalSMSSend.js
// FULL REPLACEMENT
//
// ✅ FIXES:
// - Stops querying leads.phone_number directly (uses select('*') and picks a real phone field)
// - Uses SMSGlobal HTTP API (username/password) instead of REST (fixes 403)
// - Does NOT touch sms_queue table at all (avoids schema cache / missing columns issues)
//
// ENV REQUIRED (set in Vercel/local .env):
//   SMSGLOBAL_USERNAME=your_mxt_username
//   SMSGLOBAL_PASSWORD=your_mxt_password
//   SMSGLOBAL_FROM=614xxxxxxxx  (or your sender id; NO '+' per SMSGlobal HTTP API docs)
// Optional:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

function s(v) {
  return String(v ?? "").trim();
}

function normalizeSmsGlobalNumber(input) {
  // SMSGlobal HTTP API: "Do not use + before the country code"
  let v = s(input);
  if (!v) return "";
  v = v.replace(/[^\d+]/g, ""); // keep digits and +
  if (v.startsWith("+")) v = v.slice(1); // remove leading +
  // If it's AU local like 0417..., convert to 61417...
  if (v.startsWith("0") && v.length >= 9) {
    v = "61" + v.slice(1);
  }
  return v;
}

function pickLeadPhone(lead) {
  if (!lead || typeof lead !== "object") return "";
  const candidates = [
    lead.phone_number,
    lead.phone,
    lead.mobile,
    lead.mobile_phone,
    lead.mobileNumber,
    lead.phoneNumber,
    lead.cell,
    lead.cell_phone,
    lead.tel,
    lead.telephone,
  ]
    .map((x) => s(x))
    .filter(Boolean);

  return candidates[0] || "";
}

async function sendViaSmsGlobalHttp({ to, text, from, scheduledatetime }) {
  const user = s(process.env.SMSGLOBAL_USERNAME);
  const password = s(process.env.SMSGLOBAL_PASSWORD);
  const sender = s(from || process.env.SMSGLOBAL_FROM);

  if (!user || !password) {
    return {
      ok: false,
      status: 500,
      error:
        "Missing SMSGLOBAL_USERNAME or SMSGLOBAL_PASSWORD in env. Set them and retry.",
    };
  }

  if (!sender) {
    return {
      ok: false,
      status: 500,
      error:
        "Missing SMSGLOBAL_FROM in env. Set it to your sender ID (NO '+') and retry.",
    };
  }

  const cleanTo = normalizeSmsGlobalNumber(to);
  const cleanFrom = normalizeSmsGlobalNumber(sender);
  const cleanText = s(text);

  if (!cleanTo) {
    return { ok: false, status: 400, error: "Missing/invalid 'to' number." };
  }
  if (!cleanText) {
    return { ok: false, status: 400, error: "Missing/empty message text." };
  }

  const params = new URLSearchParams();
  params.set("action", "sendsms");
  params.set("user", user);
  params.set("password", password);
  params.set("from", cleanFrom || sender); // if it's alpha sender id, keep it
  params.set("to", cleanTo);
  params.set("text", cleanText);

  // Optional scheduling (format: yyyy-mm-dd hh:mm:ss, URL encoded)
  if (scheduledatetime) params.set("scheduledatetime", scheduledatetime);

  const url = `https://api.smsglobal.com/http-api.php?${params.toString()}`;

  const r = await fetch(url, { method: "GET" });
  const bodyText = await r.text();

  // SMSGlobal HTTP API returns 200 even on ERROR; body starts with "OK:" or "ERROR:"
  const ok = bodyText.startsWith("OK:") || bodyText.startsWith("SMSGLOBAL");
  return {
    ok,
    status: r.status,
    provider_raw: bodyText,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const {
      // supported inputs
      to,
      message,
      text,
      from,
      lead_id,
      scheduledatetime, // optional yyyy-mm-dd hh:mm:ss
    } = req.body || {};

    const msg = s(message || text);

    // If lead_id provided, fetch lead and resolve phone without hard-coded columns
    let finalTo = s(to);
    if (!finalTo && lead_id) {
      if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({
          ok: false,
          error:
            "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Needed for lead_id lookup.",
        });
      }
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false },
      });

      const { data: lead, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", lead_id)
        .single();

      if (error) {
        return res.status(500).json({
          ok: false,
          error: `Lead lookup failed: ${error.message}`,
        });
      }

      finalTo = pickLeadPhone(lead);
    }

    const out = await sendViaSmsGlobalHttp({
      to: finalTo,
      text: msg,
      from,
      scheduledatetime,
    });

    if (!out.ok) {
      return res.status(500).json({
        ok: false,
        error: out.error || "SMSGlobal send failed",
        status: out.status,
        provider_raw: out.provider_raw,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "smsglobal_http",
      status: out.status,
      provider_raw: out.provider_raw,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
}
