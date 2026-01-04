// /pages/api/telephony/sms-broadcast.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function ok(res, body) {
  return res.status(200).json(body);
}
function bad(res, code, msg) {
  return res.status(code).json({ ok: false, error: msg });
}

function normalizePhone(raw) {
  let v = String(raw || "").trim();
  if (!v) return "";
  v = v.replace(/[^\d+]/g, "");
  if (!v.startsWith("+") && v.startsWith("61")) v = "+" + v;
  if (!v.startsWith("+") && v.startsWith("0") && v.length >= 9) v = "+61" + v.slice(1);
  return v;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return bad(res, 405, "Method not allowed");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { list_id, message } = req.body || {};
  const msg = String(message || "").trim();
  if (!list_id) return bad(res, 400, "Missing list_id");
  if (!msg) return bad(res, 400, "Missing message");

  try {
    // Auth user id via cookie session (supabase auth helpers not used here, so expect client to pass user_id if needed)
    // If you already have an auth wrapper, replace this section with your existing user validation.
    const userId = req.headers["x-user-id"] || null;

    // Try membership table first
    let leads = [];

    const { data: members, error: memErr } = await supabase
      .from("lead_list_members")
      .select("lead_id,user_id")
      .eq("list_id", list_id)
      .limit(10000);

    if (!memErr && Array.isArray(members) && members.length > 0) {
      const ids = members.map((m) => m.lead_id).filter(Boolean);
      const { data: leadRows, error: leadsErr } = await supabase
        .from("leads")
        .select("id,phone,user_id")
        .in("id", ids)
        .limit(10000);

      if (leadsErr) return bad(res, 500, leadsErr.message);
      leads = leadRows || [];
    } else {
      const { data: leadRows, error: leadsErr } = await supabase
        .from("leads")
        .select("id,phone,user_id")
        .eq("list_id", list_id)
        .limit(10000);

      if (leadsErr) return bad(res, 500, leadsErr.message);
      leads = leadRows || [];
    }

    // Optional: enforce user ownership if header provided
    const filtered = userId ? (leads || []).filter((l) => l.user_id === userId) : leads;

    const recipients = (filtered || [])
      .map((l) => ({ lead_id: l.id, to: normalizePhone(l.phone) }))
      .filter((r) => r.to && r.to.startsWith("+"));

    if (recipients.length === 0) return ok(res, { ok: true, queued: 0 });

    // Send one-by-one using your existing /api/telephony/send-sms endpoint server-side via internal fetch is not great.
    // Instead, we enqueue into a table if you have it. If you don't, we just fire requests using fetch to localhost.
    // ✅ Minimal approach: call SMS sending function by direct HTTP to same server.
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.BASE_URL ||
      (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}://${req.headers["host"]}` : `http://${req.headers["host"]}`);

    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      try {
        const resp = await fetch(`${baseUrl}/api/telephony/send-sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: r.to, message: msg }),
        });
        const d = await resp.json().catch(() => ({}));
        if (!resp.ok || d.ok === false) failed++;
        else sent++;
      } catch {
        failed++;
      }
    }

    return ok(res, { ok: true, queued: recipients.length, sent, failed });
  } catch (e) {
    console.error(e);
    return bad(res, 500, e.message || "Server error");
  }
}
