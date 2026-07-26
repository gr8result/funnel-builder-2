import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const ALLOWED_UPDATE_FIELDS = ["category_id", "supplier_id", "active", "markup_percent", "requires_image", "library_scope", "pricing_tier", "available_for_selection"];

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const productIds = Array.isArray(req.body?.productIds) ? req.body.productIds.filter(Boolean) : [];
    if (!productIds.length) return res.status(400).json({ ok: false, error: "productIds is required." });

    const action = String(req.body?.action || "update");

    if (action === "delete") {
      const { data, error } = await supabaseAdmin
        .from("builder_products")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("workspace_id", req.workspaceId)
        .in("id", productIds)
        .select("id");
      if (error) throw error;
      return res.status(200).json({ ok: true, archived: (data || []).length });
    }

    const updates = req.body?.updates && typeof req.body.updates === "object" ? req.body.updates : {};
    const payload = { updated_at: new Date().toISOString() };
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(updates, field) && updates[field] !== "" && updates[field] !== undefined) {
        payload[field] = updates[field];
      }
    }
    if (Object.keys(payload).length === 1) return res.status(400).json({ ok: false, error: "No valid bulk update fields were provided." });

    const { data, error } = await supabaseAdmin
      .from("builder_products")
      .update(payload)
      .eq("workspace_id", req.workspaceId)
      .in("id", productIds)
      .select("id");
    if (error) throw error;

    return res.status(200).json({ ok: true, updated: (data || []).length });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "Bulk update failed." });
  }
}

export default withWorkspace(handler);
