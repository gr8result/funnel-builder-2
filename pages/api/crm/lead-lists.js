// /pages/api/crm/lead-lists.js
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "GET only" });
  }

  const { workspaceId } = req;

  try {
    const { data, error } = await supabaseAdmin
      .from("lead_lists")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) {
      return res.status(500).json({ ok: false, error: error.message || String(error) });
    }

    return res.status(200).json({ ok: true, lists: data || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", detail: e?.message || String(e) });
  }
}

export default withWorkspace(handler);
