// pages/api/calendar/save-service-page-settings.js
// Saves per-service booking page appearance to service_page_settings table.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorised" });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Unauthorised" });

  const { serviceId, pageTitle, pageBio, accentColor, logoUrl } = req.body;
  if (!serviceId) return res.status(400).json({ error: "serviceId required" });

  // Verify ownership
  const { data: svc } = await supabaseAdmin
    .from("services")
    .select("id")
    .eq("id", serviceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!svc) return res.status(403).json({ error: "Not your service" });

  const { error } = await supabaseAdmin
    .from("service_page_settings")
    .upsert({
      service_id:   serviceId,
      user_id:      user.id,
      page_title:   pageTitle   ?? null,
      page_bio:     pageBio     ?? null,
      accent_color: accentColor ?? "#84cc16",
      logo_url:     logoUrl     ?? null,
      updated_at:   new Date().toISOString(),
    }, { onConflict: "service_id" });

  if (error) {
    console.error("save-service-page-settings error:", error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
