// pages/api/funnels/public-page.js
// Returns a published funnel + its steps for the public /p/[slug] page.
// Uses supabaseAdmin to bypass RLS on published funnels.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { verifyFunnelPreviewToken } from "../../../lib/funnels/previewToken";

let databaseOverride = null;
export function setFunnelPublicPageDb(client) {
  databaseOverride = client;
}
const db = () => databaseOverride || supabaseAdmin;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { slug, funnelId, preview, previewToken } = req.query;
  const isPreview = `${preview || ""}` === "1";
  const previewClaims = isPreview ? verifyFunnelPreviewToken(String(previewToken || ""), String(funnelId || "")) : null;
  if (isPreview && !previewClaims) return res.status(404).json({ error: "Not found" });

  let query = db()
    .from("funnels")
    .select("id, name, status, slug");

  if (isPreview) {
    query = query.eq("id", funnelId).eq("workspace_id", previewClaims.workspaceId).eq("is_master_template", false);
  } else {
    if (!slug) return res.status(400).json({ error: "Missing slug" });
    query = query.eq("slug", slug).eq("status", "published");
  }

  const { data: funnel, error: fErr } = await query.maybeSingle();

  if (fErr || !funnel) return res.status(404).json({ error: "Not found" });

  const { data: steps, error: sErr } = await db()
    .from("funnel_steps")
    .select("id, title, content, order_index")
    .eq("funnel_id", funnel.id)
    .order("order_index", { ascending: true });

  if (sErr) return res.status(500).json({ error: sErr.message });

  return res.status(200).json({ funnel, steps: steps || [] });
}
