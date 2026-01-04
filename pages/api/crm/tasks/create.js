// /pages/api/crm/tasks/create.js
// NEW FILE (FULL)
// POST { lead_id, title, due_at?, meta? }
// ✅ Creates a CRM task reminder (if crm_tasks exists)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function getBearerToken(req) {
  const h = req.headers.authorization || "";
  if (!h.toLowerCase().startsWith("bearer ")) return "";
  return h.slice(7).trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing auth token" });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ ok: false, error: "Invalid auth token" });

    const userId = userData.user.id;

    const { lead_id, title, due_at, meta } = req.body || {};
    if (!lead_id) return res.status(400).json({ ok: false, error: "lead_id required" });
    if (!String(title || "").trim()) return res.status(400).json({ ok: false, error: "title required" });

    const { data, error } = await supabaseAdmin
      .from("crm_tasks")
      .insert({
        user_id: userId,
        lead_id,
        title: String(title),
        due_at: due_at || null,
        status: "open",
        meta: meta || null,
      })
      .select("id")
      .single();

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
