// /pages/modules/affiliates/vendor/manage-products/upload-assets.js
// ✅ Vendor Creative Assets Manager (with Categories + Filtering)
// Vendors can upload creative assets (banners, ad copy, etc.) and affiliates can filter by category.

import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../../utils/supabase-client";
import ICONS from "../../../../../components/iconMap";
import VendorUserBanner from "../../../../../components/vendor/VendorUserBanner";


export default function UploadAssets() {
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", link: "", category: "Banner", product_id: "" });
  const [filter, setFilter] = useState("All");
  const [products, setProducts] = useState([]);
  const [vendorId, setVendorId] = useState("");

  useEffect(() => {
    loadAssets();
    loadProducts();
  }, []);

  function getAssetCategory(asset) {
    return asset?.category || asset?.asset_type || "Other";
  }

  async function loadProducts() {
    let resolvedUserId = null;
    let resolvedAuthUserId = null;
    let resolvedEmail = "";

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      resolvedUserId = user.id;
      resolvedAuthUserId = user.id;
      resolvedEmail = user.email || "";
    }

    const marketplaceCode =
      typeof window !== "undefined"
        ? localStorage.getItem("xchange_user_code") || ""
        : "";

    if (marketplaceCode) {
      try {
        const accessResp = await fetch(
          `/api/marketplace/vendor-access?code=${encodeURIComponent(marketplaceCode)}`
        );
        const accessPayload = await accessResp.json();

        if (accessResp.ok && accessPayload?.allowed) {
          resolvedUserId = accessPayload.userId || resolvedUserId;
          resolvedAuthUserId =
            accessPayload.authUserId || accessPayload.userId || resolvedAuthUserId;
          resolvedEmail = accessPayload.email || resolvedEmail;
        }
      } catch (error) {
        console.error("Marketplace vendor context lookup failed:", error);
      }
    }

    if (!resolvedUserId && !resolvedAuthUserId && !resolvedEmail) {
      setProducts([]);
      setVendorId("");
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

    setVendorId(vendorRecord?.id || resolvedUserId || "");

    let affiliateProds = [];
    let lastError = null;

    if (resolvedAuthUserId) {
      const { data, error } = await supabase
        .from("affiliate_products")
        .select("id, title, is_active")
        .eq("owner_user_id", resolvedAuthUserId)
        .or("is_active.eq.true,is_active.is.null")
        .order("created_at", { ascending: false });

      affiliateProds = data || [];
      lastError = error;
    }

    if (!affiliateProds.length && resolvedUserId && resolvedUserId !== resolvedAuthUserId) {
      const { data, error } = await supabase
        .from("affiliate_products")
        .select("id, title, is_active")
        .eq("owner_user_id", resolvedUserId)
        .or("is_active.eq.true,is_active.is.null")
        .order("created_at", { ascending: false });

      affiliateProds = data || [];
      lastError = error;
    }

    if (lastError) {
      console.error("Affiliate product lookup failed:", lastError);
    }

    setProducts(affiliateProds || []);
  }

  async function loadAssets() {
    const { data, error } = await supabase.from("vendor_assets").select("*").order("created_at", { ascending: false });
    if (!error) setAssets(data || []);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return alert("Please select an image file first.");
    if (!form.product_id) return alert("Please select a product for this asset.");
    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${vendorId}/${form.product_id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("vendor-assets").upload(fileName, file);
      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Upload failed: ' + uploadError.message);
        return;
      }

      const { data: publicUrlData, error: publicUrlError } = supabase.storage.from("vendor-assets").getPublicUrl(fileName);
      if (publicUrlError) {
        console.error('Get public URL error:', publicUrlError);
        alert('Failed to get public URL: ' + publicUrlError.message);
        return;
      }
      const imageUrl = publicUrlData?.publicUrl;
      if (!imageUrl) {
        alert('Image URL is missing after upload.');
        return;
      }

      const baseRow = {
        title: form.title,
        description: form.description,
        link: form.link,
        image_url: imageUrl,
        product_id: form.product_id,
      };

      // Handle schema differences across environments:
      // some DBs use category, some use asset_type, some neither.
      let insertError = null;

      {
        const attempt = await supabase.from("vendor_assets").insert([
          {
            ...baseRow,
            category: form.category,
          },
        ]);
        insertError = attempt.error || null;
      }

      if (insertError && /category/i.test(insertError.message || "")) {
        const attempt = await supabase.from("vendor_assets").insert([
          {
            ...baseRow,
            asset_type: form.category,
          },
        ]);
        insertError = attempt.error || null;
      }

      if (insertError && /asset_type/i.test(insertError.message || "")) {
        const attempt = await supabase.from("vendor_assets").insert([baseRow]);
        insertError = attempt.error || null;
      }

      if (insertError) {
        console.error("Insert error:", insertError);
        alert("Database insert failed: " + insertError.message);
        return;
      }

      setForm({ title: "", description: "", link: "", category: "Banner", product_id: "" });
      setFile(null);
      loadAssets();
    } catch (err) {
      console.error("Unexpected error during upload:", err);
      alert("Unexpected error during upload. Check console for details.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this asset?")) return;
    const { error } = await supabase.from("vendor_assets").delete().eq("id", id);
    if (!error) loadAssets();
  }

  async function handleAiDescription() {
    if (!String(form.title || "").trim()) {
      alert("Please enter an asset title first.");
      return;
    }

    try {
      setGeneratingDescription(true);
      const resp = await fetch("/api/ai/generate-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          price: "",
          tags: "affiliate creative asset",
        }),
      });

      const payload = await resp.json();
      if (!resp.ok || !payload?.description) {
        throw new Error(payload?.error || "Failed to generate description.");
      }

      setForm((prev) => ({ ...prev, description: String(payload.description).trim() }));
    } catch (err) {
      console.error("AI asset description failed:", err);
      alert(`❌ ${err.message || "Could not generate description."}`);
    } finally {
      setGeneratingDescription(false);
    }
  }

  const categories = ["All", "Banner", "Ad Copy", "Social Post", "Email Swipe", "Video", "Other"];
  const filteredAssets = filter === "All"
    ? assets
    : assets.filter((a) => getAssetCategory(a) === filter);

  const page = {
    wrap: { minHeight: "100vh", background: "#0c121a", color: "#fff", padding: "28px 22px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" },
    inner: { width: "100%", maxWidth: 1320, margin: "0 auto" },
    banner: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ef4444", borderRadius: 12, padding: "14px 18px", fontWeight: 600, marginBottom: 24 },
    form: { display: "flex", flexDirection: "column", gap: 12, background: "#111827", borderRadius: 12, border: "1px solid #ef4444", padding: 20, marginBottom: 30 },
    input: { background: "#0f172a", color: "#fff", border: "1px solid #374151", borderRadius: 8, padding: 10, width: "100%" },
    button: { background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontWeight: 600 },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 18 },
    card: { background: "#111827", border: "1px solid #ef4444", borderRadius: 12, overflow: "hidden", textAlign: "center", paddingBottom: 12 },
    img: { width: "100%", height: 180, objectFit: "cover" },
    delBtn: { background: "transparent", color: "#ef4444", border: "none", cursor: "pointer", fontSize: 16, marginTop: 6 },
  };

  return (
    <>
      <Head>
        <title>Vendor Creative Assets | GR8 RESULT</title>
      </Head>
      <main style={page.wrap}>
        <div style={page.inner}>
          <div style={page.banner}>
            <div>
              <h1 style={{ fontSize: 48, fontWeight: 600, margin: 0 }}>Vendor Creative Assets</h1>
              <p style={{ fontSize: 18, opacity: 0.9, margin: 0 }}>
                Upload banners, ad copy, and resources for your affiliates.
              </p>
            </div>
            <Link href="/modules/vendor">
              <button
                style={{
                  background: "#1e293b",
                  color: "#fff",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
            </Link>
          </div>

          <VendorUserBanner />

          {/* Upload Form */}
          <form onSubmit={handleUpload} style={page.form}>
            <select
              value={form.product_id}
              onChange={e => setForm({ ...form, product_id: e.target.value })}
              style={page.input}
              required
            >
              <option value="">Select Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Asset Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={page.input}
              required
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ ...page.input, minHeight: 80 }}
            />
            <button
              type="button"
              onClick={handleAiDescription}
              style={{ ...page.button, background: "#f97316" }}
              disabled={uploading || generatingDescription}
            >
              {generatingDescription ? "Starting..." : "Start with AI"}
            </button>
            <input
              type="url"
              placeholder="Tracking Link (optional)"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              style={page.input}
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              style={page.input}
            >
              {categories.slice(1).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files[0])}
              style={page.input}
              required
            />
            <button type="submit" style={page.button} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload Asset"}
            </button>
          </form>

          {/* Filter Buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                style={{
                  background: filter === cat ? "#ef4444" : "#1f2937",
                  color: "#fff",
                  border: "1px solid #ef4444",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Asset Grid */}
          <div style={page.grid}>
            {filteredAssets.length > 0 ? (
              filteredAssets.map((a) => (
                <div key={a.id} style={page.card}>
                  <img src={a.image_url} alt={a.title} style={page.img} />
                  <h3 style={{ margin: "8px 0 4px" }}>{a.title}</h3>
                  <p style={{ fontSize: 16, opacity: 0.8, padding: "0 10px" }}>
                    {a.description || "—"}
                  </p>
                  <p style={{ fontSize: 16, opacity: 0.7, margin: "4px 0" }}>
                    {getAssetCategory(a)}
                  </p>
                  {a.link && (
                    <button
                      onClick={() => navigator.clipboard.writeText(a.link)}
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontSize: 16,
                        marginTop: 4,
                      }}
                    >
                      Copy Link
                    </button>
                  )}
                  <button onClick={() => handleDelete(a.id)} style={page.delBtn}>
                    Delete
                  </button>
                </div>
              ))
            ) : (
              <p>No assets uploaded yet.</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
