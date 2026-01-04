// /pages/modules/affiliates/affiliate-marketplace/manage-products/index.js
// Updated: shows Sale Price, Commission, Revenue Per Sale, and Affiliate Link (optional)

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../../../utils/supabase-client";
import ICONS from "../../../../../components/iconMap";

export default function ManageProducts() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("User not logged in");

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("merchant_id", user.id)
        .order("id", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error("Error fetching products:", err.message);
      setErrorMsg("❌ Error loading products.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>
        <div style={styles.banner}>
          <span className="banner-icon">{ICONS.products({ size: 24 })}</span>
          <h2 style={{ flex: 1, textAlign: "left" }}>Manage Your Products</h2>
          <button
            style={styles.addBtn}
            onClick={() => router.push("/modules/affiliates/affiliate-marketplace/submit")}
          >
            + Add New
          </button>
        </div>

        {loading ? (
          <p style={styles.loading}>Loading products...</p>
        ) : errorMsg ? (
          <p style={styles.error}>{errorMsg}</p>
        ) : products.length === 0 ? (
          <p style={styles.noProducts}>You haven’t added any products yet.</p>
        ) : (
          <div style={styles.grid}>
            {products.map((p) => (
              <div key={p.id} style={styles.card}>
                <div style={styles.thumbWrap}>
                  {p.thumbnail_url ? (
                    <img
                      src={p.thumbnail_url}
                      alt={p.title}
                      style={styles.thumbnail}
                    />
                  ) : (
                    <div style={styles.noThumb}>No Image</div>
                  )}
                </div>

                <h3 style={styles.title}>{p.title}</h3>
                <p style={styles.category}>{p.category || "Uncategorised"}</p>

                <p style={styles.desc}>
                  {p.description?.length > 120
                    ? p.description.slice(0, 120) + "..."
                    : p.description}
                </p>

                <div style={styles.stats}>
                  <p>
                    <strong>Sale Price:</strong> ${p.sale_price || "0.00"}
                  </p>
                  <p>
                    <strong>Commission:</strong> {p.commission || 0}%
                  </p>
                  <p>
                    <strong>Revenue/Sale:</strong> ${p.revenue_per_sale || "0.00"}
                  </p>
                </div>

                {p.affiliate_link && (
                  <p>
                    <strong>Affiliate Link:</strong>{" "}
                    <a
                      href={p.affiliate_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.link}
                    >
                      Visit Link
                    </a>
                  </p>
                )}

                {p.sales_page_url && (
                  <p>
                    <strong>Sales Page:</strong>{" "}
                    <a
                      href={p.sales_page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.link}
                    >
                      View
                    </a>
                  </p>
                )}

                {Array.isArray(p.extra_images) && p.extra_images.length > 0 && (
                  <div style={styles.extraWrap}>
                    {p.extra_images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt={`Extra ${i + 1}`}
                        style={styles.extraImg}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  inner: { width: "100%", maxWidth: 1320, margin: "0 auto" },
  banner: {
    display: "flex",
    alignItems: "center",
    background: "#f97316",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: 12,
    fontWeight: 700,
    marginBottom: 24,
  },
  addBtn: {
    background: "#000",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "6px 12px",
    cursor: "pointer",
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 20,
  },
  card: {
    background: "#111827",
    border: "1px solid #f97316",
    borderRadius: 10,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  thumbWrap: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #f97316",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#0c121a",
  },
  thumbnail: { width: "100%", height: "100%", objectFit: "cover" },
  noThumb: { color: "#888" },
  title: { fontSize: 18, fontWeight: 700, marginTop: 6 },
  category: { color: "#f97316", fontWeight: 600, fontSize: 14 },
  desc: { fontSize: 14, color: "#ccc", marginTop: 6 },
  stats: { marginTop: 8, fontSize: 14 },
  link: { color: "#f97316", textDecoration: "none" },
  extraWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  extraImg: {
    width: 70,
    height: 70,
    objectFit: "cover",
    borderRadius: 6,
    border: "1px solid #f97316",
  },
  loading: { textAlign: "center", marginTop: 20 },
  noProducts: { textAlign: "center", marginTop: 20 },
  error: { textAlign: "center", color: "#ef4444", fontWeight: 700 },
};
