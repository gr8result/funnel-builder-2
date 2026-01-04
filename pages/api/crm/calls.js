// /pages/api/crm/calls.js
// CRM calls API – GET + DELETE only

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const db =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY)
    : null;

export default async function handler(req, res) {
  if (!db) {
    return res
      .status(500)
      .json({ error: "Supabase not configured on server." });
  }

  const { method } = req;

  try {
    // GET – list calls
    if (method === "GET") {
      const limit = parseInt(req.query.limit || "500", 10);

      const { data, error } = await db
        .from("crm_calls")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[/api/crm/calls] GET error:", error);
        return res.status(500).json({ error: "Failed to load calls." });
      }

      return res.status(200).json({ calls: data || [] });
    }

    // DELETE – remove a call record
    if (method === "DELETE") {
      const { id } = req.body || {};
      if (!id) {
        return res.status(400).json({ error: "Missing call id." });
      }

      const { error } = await db.from("crm_calls").delete().eq("id", id);

      if (error) {
        console.error("[/api/crm/calls] DELETE error:", error);
        return res.status(500).json({ error: "Failed to delete call." });
      }

      return res.status(200).json({ ok: true });
    }

    // anything else
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[/api/crm/calls] Unexpected error:", err);
    return res.status(500).json({ error: "Server error." });
  }
}
