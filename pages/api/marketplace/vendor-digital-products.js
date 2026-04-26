import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const code = normalizeText(req.body?.code);
    const action = normalizeText(req.body?.action);
    const vendorId = normalizeText(req.body?.vendorId);

    if (!code || !action || !vendorId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (action !== "upsert" && action !== "delete" && action !== "list") {
      return res.status(400).json({ error: "Invalid action" });
    }

    const { data: marketplaceUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("user_code", code)
      .maybeSingle();

    if (userError || !marketplaceUser?.id) {
      return res.status(403).json({ error: "Invalid marketplace code" });
    }

    const { data: vendorRecord, error: vendorError } = await supabaseAdmin
      .from("vendors")
      .select("id, user_id, email")
      .eq("id", vendorId)
      .maybeSingle();

    if (vendorError || !vendorRecord?.id) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const vendorEmail = normalizeText(vendorRecord.email).toLowerCase();
    const userEmail = normalizeText(marketplaceUser.email).toLowerCase();
    const ownsByUserId = vendorRecord.user_id && vendorRecord.user_id === marketplaceUser.id;
    const ownsByEmail = vendorEmail && userEmail && vendorEmail === userEmail;

    if (!ownsByUserId && !ownsByEmail) {
      return res.status(403).json({ error: "Vendor access denied" });
    }

    if (action === "list") {
      const { data: products, error: listError } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("vendor_id", vendorRecord.id)
        .eq("type", "digital")
        .order("created_at", { ascending: false });

      if (listError) {
        throw listError;
      }

      return res.status(200).json({ ok: true, products: products || [] });
    }

    if (action === "delete") {
      const productId = normalizeText(req.body?.productId);
      if (!productId) {
        return res.status(400).json({ error: "Missing productId" });
      }

      const { error: deleteError } = await supabaseAdmin
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("vendor_id", vendorRecord.id)
        .eq("type", "digital");

      if (deleteError) {
        throw deleteError;
      }

      return res.status(200).json({ ok: true });
    }

    const rawProduct = req.body?.product || {};
    const productId = normalizeText(rawProduct.id);
    const payload = {
      vendor_id: vendorRecord.id,
      type: "digital",
      title: normalizeText(rawProduct.title),
      description: normalizeText(rawProduct.description),
      price: normalizePrice(rawProduct.price),
      category: normalizeText(rawProduct.category),
      tags: normalizeText(rawProduct.tags),
      image_urls: Array.isArray(rawProduct.image_urls) ? rawProduct.image_urls : [],
      is_published: Boolean(rawProduct.is_published),
    };

    if (!payload.title) {
      return res.status(400).json({ error: "Title is required" });
    }

    let saved;

    if (productId) {
      const { data, error } = await supabaseAdmin
        .from("products")
        .update(payload)
        .eq("id", productId)
        .eq("vendor_id", vendorRecord.id)
        .eq("type", "digital")
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      saved = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("products")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      saved = data;
    }

    return res.status(200).json({ ok: true, product: saved });
  } catch (error) {
    console.error("vendor-digital-products error", error);
    return res.status(500).json({ error: error?.message || "Failed to save digital product" });
  }
}
