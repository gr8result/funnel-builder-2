import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Resolves the auth.users UUID for the given marketplace user.
 * affiliate_products.owner_user_id has a FK → auth.users(id).
 * Marketplace users are stored in public.users with a code-based ID that may
 * not match auth.users, so we look up by both direct ID and email.
 */
async function resolveAuthUserId(marketplaceUserId, email) {
  // 1. Check if the marketplace user ID is already a valid auth.users UUID
  if (marketplaceUserId) {
    const { data: authByIdResult } = await supabaseAdmin.auth.admin.getUserById(marketplaceUserId);
    if (authByIdResult?.user?.id) {
      return authByIdResult.user.id;
    }
  }

  // 2. Look up auth user by email via GoTrue admin REST endpoint
  if (email) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const resp = await fetch(
        `${baseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      );
      if (resp.ok) {
        const body = await resp.json();
        const users = body?.users || body || [];
        const match = Array.isArray(users)
          ? users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
          : null;
        if (match?.id) {
          return match.id;
        }
      }
    } catch (fetchErr) {
      console.warn("Auth user email lookup failed:", fetchErr.message);
    }
  }

  // 3. Nothing found — return null (insert may fail FK; column may allow null)
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const code = normalizeText(req.body?.code);
    const product = req.body?.product || {};

    if (!code) {
      return res.status(400).json({ error: "Missing marketplace code" });
    }

    const { data: marketplaceUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("user_code", code)
      .maybeSingle();

    if (userError || !marketplaceUser?.id) {
      return res.status(403).json({ error: "Invalid marketplace code" });
    }

    let vendorRecord = null;

    const byUserId = await supabaseAdmin
      .from("vendors")
      .select("id, user_id, email")
      .eq("user_id", marketplaceUser.id)
      .maybeSingle();

    if (byUserId.error) throw byUserId.error;
    vendorRecord = byUserId.data;

    if (!vendorRecord?.id && marketplaceUser.email) {
      const byEmail = await supabaseAdmin
        .from("vendors")
        .select("id, user_id, email")
        .ilike("email", marketplaceUser.email)
        .maybeSingle();
      if (byEmail.error) throw byEmail.error;
      vendorRecord = byEmail.data || vendorRecord;
    }

    if (!vendorRecord?.id) {
      return res.status(403).json({ error: "Vendor access denied" });
    }

    const title = normalizeText(product.title);
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Resolve auth.users UUID for the FK constraint
    const resolvedEmail = marketplaceUser.email || vendorRecord.email || "";
    const ownerUserId = await resolveAuthUserId(marketplaceUser.id, resolvedEmail);

    const commissionValue = normalizeNumber(product.commission_value, 0);
    const platformCommission = normalizeNumber(product.platform_commission, 0);
    const affiliateRevenuePerSale = normalizeNumber(product.affiliate_revenue_per_sale, 0);
    const vendorRevenuePerSale = normalizeNumber(product.vendor_revenue_per_sale, 0);

    const payload = {
      title,
      description: normalizeText(product.description),
      sales_page_url: normalizeText(product.sales_page_url),
      affiliate_page_url: normalizeText(product.affiliate_page_url),
      sale_price: normalizeNumber(product.sale_price, 0),
      commission_type: "percentage",
      commission_value: commissionValue,
      platform_commission: platformCommission,
      affiliate_revenue_per_sale: affiliateRevenuePerSale,
      vendor_revenue_per_sale: vendorRevenuePerSale,
      category: normalizeText(product.category),
      image_url: normalizeText(product.image_url),
      extra_images: Array.isArray(product.extra_images) ? product.extra_images : [],
      owner_user_id: ownerUserId,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const { data: created, error: insertError } = await supabaseAdmin
      .from("affiliate_products")
      .insert([payload])
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    return res.status(200).json({ ok: true, id: created?.id || null });
  } catch (error) {
    console.error("vendor-affiliate-products error", error);
    return res.status(500).json({ error: error?.message || "Failed to create affiliate product" });
  }
}
