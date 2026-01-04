// /pages/api/crm/leads.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function getBearerToken(req) {
  const h = req.headers.authorization || "";
  if (!h.toLowerCase().startsWith("bearer ")) return "";
  return h.slice(7).trim();
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });

  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing auth token" });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ ok: false, error: "Invalid auth token" });

    const userId = userData.user.id;

    // Your app uses "leads" table everywhere
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("id, name, first_name, last_name, email, phone")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const leads = (data || []).map((l) => ({
      id: l.id,
      name:
        l.name ||
        [l.first_name, l.last_name].filter(Boolean).join(" ").trim() ||
        l.email ||
        l.phone ||
        `Lead #${l.id}`,
      email: l.email || "",
      phone: l.phone || "",
    }));

    return res.status(200).json({ ok: true, leads });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
