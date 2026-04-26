// pages/api/calendar/save-booking-settings.js
// Saves booking page appearance to booking_page_settings table (standalone — no ALTER TABLE needed).

import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorised" });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Unauthorised" });

  const { pageTitle, pageBio, accentColor, logoUrl } = req.body;

  const { error } = await supabaseAdmin
    .from("booking_page_settings")
    .upsert({
      user_id:     user.id,
      page_title:  pageTitle   ?? null,
      page_bio:    pageBio     ?? null,
      accent_color: accentColor ?? "#84cc16",
      logo_url:    logoUrl     ?? null,
      updated_at:  new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (error) {
    console.error("save-booking-settings error:", error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
