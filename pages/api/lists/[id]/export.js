// /pages/api/lists/[id]/subscribers.js
// GET: subscribers for a list with ?q= & ?from=YYYY-MM-DD & ?to=YYYY-MM-DD & ?limit=

let supabase = null;
try {
  const { createClient } = require("@supabase/supabase-js");
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
} catch {}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  const { q = "", from = "", to = "", limit = "200" } = req.query;

  if (!id) return res.status(400).json({ error: "Missing list id" });
  if (!supabase) return res.status(200).json({ ok: true, rows: [] }); // no FS model for subs here

  try {
    let qy = supabase
      .from("subscribers")
      .select("id,first_name,last_name,email,phone,company,position,address,postcode,source,created_at")
      .eq("list_id", id)
      .order("created_at", { ascending: false })
      .limit(Number(limit));

    if (q) {
      qy = qy.or(
        [
          `first_name.ilike.%${q}%`,
          `last_name.ilike.%${q}%`,
          `email.ilike.%${q}%`,
          `phone.ilike.%${q}%`,
          `company.ilike.%${q}%`,
        ].join(",")
      );
    }
    if (from) qy = qy.gte("created_at", from);
    if (to)   qy = qy.lte("created_at", to + " 23:59:59");

    const { data, error } = await qy;
    if (error) throw error;
    return res.status(200).json({ ok: true, rows: data || [] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "failed" });
  }
}
