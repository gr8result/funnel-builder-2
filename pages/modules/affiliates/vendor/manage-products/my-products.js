// /pages/modules/affiliates/vendor/manage-products/my-products.js
// Shows only products owned by the logged-in user (user_id column)

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../../utils/supabase-client";
import ICONS from "../../../../../components/iconMap";

export default function MyProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Get logged-in user
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) setUser(data.user);
    };
    getUser();
  }, []);

  // Fetch products owned by the logged-in user (user_id)
  useEffect(() => {
    const fetchProducts = async () => {
      if (!user) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user.id) // 👈 IMPORTANT: match user_id, not merchant_id
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching products:", error);
      } else {
        setProducts(data || []);
      }

      setLoading(false);
    };

    fetchProducts();
  }, [user]);

  // Delete product
  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      alert("Error deleting product: " + error.message);
    } else {
      setProducts((current) => current.filter((p) => p.id !== id));
    }
  };

  const page = {
    wrap: {
      minHeight: "100vh",
      background: "#0c121a",
      color: "#fff",
      padding: "28px 22px",
    },
    inner: { width: "100%", maxWidth: 1320, margin: "0 auto" },
    banner: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#10b981",
      borderRadius: 12,
      padding: "14px 18px",
      marginBottom: 24,
    },
    table: {
      width: "100%",
      background: "#111827",
      borderRadius: 12,
      borderCollapse: "collapse",
    },
    th: {
      textAlign: "left",
      padding: "12px 16px",
      borderBottom: "1px solid #1f2937",
      fontWeight: 600,
      color: "#ccc",
    },
    td: {
      padding: "12px 16px",
      borderBottom: "1px solid #1f2937",
      verticalAlign: "middle",
    },
    thumb: {
      width: 60,
      height: 60,
      borderRadius: 10,
      objectFit: "cover",
      border: "1px solid #f97316",
    },
    link: {
      color: "#f97316",
      textDecoration: "none",
      fontSize: 13,
    },
  };

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        {/* Banner */}
        <div style={page.banner}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {ICONS.products({ size: 32 })}
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                My Products
              </h1>
              <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }}>
                View, edit, upload, or remove your product listings.
              </p>
            </div>
          </div>
          <Link href="/modules/affiliates/affiliate-marketplace/manage-products">
            <button
              style={{
                background: "#1e293b",
                color: "#fff",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <p>Loading...</p>
        ) : products.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 0",
              opacity: 0.7,
              fontSize: 16,
            }}
          >
            No products found.
          </div>
        ) : (
          <table style={page.table}>
            <thead>
              <tr>
                <th style={page.th}>Thumbnail</th>
                <th style={page.th}>Title</th>
                <th style={page.th}>Category</th>
                <th style={page.th}>Sale Price</th>
                <th style={page.th}>Commission</th>
                <th style={page.th}>Revenue/Sale</th>
                <th style={page.th}>Affiliate Link</th>
                <th style={page.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td style={page.td}>
                    {p.thumbnail_url ? (
                      <img
                        src={p.thumbnail_url}
                        alt={p.title}
                        style={page.thumb}
                      />
                    ) : (
                      <div
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: 10,
                          border: "1px solid #334155",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#888",
                          fontSize: 12,
                        }}
                      >
                        No Image
                      </div>
                    )}
                  </td>
                  <td style={page.td}>{p.title || p.description || "Untitled"}</td>
                  <td style={page.td}>{p.category || "Uncategorised"}</td>
                  <td style={page.td}>${p.sale_price || "0.00"}</td>
                  <td style={page.td}>{p.commission || "0"}%</td>
                  <td style={page.td}>${p.revenue_per_sale || "0.00"}</td>
                  <td style={page.td}>
                    {p.affiliate_link ? (
                      <a
                        href={p.affiliate_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={page.link}
                      >
                        Open
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={page.td}>
                    <button
                      style={{
                        background: "#3b82f6",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 12px",
                        marginRight: 8,
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        (window.location.href = `/modules/affiliates/vendor/manage-products/edit-product-details?id=${p.id}`)
                      }
                    >
                      Edit
                    </button>
                    <button
                      style={{
                        background: "#dc2626",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 12px",
                        cursor: "pointer",
                      }}
                      onClick={() => handleDelete(p.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
