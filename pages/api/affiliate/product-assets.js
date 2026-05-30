import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import withAdmin from "../../../lib/withAdmin";

function normalizeProductIds(input) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const productIds = normalizeProductIds(req.body?.productIds);
    if (!productIds.length) {
      return res.status(200).json({ ok: true, assets: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("vendor_assets")
      .select("*")
      .in("product_id", productIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const assets = (data || []).map((row) => ({
      id: row.id,
      title: row.title || "",
      description: row.description || "",
      link: row.link || "",
      image_url: row.image_url || "",
      product_id: row.product_id || null,
      category: row.category || null,
      asset_type: row.asset_type || null,
      created_at: row.created_at || null,
    }));

    return res.status(200).json({ ok: true, assets });
  } catch (error) {
    console.error("affiliate/product-assets error", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to load product assets",
    });
  }
}

export default withAdmin(handler);
