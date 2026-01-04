// /pages/api/smsglobal/dlr.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // SMSGlobal may POST or GET delivery callbacks depending on setup
  try {
    const payload = req.method === "GET" ? req.query : req.body;

    // These field names vary; we store raw + try best-effort mapping:
    const provider_id = String(payload?.msgid || payload?.message_id || payload?.id || "").trim();
    const to = String(payload?.to || payload?.destination || payload?.msisdn || "").trim();
    const status = String(payload?.status || payload?.dlr || payload?.state || "").trim().toLowerCase();
    const delivered_at = payload?.delivered_at || payload?.timestamp || null;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ ok: false, error: "Supabase not configured." });
    }
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // store receipt (you can use this for auditing even if you don’t have sms_messages yet)
    await supa.from("sms_delivery_receipts").insert([
      {
        provider: "smsglobal",
        provider_id: provider_id || null,
        to: to || null,
        status: status || null,
        delivered_at: delivered_at ? new Date(delivered_at).toISOString() : null,
        raw: payload,
      },
    ]);

    // If you also store outbound messages in sms_messages table, update it:
    if (provider_id) {
      await supa
        .from("sms_messages")
        .update({
          delivery_status: status || null,
          delivered_at: delivered_at ? new Date(delivered_at).toISOString() : null,
          last_receipt_raw: payload,
        })
        .eq("provider", "smsglobal")
        .eq("provider_id", provider_id);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "DLR error" });
  }
}
