// /pages/api/crm/calls.js
// CRM calls API – GET + DELETE only

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const db =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

function getBearer(req) {
  const auth = String(req.headers.authorization || "").trim();
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return (m?.[1] || "").trim();
}

export default async function handler(req, res) {
  if (!db) {
    return res
      .status(500)
      .json({ error: "Supabase not configured on server." });
  }

  const token = getBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Verify user
  const {
    data: { user },
    error: userErr,
  } = await db.auth.getUser(token);

  if (userErr || !user?.id) {
    return res.status(401).json({ error: "Invalid session" });
  }

  const { method } = req;

  try {
    // GET – list calls
    if (method === "GET") {
      const limit = parseInt(req.query.limit || "500", 10);

      console.log("[/api/crm/calls] Fetching calls for user:", user.id);

      const { data, error } = await db
        .from("crm_calls")
        .select("*")
        .eq("user_id", user.id)
        .eq("direction", "outbound")
        .order("created_at", { ascending: false })
        .limit(limit);

      console.log("[/api/crm/calls] Query result:", { 
        count: data?.length || 0, 
        error: error?.message,
        firstCall: data?.[0]
      });

      if (error) {
        console.error("[/api/crm/calls] GET error:", error);
        return res.status(500).json({ error: "Failed to load calls." });
      }

      return res.status(200).json({ ok: true, calls: data || [] });
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
