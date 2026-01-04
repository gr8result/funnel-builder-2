// /pages/api/lists/index.js
// FULL REPLACEMENT
// Server-side lists API (service role). No browser supabase client import.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "GET only" });
    }

    const userId = req.query.user_id || req.query.userId || null;
    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing user_id" });
    }

    // Use your real table name; from your earlier work it’s lead_lists.
    const { data, error } = await supabaseAdmin
      .from("lead_lists")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, lists: data || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "error" });
  }
}
