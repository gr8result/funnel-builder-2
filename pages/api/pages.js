import { withAuth } from "../../lib/withWorkspace";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
// /pages/api/pages.js

async function handler(req, res) {
  const userId = req.user.id;

  if (req.method === 'GET') {
    const { funnel_id } = req.query;
    if (!funnel_id) return res.status(400).json({ error: "Missing funnel_id" });

    // Verify the funnel belongs to this user before returning its pages
    const { data: funnel } = await supabaseAdmin
      .from("funnels")
      .select("id")
      .eq("id", funnel_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!funnel) return res.status(403).json({ error: "Forbidden" });

    const { data, error } = await supabaseAdmin
      .from("pages")
      .select("*")
      .eq("funnel_id", funnel_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { funnel_id, title, html } = req.body;
    if (!funnel_id) return res.status(400).json({ error: "Missing funnel_id" });

    // Verify ownership before creating a page
    const { data: funnel } = await supabaseAdmin
      .from("funnels")
      .select("id")
      .eq("id", funnel_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!funnel) return res.status(403).json({ error: "Forbidden" });

    const { data, error } = await supabaseAdmin
      .from("pages")
      .insert({ funnel_id, title, html })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withAuth(handler);
