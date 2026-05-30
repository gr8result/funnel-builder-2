// /pages/api/email/my-templates.js
// Returns the current user's saved email templates using service role (bypasses RLS).
// Auth: caller sends the Supabase access token in Authorization: Bearer <token>

import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../lib/withWorkspace";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;
if (supabaseUrl && serviceKey) {
  supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Use GET." });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ ok: false, error: "Server not configured." });
  }

  // Verify the caller's identity from their access token
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, error: "Missing access token." });
  }

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user?.id) {
    return res.status(401).json({ ok: false, error: "Invalid or expired session." });
  }

  const userId = userData.user.id;

  // Try progressively simpler queries to handle different schema shapes
  const selectShapes = [
    "id,name,html_content,html,thumbnail_url,created_at,user_id",
    "id,name,html_content,html,thumbnail_url,created_at",
    "id,name,html_content,html,created_at",
    "id,name,html_content,html",
  ];

  let rows = [];
  let lastError = null;

  for (const shape of selectShapes) {
    let q = supabaseAdmin.from("email_templates").select(shape);

    // If shape includes user_id column, filter by it; otherwise return all
    if (shape.includes("user_id")) {
      q = q.eq("user_id", userId);
    }

    if (shape.includes("created_at")) {
      q = q.order("created_at", { ascending: false });
    }

    const { data, error } = await q;
    if (!error) {
      rows = data || [];
      lastError = null;
      break;
    }
    lastError = error;
  }

  if (lastError) {
    console.error("[my-templates] All query attempts failed:", lastError);
    return res.status(500).json({ ok: false, error: lastError.message });
  }

  const templates = rows.map((row) => ({
    id: String(row.id || ""),
    name: String(row.name || row.id || ""),
    html: String(row.html_content || row.html || ""),
    thumbUrl: row.thumbnail_url || "",
  })).filter((t) => t.id && t.html.trim());

  return res.status(200).json({ ok: true, templates });
}

export default withAuth(handler);
