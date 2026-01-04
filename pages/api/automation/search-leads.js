// /pages/api/automation/search-leads.js
// FULL REPLACEMENT — searches leads for "Add Person"

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function getBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

    const q = String(req.query?.q || "").trim();
    if (!q) return res.status(200).json({ ok: true, leads: [] });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const { data, error } = await admin
      .from("leads")
      .select("id,name,first_name,last_name,email,phone,updated_at")
      .or(
        `name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`
      )
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error) {
      return res.status(500).json({ ok: false, error: "Search failed", details: error.message });
    }

    const leads =
      (data || []).map((l) => ({
        id: l.id,
        name:
          l.name ||
          `${l.first_name || ""} ${l.last_name || ""}`.trim() ||
          "Unnamed",
        email: l.email || "",
        phone: l.phone || "",
      })) || [];

    return res.status(200).json({ ok: true, leads });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", details: e?.message || String(e) });
  }
}
