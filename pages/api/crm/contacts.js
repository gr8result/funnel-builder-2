// /pages/api/crm/contacts.js
// ⚠️  DEPRECATED — the platform uses the `leads` table as the single CRM store.
// This endpoint is kept for backwards-compat but now requires authentication
// and delegates reads to the leads table scoped by workspace_id.
import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function handler(req, res) {
  const { workspaceId } = req;

  try {
    if (req.method === "GET") {
      const { stage, from, to, q, limit = 200 } = req.query;
      let qy = supabaseAdmin
        .from("leads")
        .select("id, name, email, phone, company, stage, lead_status, created_at, updated_at")
        .eq("workspace_id", workspaceId)
        .limit(Math.min(Number(limit) || 200, 1000))
        .order("created_at", { ascending: false });
      if (stage) qy = qy.eq("stage", stage);
      if (from) qy = qy.gte("created_at", from);
      if (to) qy = qy.lte("created_at", to);
      if (q) {
        qy = qy.or(
          `name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%`
        );
      }
      const { data, error } = await qy;
      if (error) throw error;
      return res.status(200).json({ ok: true, rows: data });
    }
    if (req.method === "PATCH") {
      const { ids = [], stage } = req.body || {};
      if (!ids.length) return res.status(400).json({ error: "no ids" });
      // Ensure we only update leads that belong to this workspace
      const { error } = await supabaseAdmin
        .from("leads")
        .update({ stage, updated_at: new Date() })
        .in("id", ids)
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[/api/crm/contacts]", e);
    return res.status(500).json({ error: "failed" });
  }
}

export default withWorkspace(handler);

