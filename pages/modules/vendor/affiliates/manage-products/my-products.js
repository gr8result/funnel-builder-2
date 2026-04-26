// /pages/modules/affiliates/vendor/manage-products/my-products.js
// FULL REPLACEMENT
//
// ✅ Banner standardized
// ✅ Includes Affiliate + Physical + Digital + Courses
// ✅ Grouped by product type with visual separators
// ✅ Safe numeric rendering
// ✅ Proper delete handling per table
// ✅ Preserved formatting and structure


import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../../utils/supabase-client";
import ICONS from "../../../../../components/iconMap";
import VendorUserBanner from "../../../../../components/vendor/VendorUserBanner";

export default function MyProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        setUser(data.user);
      } else {
        // Marketplace sessions may not have a Supabase auth user; keep null and resolve via code fallback.
        setUser({ id: null, email: null });
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!user) return;
      setLoading(true);

      let resolvedUserId = user?.id || null;
      let resolvedEmail = user?.email || "";
      let resolvedAuthUserId = user?.id || null; // auth.users UUID (may differ from public.users UUID)
      const marketplaceCode =
        typeof window !== "undefined"
          ? localStorage.getItem("xchange_user_code") || ""
          : "";

      if (!resolvedUserId && marketplaceCode) {
        try {
          const accessResp = await fetch(
            `/api/marketplace/vendor-access?code=${encodeURIComponent(marketplaceCode)}`
          );
          const accessPayload = await accessResp.json();
          if (accessResp.ok && accessPayload?.allowed) {
            resolvedUserId = accessPayload.userId || resolvedUserId;
            resolvedAuthUserId = accessPayload.authUserId || accessPayload.userId || resolvedUserId;
            resolvedEmail = accessPayload.email || resolvedEmail;
          }
        } catch (error) {
          console.error("Marketplace user context lookup failed:", error);
        }
      }

      if (!resolvedUserId && !resolvedEmail) {
        setProducts([]);
        setLoading(false);
        return;
      }

      let vendorRecord = null;
      if (resolvedUserId) {
        const byId = await supabase
          .from("vendors")
          .select("id")
          .eq("user_id", resolvedUserId)
          .maybeSingle();
        vendorRecord = byId.data;
      }

      if (!vendorRecord?.id && resolvedEmail) {
        const byEmail = await supabase
          .from("vendors")
          .select("id")
          .ilike("email", resolvedEmail)
          .maybeSingle();
        vendorRecord = byEmail.data || vendorRecord;
      }

      const vendorId = vendorRecord?.id;

      let courseVendorRecord = null;
      if (resolvedUserId) {
        const byId = await supabase
          .from("course_vendors")
          .select("id")
          .eq("user_id", resolvedUserId)
          .maybeSingle();
        courseVendorRecord = byId.data;
      }

      if (!courseVendorRecord?.id && marketplaceCode) {
        try {
          const resp = await fetch(
            `/api/marketplace/course-vendor-context?code=${encodeURIComponent(marketplaceCode)}`
          );
          const payload = await resp.json();
          if (resp.ok && payload?.courseVendor?.id) {
            courseVendorRecord = payload.courseVendor;
            resolvedUserId = payload.userId || resolvedUserId;
          }
        } catch (error) {
          console.error("Course vendor context lookup failed:", error);
        }
      }

      const courseVendorId = courseVendorRecord?.id;

      // 1️⃣ Affiliate products — use auth UUID (owner_user_id FK → auth.users)
      const { data: affiliateData } = await supabase
        .from("affiliate_products")
        .select("*")
        .eq("owner_user_id", resolvedAuthUserId)
        .order("created_at", { ascending: false });

      let affiliateProducts =
        affiliateData?.map((p) => ({
          ...p,
          source: "affiliate_products",
          type: "Affiliate",
          image_url: p.image_url,
          sale_price: p.sale_price,
        })) || [];

      if (affiliateProducts.length > 0) {
        const ids = affiliateProducts.map((p) => p.id);

        const { data: affiliates } = await supabase
          .from("affiliate_applications")
          .select("product_id, status")
          .in("product_id", ids)
          .eq("status", "approved");

        const affiliateCounts = {};
        (affiliates || []).forEach((a) => {
          affiliateCounts[a.product_id] =
            (affiliateCounts[a.product_id] || 0) + 1;
        });

        affiliateProducts = affiliateProducts.map((p) => ({
          ...p,
          active_affiliates: affiliateCounts[p.id] || 0,
        }));
      }

      // 2️⃣ Physical + Digital
      let physicalDigitalProducts = [];

      if (vendorId) {
        const { data: prodData } = await supabase
          .from("products")
          .select("*")
          .eq("vendor_id", vendorId)
          .order("created_at", { ascending: false });

        physicalDigitalProducts =
          prodData?.map((p) => ({
            ...p,
            source: "products",
            type:
              p.type === "physical"
                ? "Physical"
                : p.type === "digital"
                ? "Digital"
                : p.type,
            sale_price: p.price,
            image_url: Array.isArray(p.image_urls)
              ? p.image_urls[0]
              : null,
            commission_value: null,
            commission_type: null,
            platform_commission: null,
            affiliate_revenue_per_sale: null,
            vendor_revenue_per_sale: null,
            gravity: null,
            epc: null,
            active_affiliates: null,
          })) || [];
      }

      // 3️⃣ Courses
      let courseProducts = [];

      if (courseVendorId) {
        const { data: courseData } = await supabase
          .from("courses")
          .select("*")
          .eq("vendor_id", courseVendorId)
          .order("created_at", { ascending: false });

        courseProducts =
          courseData?.map((c) => ({
            ...c,
            source: "courses",
            type: "Course",
            sale_price: c.price,
            image_url: c.cover_url,
            commission_value: null,
            commission_type: null,
            platform_commission: null,
            affiliate_revenue_per_sale: null,
            vendor_revenue_per_sale: null,
            gravity: null,
            epc: null,
            active_affiliates: null,
          })) || [];
      }

      const allProducts = [
        ...affiliateProducts,
        ...physicalDigitalProducts,
        ...courseProducts,
      ];

      setProducts(allProducts);
      setLoading(false);
    };

    fetchProducts();
  }, [user]);

  const handleDelete = async (id, source) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    const { error } = await supabase.from(source).delete().eq("id", id);

    if (!error) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert(error.message);
    }
  };

  const safeMoney = (value) => {
    if (typeof value !== "number") return "-";
    return `$${value.toFixed(2)}`;
  };

  const safePercent = (value, type) => {
    if (typeof value !== "number") return "-";
    return type === "percentage" ? `${value}%` : `$${value}`;
  };

  // 🔥 Group products by type
  const grouped = products.reduce((acc, product) => {
    if (!acc[product.type]) acc[product.type] = [];
    acc[product.type].push(product);
    return acc;
  }, {});

  const orderedTypes = ["Affiliate", "Physical", "Digital", "Course"];

  return (
    <div style={{ minHeight: "100vh", background: "#0c121a", color: "#fff", padding: 28 }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>

        {/* Banner */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#10b981",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {ICONS.products({ size: 48, color: "#fff" })}
            <div>
              <h1 style={{ fontSize: 48, fontWeight: 550, margin: 0 }}>
                My Products
              </h1>
              <p style={{ fontSize: 18, margin: 0 }}>
                View, edit, upload, or remove your product listings.
              </p>
            </div>
          </div>

          <Link href="/modules/vendor/affiliates/manage-products">
            <button style={{
              background: "#1e293b",
              border: "1px solid #334155",
              padding: "10px 18px",
              fontSize: 18,
              color: "#fff",
              borderRadius: 8
            }}>
              ← Back
            </button>
          </Link>
        </div>

        <VendorUserBanner />

        <table style={{
          width: "100%",
          background: "#111827",
          borderRadius: 12,
          borderCollapse: "collapse"
        }}>
          <thead>
            <tr>
              <th style={{ padding: 12 }}>Image</th>
              <th style={{ width: 260, textAlign: "left" }}>Product</th>
              <th>Type</th>
              <th>Sale Price</th>
              <th>Commission</th>
              <th>Platform</th>
              <th>Affiliate</th>
              <th>Vendor</th>
              <th>Gravity</th>
              <th>EPC</th>
              <th># Affiliates</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="12" style={{ textAlign: "center", padding: 20 }}>
                  Loading...
                </td>
              </tr>
            ) : (
              orderedTypes.map(type =>
                grouped[type] ? (
                  <>
                    {/* 🔥 Type Separator */}
                    <tr key={type}>
                      <td colSpan="12" style={{
                        background: "#0f172a",
                        padding: "14px 20px",
                        fontWeight: 600,
                        fontSize: 36,
                        color: "#26bdf8"
                      }}>
                        {type} Products
                      </td>
                    </tr>

                    {grouped[type].map((p) => (
                      <tr key={p.id}>
                        <td style={{ padding: 12 }}>
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt=""
                              style={{ width: 120, borderRadius: 8 }}
                            />
                          ) : "—"}
                        </td>
                        <td
                          style={{
                            maxWidth: 260,
                            minWidth: 220,
                            whiteSpace: "normal",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            lineHeight: 1.35,
                            paddingRight: 8,
                          }}
                          title={p.title || ""}
                        >
                          {p.title}
                        </td>
                        <td>{p.type}</td>
                        <td>{safeMoney(p.sale_price)}</td>
                        <td>{safePercent(p.commission_value, p.commission_type)}</td>
                        <td>{safeMoney(p.platform_commission)}</td>
                        <td>{safeMoney(p.affiliate_revenue_per_sale)}</td>
                        <td>{safeMoney(p.vendor_revenue_per_sale)}</td>
                        <td>{typeof p.gravity === "number" ? p.gravity : "-"}</td>
                        <td>{typeof p.epc === "number" ? p.epc : "-"}</td>
                        <td>{p.active_affiliates ?? "-"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 10 }}>
                            <button
                              style={{ background: "#f59e42", color: "#fff", padding: "6px 12px", borderRadius: 6 }}
                              onClick={() => alert('Pause functionality coming soon!')}
                            >
                              Pause
                            </button>
                            <button
                              style={{ background: "#3b82f6", color: "#fff", padding: "6px 12px", borderRadius: 6 }}
                              onClick={() =>
                                (window.location.href =
                                  `/modules/vendor/affiliates/manage-products/edit-product-details?id=${p.id}`)
                              }
                            >
                              Edit
                            </button>
                            <button
                              style={{ background: "#dc2626", color: "#fff", padding: "6px 12px", borderRadius: 6 }}
                              onClick={() => handleDelete(p.id, p.source)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ) : null
              )
            )}
          </tbody>
        </table>

      </div>
    </div>
  );
}