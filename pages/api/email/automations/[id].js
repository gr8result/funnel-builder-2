// List + Create automations
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { withAuth } from "../../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("email_automations")
      .select("*")
      .eq("owner", req.user.id)
      .order("updated_at", { ascending: false });
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, rows: data || [] });
  }

  if (req.method === "POST") {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: "Name required" });

    const row = {
      id: crypto.randomUUID(),
      owner: req.user.id,
      name,
      status: "draft",
      trigger: "manual",
      steps: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("email_automations")
      .insert(row)
      .select("*")
      .single();
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, row: data });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

export default withAuth(handler);