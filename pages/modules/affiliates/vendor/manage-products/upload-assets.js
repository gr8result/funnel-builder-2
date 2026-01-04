// /pages/modules/affiliates/vendor/manage-products/upload-assets.js
// ✅ Vendor Creative Assets Manager (with Categories + Filtering)
// Vendors can upload creative assets (banners, ad copy, etc.) and affiliates can filter by category.

import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../../utils/supabase-client";
import ICONS from "../../../../../components/iconMap";

export default function UploadAssets() {
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", link: "", category: "Banner" });
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    loadAssets();
  }, []);

  async function loadAssets() {
    const { data, error } = await supabase.from("vendor_assets").select("*").order("created_at", { ascending: false });
    if (!error) setAssets(data || []);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return alert("Please select an image file first.");
    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("vendor-assets").upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("vendor-assets").getPublicUrl(fileName);
      const imageUrl = publicUrlData.publicUrl;

      const { error: insertError } = await supabase.from("vendor_assets").insert([
        {
          title: form.title,
          description: form.description,
          link: form.link,
          category: form.category,
          image_url: imageUrl,
        },
      ]);

      if (insertError) throw insertError;

      setForm({ title: "", description: "", link: "", category: "Banner" });
      setFile(null);
      loadAssets();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Check console for details.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this asset?")) return;
    const { error } = await supabase.from("vendor_assets").delete().eq("id", id);
    if (!error) loadAssets();
  }

  const categories = ["All", "Banner", "Ad Copy", "Social Post", "Email Swipe", "Video", "Other"];
  const filteredAssets = filter === "All" ? assets : assets.filter((a) => a.category === filter);

  const page = {
    wrap: { minHeight: "100vh", background: "#0c121a", color: "#fff", padding: "28px 22px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" },
    inner: { width: "100%", maxWidth: 1320, margin: "0 auto" },
    banner: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ef4444", borderRadius: 12, padding: "14px 18px", fontWeight: 700, marginBottom: 24 },
    form: { display: "flex", flexDirection: "column", gap: 12, background: "#111827", borderRadius: 12, border: "1px solid #ef4444", padding: 20, marginBottom: 30 },
    input: { background: "#0f172a", color: "#fff", border: "1px solid #374151", borderRadius: 8, padding: 10, width: "100%" },
    button: { background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontWeight: 600 },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 18 },
    card: { background: "#111827", border: "1px solid #ef4444", borderRadius: 12, overflow: "hidden", textAlign: "center", paddingBottom: 12 },
    img: { width: "100%", height: 180, objectFit: "cover" },
    delBtn: { background: "transparent", color: "#ef4444", border: "none", cursor: "pointer", fontSize: 13, marginTop: 6 },
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
              <h1 style={{ fontSize: 22, margin: 0 }}>Vendor Creative Assets</h1>
              <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }}>
                Upload banners, ad copy, and resources for your affiliates.
              </p>
            </div>
            <Link href="/modules/affiliates/affiliate-marketplace">
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

          {/* Upload Form */}
          <form onSubmit={handleUpload} style={page.form}>
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
                  fontSize: 13,
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
                  <p style={{ fontSize: 13, opacity: 0.8, padding: "0 10px" }}>
                    {a.description || "—"}
                  </p>
                  <p style={{ fontSize: 12, opacity: 0.7, margin: "4px 0" }}>
                    {a.category}
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
                        fontSize: 12,
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
