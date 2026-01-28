// /pages/api/twilio/list-calls.js
// FULL REPLACEMENT
//
// ✅ Recent Calls = rows from public.crm_calls ONLY
// ✅ NEVER cached (fixes your 304/empty cached responses)
// ✅ Multi-tenant safe: Bearer token + verifies logged-in user
// ✅ Includes fields your Calls UI needs: from/to/direction/duration/recording/lead_id/caller_name
//
// Query:
//   ?limit=50
//
// Returns:
//   { ok:true, calls:[ ... ] }

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function s(v) {
  return String(v ?? "").trim();
}

function getBearer(req) {
  const h = s(req.headers.authorization);
  if (!h.toLowerCase().startsWith("bearer ")) return "";
  return h.slice(7).trim();
}

export default async function handler(req, res) {
  try {
    // ✅ Never cache this endpoint (stops 304s returning stale data)
    res.setHeader("Cache-Control", "no-store, max-age=0");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env" });
    }

    const token = getBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Validate user
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userData?.user?.id || null;
    if (userErr || !userId) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10) || 50, 1), 200);

    // Get lead IDs for this user (so we can include crm_calls rows even if user_id is NULL)
    const { data: leads, error: leadsErr } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .limit(5000);

    if (leadsErr) return res.status(500).json({ ok: false, error: leadsErr.message });

    const leadIds = (leads || []).map((x) => x.id).filter(Boolean);

    // Pull calls
    let q = supabase
      .from("crm_calls")
      .select(
        [
          "id",
          "created_at",
          "direction",
          "from_number",
          "to_number",
          "duration",
          "status",
          "lead_id",
          "caller_name",
          "recording_sid",
          "recording_url",
          "twilio_sid",
          "contact_number",
          "our_number",
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (leadIds.length) {
      // include:
      // - calls explicitly tagged to this user
      // - calls linked to this user's leads (even if user_id is NULL)
      q = q.or(`user_id.eq.${userId},lead_id.in.(${leadIds.join(",")})`);
    } else {
      q = q.eq("user_id", userId);
    }

    const { data: rows, error } = await q;
    if (error) return res.status(500).json({ ok: false, error: error.message });

    const calls = (rows || []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      direction: r.direction || null,
      from: r.from_number || null,
      to: r.to_number || null,
      duration: r.duration ?? null,
      status: r.status || null,
      lead_id: r.lead_id || null,
      caller_name: r.caller_name || null,
      twilio_sid: r.twilio_sid || null,
      recording_sid: r.recording_sid || null,
      recording_url: r.recording_url || null,
      contact_number: r.contact_number || null,
      our_number: r.our_number || null,
    }));

    return res.status(200).json({ ok: true, calls });
  } catch (e) {
    console.error("list-calls error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
