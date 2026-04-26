import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function normalizeProduct(product, overrides = {}) {
  return {
    id: `${overrides.source || "product"}-${product.id}`,
    name: product.title || product.name || "Untitled",
    type: overrides.type || product.type || "Product",
    description: product.description || "—",
    price:
      product.sale_price != null
        ? product.sale_price
        : product.price != null
        ? product.price
        : "—",
    status: overrides.status || (product.is_published ? "Published" : product.is_active ? "Active" : "Draft"),
    created_at: product.created_at || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const vendorId = req.query.vendorId;
  const userId = req.query.userId;
  const email = req.query.email;

  if (!vendorId && !userId && !email) {
    return res.status(400).json({ error: "Missing vendor lookup details" });
  }

  try {
    const ownerIds = Array.from(new Set([userId].filter(Boolean)));

    if (email) {
      const [accountRes, marketplaceUserRes] = await Promise.all([
        supabaseAdmin.from("accounts").select("id").ilike("email", email).maybeSingle(),
        supabaseAdmin.from("users").select("id").ilike("email", email).maybeSingle(),
      ]);

      if (accountRes.error) throw accountRes.error;
      if (marketplaceUserRes.error) throw marketplaceUserRes.error;

      if (accountRes.data?.id) ownerIds.push(accountRes.data.id);
      if (marketplaceUserRes.data?.id) ownerIds.push(marketplaceUserRes.data.id);
    }

    const resolvedOwnerIds = Array.from(new Set(ownerIds.filter(Boolean)));

    const [productsRes, affiliateRes, courseVendorsRes] = await Promise.all([
      vendorId
        ? supabaseAdmin
            .from("products")
            .select("id, title, description, price, type, is_published, created_at")
            .eq("vendor_id", vendorId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      resolvedOwnerIds.length > 0
        ? supabaseAdmin
            .from("affiliate_products")
            .select("id, title, description, sale_price, is_active, created_at")
            .in("owner_user_id", resolvedOwnerIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      resolvedOwnerIds.length > 0
        ? supabaseAdmin
            .from("course_vendors")
            .select("id, user_id")
            .in("user_id", resolvedOwnerIds)
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (productsRes.error) throw productsRes.error;
    if (affiliateRes.error) throw affiliateRes.error;
    if (courseVendorsRes.error) throw courseVendorsRes.error;

    let courses = [];
    const courseVendorIds = (courseVendorsRes.data || []).map((vendor) => vendor.id).filter(Boolean);
    if (courseVendorIds.length > 0) {
      const coursesRes = await supabaseAdmin
        .from("courses")
        .select("id, title, description, price, is_published, created_at")
        .in("vendor_id", courseVendorIds)
        .order("created_at", { ascending: false });

      if (coursesRes.error) throw coursesRes.error;
      courses = coursesRes.data || [];
    }

    const mergedProducts = [
      ...(productsRes.data || []).map((product) =>
        normalizeProduct(product, {
          source: "products",
          type: product.type === "digital" ? "Digital" : product.type === "physical" ? "Physical" : product.type || "Product",
          status: product.is_published ? "Published" : "Draft",
        })
      ),
      ...(affiliateRes.data || []).map((product) =>
        normalizeProduct(product, {
          source: "affiliate_products",
          type: "Affiliate",
          status: product.is_active ? "Active" : "Inactive",
        })
      ),
      ...courses.map((course) =>
        normalizeProduct(course, {
          source: "courses",
          type: "Course",
          status: course.is_published ? "Published" : "Draft",
        })
      ),
    ].sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));

    return res.status(200).json({ products: mergedProducts });
  } catch (error) {
    console.error("Admin vendor products error:", error);
    return res.status(500).json({ error: error.message || "Failed to load vendor products" });
  }
}