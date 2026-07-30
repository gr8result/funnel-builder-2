import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { roundMoney } from "../../../lib/builders/selectionBudget";
import { normalizeLibraryScope } from "../../../lib/product-library/constants";

const WRITABLE_FIELDS = [
  "product_name",
  "sku",
  "description",
  "product_type",
  "requirement_tags",
  "compatible_area_types",
  "fuel_type",
  "mounting_type",
  "installation_type",
  "availability_status",
  "pricing_tier",
  "category_id",
  "subcategory",
  "room_or_usage",
  "is_visual_product",
  "requires_image",
  "library_scope",
  "active",
  "available_for_selection",
  "display_order",
  "manufacturer_id",
  "supplier_id",
  "model",
  "colour",
  "finish",
  "size_dimensions",
  "product_url",
  "cost_price",
  "base_allowance",
  "upgrade_value_mode",
  "upgrade_cost",
  "retail_price",
  "gst_included",
  "sell_price",
  "markup_percent",
  "pricing_mode",
  "price_band",
  "standard_included",
  "variant_label",
  "parent_product_id",
  "primary_image_url",
  "additional_image_urls",
  "datasheet_pdf_url",
  "notes",
  "client_notes",
];

const NUMERIC_FIELDS = new Set(["cost_price", "base_allowance", "upgrade_cost", "retail_price", "sell_price", "markup_percent", "display_order"]);
const TEXT_FIELDS = new Set(["sku", "description", "product_type", "requirement_tags", "compatible_area_types", "fuel_type", "mounting_type", "installation_type", "availability_status", "subcategory", "room_or_usage", "model", "colour", "finish", "size_dimensions", "product_url", "variant_label", "notes", "client_notes", "datasheet_pdf_url"]);

function buildPayload(body) {
  const payload = {};
  for (const field of WRITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const raw = body[field];
    if (NUMERIC_FIELDS.has(field)) {
      payload[field] = raw === "" || raw === null || raw === undefined ? null : Number(raw);
      if (payload[field] !== null && !Number.isFinite(payload[field])) {
        throw new Error(`${field} must be a number`);
      }
    } else if (TEXT_FIELDS.has(field)) {
      payload[field] = typeof raw === "string" ? raw.trim() || null : raw ?? null;
    } else if (field === "category_id" || field === "manufacturer_id" || field === "supplier_id" || field === "parent_product_id") {
      payload[field] = raw || null;
    } else {
      payload[field] = raw;
    }
  }
  if (payload.library_scope) payload.library_scope = normalizeLibraryScope(payload.library_scope, "CLIENT_SELECTION");
  if (payload.additional_image_urls && !Array.isArray(payload.additional_image_urls)) {
    throw new Error("additional_image_urls must be an array");
  }

  // Upgrade Value = Builder Cost - Included Allowance, unless the product has an
  // explicit manual override. Recomputed server-side so a stale client-side preview
  // can never be saved as the effective value.
  if (payload.upgrade_value_mode !== "manual") {
    const builderCost = Number(payload.cost_price ?? 0) || 0;
    const includedAllowance = Number(payload.base_allowance ?? 0) || 0;
    payload.upgrade_cost = roundMoney(builderCost - includedAllowance);
  } else if (payload.upgrade_cost !== undefined && payload.upgrade_cost !== null) {
    payload.upgrade_cost = roundMoney(payload.upgrade_cost);
  }

  return payload;
}

async function assertNoStandardInclusionConflict(workspaceId, payload, excludeId) {
  if (!payload.standard_included || !payload.category_id) return;
  const tier = payload.pricing_tier || "CLASSIC";
  let query = supabaseAdmin
    .from("builder_products")
    .select("id, product_name")
    .eq("workspace_id", workspaceId)
    .eq("category_id", payload.category_id)
    .eq("standard_included", true)
    .eq("active", true)
    .or(`pricing_tier.eq.${tier}${tier === "CLASSIC" ? ",pricing_tier.is.null" : ""}`);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (data) {
    const conflictError = new Error(
      `"${data.product_name}" is already the standard inclusion for this category and tier. Unmark it first.`
    );
    conflictError.statusCode = 409;
    throw conflictError;
  }
}

async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const payload = buildPayload(req.body || {});
      if (!payload.product_name || !String(payload.product_name).trim()) {
        return res.status(400).json({ ok: false, error: "product_name is required." });
      }
      await assertNoStandardInclusionConflict(req.workspaceId, payload, null);
      const { data, error } = await supabaseAdmin
        .from("builder_products")
        .insert({ ...payload, workspace_id: req.workspaceId, last_price_update: new Date().toISOString() })
        .select("*")
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, product: data });
    }

    if (req.method === "PATCH") {
      const id = String(req.body?.id || "");
      if (!id) return res.status(400).json({ ok: false, error: "id is required." });
      const payload = buildPayload(req.body || {});
      if (Object.prototype.hasOwnProperty.call(payload, "product_name") && !String(payload.product_name).trim()) {
        return res.status(400).json({ ok: false, error: "product_name cannot be empty." });
      }
      await assertNoStandardInclusionConflict(req.workspaceId, payload, id);
      const { data, error } = await supabaseAdmin
        .from("builder_products")
        .update({ ...payload, updated_at: new Date().toISOString(), last_price_update: new Date().toISOString() })
        .eq("workspace_id", req.workspaceId)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, product: data });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query?.id || "");
      if (!id) return res.status(400).json({ ok: false, error: "id is required." });

      const { count, error: refError } = await supabaseAdmin
        .from("builder_client_selections")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", req.workspaceId)
        .eq("product_id", id);
      if (refError) throw refError;

      if (count && count > 0) {
        const { data, error } = await supabaseAdmin
          .from("builder_products")
          .update({ active: false, available_for_selection: false, updated_at: new Date().toISOString() })
          .eq("workspace_id", req.workspaceId)
          .eq("id", id)
          .select("id")
          .single();
        if (error) throw error;
        return res.status(200).json({ ok: true, archivedInstead: true, referencedByProjects: count, product: data });
      }

      const { error: deleteError } = await supabaseAdmin
        .from("builder_products")
        .delete()
        .eq("workspace_id", req.workspaceId)
        .eq("id", id);
      if (deleteError) throw deleteError;
      return res.status(200).json({ ok: true, deleted: true });
    }

    res.setHeader("Allow", "POST, PATCH, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ ok: false, error: "Another product already holds this standard inclusion for the same category and tier." });
    }
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({ ok: false, error: error?.message || "Product save failed." });
  }
}

export default withWorkspace(handler);
