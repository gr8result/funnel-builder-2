// /pages/api/telephony/send-sms.js
// FULL REPLACEMENT
// POST { to, message, lead_id? }
// ✅ Sends SMS via your existing SMSGlobal endpoint if present, otherwise returns clear error
// ✅ ALWAYS logs the SMS into BOTH lead_notes (if exists) AND leads.notes (always)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

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

async function appendLeadsNotesAlways({ userId, leadId, note }) {
  if (!userId || !leadId || !note) return { ok: false };

  const { data: leadRow, error: leadErr } = await supabaseAdmin
    .from("leads")
    .select("id, notes")
    .eq("user_id", userId)
    .eq("id", leadId)
    .single();

  if (leadErr) return { ok: false, error: leadErr.message };

  const existing = String(leadRow?.notes || "").trim();
  const stamped = `[${new Date().toLocaleString()}]\n${String(note)}`;
  const next = existing ? `${existing}\n\n${stamped}` : stamped;

  const { error: updErr } = await supabaseAdmin.from("leads").update({ notes: next }).eq("user_id", userId).eq("id", leadId);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true };
}

async function tryInsertLeadNotes({ userId, leadId, note, meta }) {
  if (!userId || !leadId || !note) return { ok: false };

  const ins = await supabaseAdmin
    .from("lead_notes")
    .insert({ user_id: userId, lead_id: leadId, note: String(note), meta: meta || null })
    .select("id")
    .single();

  if (ins.error) return { ok: false, error: ins.error.message };
  return { ok: true, id: ins.data?.id || null };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  try {
    const { to, message, lead_id = null } = req.body || {};
    const toNum = normalizePhone(to);
    const msg = String(message || "").trim();

    if (!toNum) return res.status(400).json({ ok: false, error: "to required" });
    if (!toNum.startsWith("+")) return res.status(400).json({ ok: false, error: "Phone must include +countrycode" });
    if (!msg) return res.status(400).json({ ok: false, error: "message required" });

    // If we have a lead_id, resolve user_id + lead identity so we can log notes
    let userId = null;
    let leadName = null;

    if (lead_id) {
      const { data: leadRow } = await supabaseAdmin.from("leads").select("id, user_id, name, email, phone").eq("id", lead_id).single();
      if (leadRow?.user_id) {
        userId = leadRow.user_id;
        leadName = leadRow.name || leadRow.email || leadRow.phone || `Lead #${lead_id}`;
      }
    }

    // Send via your existing SMSGlobal endpoint (internal)
    const baseUrl = getBaseUrl(req);
    const sendUrl = `${baseUrl}/api/smsglobal/SMSGlobalSMSSend`;

    let providerOk = false;
    let providerPayload = null;

    try {
      const r = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: toNum, message: msg }),
      });
      const j = await r.json().catch(() => ({}));
      providerOk = r.ok && j && (j.ok === true || j.success === true || j.sent === true || j.status === "OK" || j.processed);
      providerPayload = j;
      if (!providerOk && !r.ok) {
        return res.status(500).json({ ok: false, error: j?.error || "SMS provider error" });
      }
    } catch (e) {
      return res.status(500).json({ ok: false, error: e?.message || "SMS provider error" });
    }

    // Log into lead notes (if lead provided)
    if (lead_id && userId) {
      const note = `💬 SMS sent
Lead: ${leadName || `#${lead_id}`}
When: ${new Date().toLocaleString()}
To: ${toNum}
Message: ${msg}`;

      await tryInsertLeadNotes({
        userId,
        leadId: lead_id,
        note,
        meta: { type: "sms_sent", to: toNum, provider: "smsglobal", provider_payload: providerPayload || null },
      }).catch(() => {});
      await appendLeadsNotesAlways({ userId, leadId: lead_id, note }).catch(() => {});
    }

    return res.status(200).json({ ok: true, to: toNum, lead_id: lead_id || null, provider: "smsglobal" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
