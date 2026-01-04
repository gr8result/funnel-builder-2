// /pages/api/website/lead-capture.js
// FULL REPLACEMENT — Minimal endpoint (stores raw submissions so you never lose leads)
// Creates its own table automatically is NOT possible here, so:
// ✅ If you already have a table `website_leads`, it will insert there
// ✅ Otherwise it returns a clear error telling you what table is missing

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ error: "Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" });
    }

    const { firstName = "", email = "", tag = "builder" } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email required" });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Store in a simple table you can create if you want:
    // website_leads(email text, first_name text, tag text, created_at timestamptz default now())
    const { error } = await supabase.from("website_leads").insert({
      email: String(email).trim(),
      first_name: String(firstName || "").trim(),
      tag: String(tag || "builder"),
    });

    if (error) {
      return res.status(500).json({
        error:
          "Lead capture failed. Create table `website_leads` (email, first_name, tag, created_at) or change this endpoint to write into your existing leads table. Raw error: " +
          error.message,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
