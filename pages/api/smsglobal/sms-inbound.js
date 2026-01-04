// /pages/api/smsglobal/sms-inbound.js
// FULL REPLACEMENT — inbound SMS handler for SMSGlobal
//
// What it does:
// ✅ Accepts inbound messages (JSON or x-www-form-urlencoded)
// ✅ Normalises AU numbers (+61 <-> 0xxxx)
// ✅ Finds lead by phone/mobile and appends to lead.notes
// ✅ Logs inbound message into sms_messages (best-effort)
// ✅ NO Twilio dependency
//
// Optional security:
// - Set env: SMSGLOBAL_INBOUND_SECRET
// - SMSGlobal should send header: x-smsglobal-secret: <secret>

import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: true, // SMSGlobal may send JSON; also fine for form-like payloads
  },
};

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const INBOUND_SECRET = process.env.SMSGLOBAL_INBOUND_SECRET || "";

function s(v) {
  return String(v ?? "").trim();
}

// AU normaliser:
// +614xxxxxxxx -> 04xxxxxxxx
// 614xxxxxxxx  -> 04xxxxxxxx
function normaliseAU(raw) {
  const v = s(raw);
  if (!v) return "";
  let x = v.replace(/[^\d+]/g, "");
  if (x.startsWith("+")) x = x.slice(1);
  if (x.startsWith("61") && x.length >= 11) return "0" + x.slice(2);
  if (x.startsWith("0")) return x;
  return x; // fallback
}

function getTimestamp() {
  return new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function admin() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    const e = new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    e.missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k]);
    throw e;
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// SMSGlobal inbound payloads vary by product/account.
// We accept common shapes:
// - { from, to, message }
// - { origin, destination, message }
// - { sender, recipient, text }
// - { msisdn, to, content }
function extractInbound(body) {
  const b = body || {};
  const from =
    b.from || b.origin || b.sender || b.msisdn || b.From || b.Sender || "";
  const to =
    b.to || b.destination || b.recipient || b.To || b.Recipient || "";
  const text =
    b.message || b.text || b.content || b.Body || b.Message || "";

  return { from: s(from), to: s(to), text: s(text) };
}

export default async function handler(req, res) {
  try {
    // Optional secret check (recommended)
    if (INBOUND_SECRET) {
      const got = s(req.headers["x-smsglobal-secret"]);
      if (!got || got !== INBOUND_SECRET) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    const sb = admin();

    const { from, to, text } = extractInbound(req.body);

    if (!from || !text) {
      return res.status(200).json({ ok: true, ignored: true, reason: "Missing from/text" });
    }

    const fromAU = normaliseAU(from);
    const fromRawDigits = s(from).replace(/[^\d]/g, "");
    const fromAUDigits = s(fromAU).replace(/[^\d]/g, "");

    // 1) Find lead by phone/mobile
    let lead = null;
    const { data: leadData } = await sb
      .from("leads")
      .select("*")
      .or(
        [
          `phone.eq.${fromAU}`,
          `phone.eq.${fromRawDigits}`,
          `phone.eq.${fromAUDigits}`,
          `mobile.eq.${fromAU}`,
          `mobile.eq.${fromRawDigits}`,
          `mobile.eq.${fromAUDigits}`,
        ].join(",")
      )
      .limit(1)
      .maybeSingle();

    if (leadData) lead = leadData;

    // 2) Update lead notes (if found)
    const stamp = getTimestamp();
    const line = `[${stamp}] SMS reply from ${from}: ${text}`;

    if (lead?.id) {
      const existing = s(lead.notes);
      const newNotes = existing ? `${existing.trim()}\n\n${line}` : line;

      await sb
        .from("leads")
        .update({ notes: newNotes, updated_at: new Date().toISOString() })
        .eq("id", lead.id);
    }

    // 3) Log inbound message (best-effort)
    try {
      await sb.from("sms_messages").insert([
        {
          direction: "inbound",
          lead_id: lead?.id || null,
          user_id: lead?.user_id || lead?.account_id || null,
          provider: "smsglobal",
          from_number: from,
          to_number: to || null,
          body: text,
          received_at: new Date().toISOString(),
          status: "received",
        },
      ]);
    } catch {
      // ignore if table/cols differ
    }

    return res.status(200).json({
      ok: true,
      matched_lead: !!lead?.id,
      lead_id: lead?.id || null,
    });
  } catch (err) {
    console.error("smsglobal sms-inbound error:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
      detail: err?.message || String(err),
      missing: err?.missing || null,
    });
  }
}
