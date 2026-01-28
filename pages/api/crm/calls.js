// /pages/api/crm/calls.js
// FULL REPLACEMENT
//
// ✅ Reads ONLY public.crm_calls for the logged-in user
// ✅ Safe lead name mapping (no full_name dependency)
// ✅ Filters out junk rows (client:...)
// ✅ Returns recording_url that your <audio> can play

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE;

function s(v) {
  return String(v ?? "").trim();
}

function clampInt(v, min, max, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
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
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env" });
    }

    // auth user from bearer
    const authHeader = s(req.headers.authorization);
    const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
    if (!bearer) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    const user_id = userData?.user?.id || null;
    if (userErr || !user_id) return res.status(401).json({ ok: false, error: "Invalid session" });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const limit = clampInt(req.query.limit, 1, 200, 50);
    const lead_id = s(req.query.lead_id || "");

    let q = supabase
      .from("crm_calls")
      .select(
        "id,created_at,user_id,lead_id,direction,from_number,to_number,status,duration,recording_sid,recording_url,caller_name,our_number,contact_number"
      )
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (lead_id) q = q.eq("lead_id", lead_id);

    const { data: callsRaw, error: callsErr } = await q;
    if (callsErr) return res.status(500).json({ ok: false, error: callsErr.message });

    const calls = Array.isArray(callsRaw) ? callsRaw : [];

    // map lead names safely
    const leadIds = Array.from(new Set(calls.map((c) => s(c.lead_id)).filter(Boolean)));
    const leadNameMap = new Map();

    if (leadIds.length) {
      const { data: leads } = await supabase
        .from("leads")
        .select("id,name,first_name,last_name,company_name")
        .in("id", leadIds);

      for (const l of leads || []) {
        const nm =
          s(l.name) ||
          s(l.company_name) ||
          s([l.first_name, l.last_name].filter(Boolean).join(" "));
        if (nm) leadNameMap.set(String(l.id), nm);
      }
    }

    const cleaned = calls
      .map((c) => {
        const from = normalizePhone(c.from_number || c.our_number || "");
        const to = normalizePhone(c.to_number || c.contact_number || "");
        const recSid = s(c.recording_sid);
        const recUrl = s(c.recording_url);

        const name =
          s(c.caller_name) ||
          leadNameMap.get(String(c.lead_id || "")) ||
          "";

        return {
          id: c.id,
          created_at: c.created_at,
          lead_id: c.lead_id,
          name,
          direction: s(c.direction) || "",
          status: s(c.status) || "",
          from,
          to,
          duration: Number.isFinite(Number(c.duration)) ? Number(c.duration) : null,
          recording_sid: recSid || "",
          recording_url:
            recUrl ||
            (recSid ? `/api/twilio/recording?sid=${encodeURIComponent(recSid)}` : ""),
        };
      })
      // remove junk rows
      .filter((r) => {
        const hasPhone =
          (r.from && r.from.startsWith("+")) ||
          (r.to && r.to.startsWith("+"));
        const hasRec = !!r.recording_sid || !!r.recording_url;
        const hasDuration = Number.isFinite(Number(r.duration)) && Number(r.duration) > 0;
        return hasPhone || hasRec || hasDuration;
      });

    return res.status(200).json({ ok: true, calls: cleaned });
  } catch (e) {
    console.error("api/crm/calls error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
