// /pages/api/lists/[id]/export.js
// GET: subscribers for a list with ?q= & ?from=YYYY-MM-DD & ?to=YYYY-MM-DD & ?limit=

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { withAuth } from "../../../../lib/withWorkspace";

const MAX_LIMIT = 1000;

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  const { q = "", from = "", to = "", limit = "200" } = req.query;

  if (!id) return res.status(400).json({ error: "Missing list id" });

  try {
    // Verify the authenticated user owns this list (prevents IDOR)
    const { data: list, error: listError } = await supabaseAdmin
      .from("lists")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (listError || !list) return res.status(403).json({ error: "Not found" });

    const safeLimit = Math.min(Math.max(1, Number(limit) || 200), MAX_LIMIT);

    let qy = supabaseAdmin
      .from("subscribers")
      .select("id,first_name,last_name,email,phone,company,position,address,postcode,source,created_at")
      .eq("list_id", id)
      .order("created_at", { ascending: false })
      .limit(safeLimit);

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

export default withAuth(handler);
