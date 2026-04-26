// pages/api/funnels/public-page.js
// Returns a published funnel + its steps for the public /p/[slug] page.
// Uses supabaseAdmin to bypass RLS on published funnels.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { slug, funnelId, preview } = req.query;
  const isPreview = `${preview || ""}` === "1" && !!funnelId;

  let query = supabaseAdmin
    .from("funnels")
    .select("id, name, status, slug");

  if (isPreview) {
    query = query.eq("id", funnelId);
  } else {
    if (!slug) return res.status(400).json({ error: "Missing slug" });
    query = query.eq("slug", slug).eq("status", "published");
  }

  const { data: funnel, error: fErr } = await query.maybeSingle();

  if (fErr || !funnel) return res.status(404).json({ error: "Not found" });

  const { data: steps, error: sErr } = await supabaseAdmin
    .from("funnel_steps")
    .select("id, title, content, order_index")
    .eq("funnel_id", funnel.id)
    .order("order_index", { ascending: true });

  if (sErr) return res.status(500).json({ error: sErr.message });

  return res.status(200).json({ funnel, steps: steps || [] });
}
