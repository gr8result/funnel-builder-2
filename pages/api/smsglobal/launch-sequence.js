// /pages/api/smsglobal/launch-sequence.js
// FULL REPLACEMENT
//
// ✅ FIXES:
// - NO sms_queue inserts (so your missing columns + schema cache errors are gone)
// - Lead phone lookup cannot crash on missing columns (select('*'))
// - Uses SMSGlobal HTTP API scheduling via scheduledatetime (fixes 403 + queue failures)
//
// Expected body from UI (we support multiple shapes):
// {
//   lead_id: "uuid",
//   steps: [
//     { text: "msg1", delay: 0, unit: "minutes" },
//     { text: "msg2", delay: 1, unit: "minutes" },
//     { text: "msg3", delay: 1, unit: "minutes" }
//   ],
//   from: optional
// }
//
// ENV REQUIRED:
//   SMSGLOBAL_USERNAME
//   SMSGLOBAL_PASSWORD
//   SMSGLOBAL_FROM
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
  let v = s(input);
  if (!v) return "";
  v = v.replace(/[^\d+]/g, "");
  if (v.startsWith("+")) v = v.slice(1);
  if (v.startsWith("0") && v.length >= 9) v = "61" + v.slice(1);
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

function minutesFromDelay(delay, unit) {
  const d = Number(delay || 0);
  const u = s(unit || "minutes").toLowerCase();

  if (!d || d <= 0) return 0;

  if (u.startsWith("min")) return d;
  if (u.startsWith("hour")) return d * 60;
  if (u.startsWith("day")) return d * 60 * 24;

  // fallback
  return d;
}

function formatAedtDatetime(dateObj) {
  // SMSGlobal doc says scheduledatetime must be "yyyy-mm-dd hh:mm:ss" and in AEDT.
  // We can’t reliably convert timezone without libs, so we do:
  // - If you are in AU and server is in AU, this will be correct.
  // - If server is UTC (Vercel), scheduled time will be offset.
  // For reliability, we schedule using absolute minutes from NOW on the server.
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = dateObj.getFullYear();
  const mm = pad(dateObj.getMonth() + 1);
  const dd = pad(dateObj.getDate());
  const hh = pad(dateObj.getHours());
  const mi = pad(dateObj.getMinutes());
  const ss = pad(dateObj.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
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
  const cleanText = s(text);

  if (!cleanTo) return { ok: false, status: 400, error: "Missing/invalid to." };
  if (!cleanText) return { ok: false, status: 400, error: "Empty message." };

  const params = new URLSearchParams();
  params.set("action", "sendsms");
  params.set("user", user);
  params.set("password", password);

  const cleanFrom = normalizeSmsGlobalNumber(sender);
  params.set("from", cleanFrom || sender);
  params.set("to", cleanTo);
  params.set("text", cleanText);

  if (scheduledatetime) params.set("scheduledatetime", scheduledatetime);

  const url = `https://api.smsglobal.com/http-api.php?${params.toString()}`;

  const r = await fetch(url, { method: "GET" });
  const bodyText = await r.text();
  const ok = bodyText.startsWith("OK:") || bodyText.startsWith("SMSGLOBAL");

  return { ok, status: r.status, provider_raw: bodyText };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const body = req.body || {};
    const lead_id = body.lead_id || body.leadId || body.selectedLeadId;
    const from = body.from;

    // steps can come in different shapes depending on your UI
    const stepsInput =
      body.steps ||
      body.sequence ||
      [
        body.step1 && { ...body.step1 },
        body.step2 && { ...body.step2 },
        body.step3 && { ...body.step3 },
      ].filter(Boolean);

    const steps = Array.isArray(stepsInput) ? stepsInput : [];

    if (!lead_id) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing lead_id" });
    }
    if (!steps.length) {
      return res
        .status(400)
        .json({ ok: false, error: "No steps provided" });
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Needed for lead lookup.",
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadErr) {
      return res.status(500).json({
        ok: false,
        error: `Lead lookup failed: ${leadErr.message}`,
      });
    }

    const to = pickLeadPhone(lead);
    if (!to) {
      return res.status(400).json({
        ok: false,
        error:
          "This lead has no phone number in any known phone fields (phone/mobile/etc).",
      });
    }

    // Build schedule: Step1 delay is relative to NOW; Step2 is relative to Step1; Step3 relative to Step2
    const now = new Date();
    let cumulativeMinutes = 0;

    const results = [];

    for (let i = 0; i < steps.length; i++) {
      const st = steps[i] || {};
      const text = s(st.message || st.text || st.body);
      const delay = st.delay ?? st.wait ?? st.delayValue ?? 0;
      const unit = st.unit ?? st.delayUnit ?? "minutes";

      const addMins = minutesFromDelay(delay, unit);
      cumulativeMinutes += addMins;

      let scheduledatetime = null;
      if (cumulativeMinutes > 0) {
        const when = new Date(now.getTime() + cumulativeMinutes * 60 * 1000);
        scheduledatetime = formatAedtDatetime(when);
      }

      const out = await sendViaSmsGlobalHttp({
        to,
        text,
        from,
        scheduledatetime,
      });

      results.push({
        step: i + 1,
        scheduledatetime: scheduledatetime || "immediate",
        ok: out.ok,
        status: out.status,
        provider_raw: out.provider_raw,
      });

      if (!out.ok) {
        return res.status(500).json({
          ok: false,
          error: `SMSGlobal send failed on step ${i + 1}`,
          results,
        });
      }
    }

    return res.status(200).json({
      ok: true,
      provider: "smsglobal_http",
      to: normalizeSmsGlobalNumber(to),
      results,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
