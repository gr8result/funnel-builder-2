// /pages/api/smsglobal/send-bulk.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizePhone(raw) {
  let v = String(raw || "").trim();
  if (!v) return "";
  v = v.replace(/[^\d+]/g, "");
  if (!v.startsWith("+") && v.startsWith("61")) v = "+" + v;
  if (!v.startsWith("+") && v.startsWith("0") && v.length >= 9) v = "+61" + v.slice(1);
  return v;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { user_id, list_id, message } = req.body || {};
    const userId = String(user_id || "").trim();
    const listId = String(list_id || "").trim();
    const msg = String(message || "").trim();

    if (!userId) return res.status(400).json({ ok: false, error: "Missing user_id." });
    if (!listId) return res.status(400).json({ ok: false, error: "Missing list_id." });
    if (!msg) return res.status(400).json({ ok: false, error: "Missing message." });

    const SMSGLOBAL_API_URL = process.env.SMSGLOBAL_API_URL || "https://api.smsglobal.com/http-api.php";
    const SMSGLOBAL_USERNAME = process.env.SMSGLOBAL_USERNAME;
    const SMSGLOBAL_PASSWORD = process.env.SMSGLOBAL_PASSWORD;
    const SMSGLOBAL_FROM = process.env.SMSGLOBAL_FROM || "GR8RESULT";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ ok: false, error: "Supabase env not configured (URL/service role key)." });
    }
    if (!SMSGLOBAL_USERNAME || !SMSGLOBAL_PASSWORD) {
      return res.status(500).json({ ok: false, error: "SMSGlobal not configured (missing username/password)." });
    }

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Pull leads in this list
    const { data: leads, error } = await supa
      .from("leads")
      .select("id,name,phone,email,user_id,list_id")
      .eq("user_id", userId)
      .eq("list_id", listId);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const rows = Array.isArray(leads) ? leads : [];
    const recipients = rows
      .map((l) => ({
        lead_id: l.id,
        name: l.name || "",
        to: normalizePhone(l.phone),
      }))
      .filter((x) => x.to && x.to.startsWith("+"));

    const results = [];
    let okCount = 0;
    let failCount = 0;

    for (const rcp of recipients) {
      try {
        const params = new URLSearchParams();
        params.set("action", "sendsms");
        params.set("user", SMSGLOBAL_USERNAME);
        params.set("password", SMSGLOBAL_PASSWORD);
        params.set("from", SMSGLOBAL_FROM);
        params.set("to", rcp.to);
        params.set("text", msg);

        // OPTIONAL: if you set SMSGLOBAL_DLR_URL in env, we add callback in message (SMSGlobal supports callbacks in some plans)
        // If your account uses a different callback parameter name, we’ll adjust after you confirm the SMSGlobal receipt docs.
        const dlr = process.env.SMSGLOBAL_DLR_URL;
        if (dlr) params.set("callback", dlr);

        const url = `${SMSGLOBAL_API_URL}?${params.toString()}`;
        const http = await fetch(url, { method: "GET" });
        const raw = await http.text();

        if (!http.ok) {
          failCount++;
          results.push({ ok: false, to: rcp.to, lead_id: rcp.lead_id, error: raw || "send failed" });
          continue;
        }

        okCount++;
        // provider id parsing varies; store raw
        results.push({ ok: true, to: rcp.to, lead_id: rcp.lead_id, provider_id: null, raw });
      } catch (e) {
        failCount++;
        results.push({ ok: false, to: rcp.to, lead_id: rcp.lead_id, error: e?.message || "send failed" });
      }
    }

    return res.status(200).json({
      ok: true,
      total: recipients.length,
      sent: recipients.length,
      okCount,
      failCount,
      results,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Bulk send failed." });
  }
}
