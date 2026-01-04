// /pages/modules/affiliates/affiliate-marketplace/submit.js 
// Updated: Added Sale Price, auto Revenue Per Sale, Affiliate Link (optional), and 4 extra image uploads.
// Banner updated to match other module banners.

import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../../../utils/supabase-client";
import ICONS from "../../../../../components/iconMap";

export default function SubmitProduct() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [salesPageUrl, setSalesPageUrl] = useState("");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [commission, setCommission] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [revenuePerSale, setRevenuePerSale] = useState(0);
  const [category, setCategory] = useState("");
  const [thumbnail, setThumbnail] = useState(null);
  const [extraImages, setExtraImages] = useState([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [extraPreviews, setExtraPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const categories = [
    "Coaching & Courses",
    "Health & Fitness",
    "Digital Marketing",
    "Ecommerce",
    "Software & Tools",
    "Finance & Crypto",
    "Beauty & Skincare",
  ];

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    setThumbnail(file);
    if (file) setPreviewUrl(URL.createObjectURL(file));
  };

  const handleExtraImagesChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 4);
    setExtraImages(files);
    const previews = files.map((f) => URL.createObjectURL(f));
    setExtraPreviews(previews);
  };

  const handleCommissionChange = (value) => {
    setCommission(value);
    if (salePrice && value) {
      const revenue = (
        parseFloat(salePrice) *
        (parseFloat(value) / 100)
      ).toFixed(2);
      setRevenuePerSale(revenue);
    } else {
      setRevenuePerSale(0);
    }
  };

  const handleSalePriceChange = (value) => {
    setSalePrice(value);
    if (commission && value) {
      const revenue = (
        parseFloat(value) *
        (parseFloat(commission) / 100)
      ).toFixed(2);
      setRevenuePerSale(revenue);
    } else {
      setRevenuePerSale(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("User not logged in or missing");

      // ✅ Upload thumbnail
      let thumbnailUrl = "";
      if (thumbnail) {
        const ext = thumbnail.name.split(".").pop();
        const fileName = `${Date.now()}_main.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("thumbnails")
          .upload(fileName, thumbnail);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage
          .from("thumbnails")
          .getPublicUrl(fileName);
        thumbnailUrl = data.publicUrl;
      }

      // ✅ Upload extra images (up to 4)
      const extraImageUrls = [];
      for (const file of extraImages) {
        const ext = file.name.split(".").pop();
        const name = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
        const { error: uploadErr } = await supabase.storage
          .from("thumbnails")
          .upload(name, file);
        if (uploadErr) throw uploadErr;
        const { data } = supabase.storage
          .from("thumbnails")
          .getPublicUrl(name);
        extraImageUrls.push(data.publicUrl);
      }

      // ✅ Insert into database
      const { error } = await supabase.from("products").insert([
        {
          title,
          description,
          sales_page_url: salesPageUrl,
          affiliate_link: affiliateLink,
          sale_price: salePrice,
          commission,
          revenue_per_sale: revenuePerSale,
          category,
          thumbnail_url: thumbnailUrl,
          extra_images: extraImageUrls,
          merchant_id: user.id,
        },
      ]);

      if (error) throw error;

      alert("✅ Product submitted successfully!");
      router.push(
        "/modules/affiliates/affiliate-marketplace/manage-products"
      );
    } catch (err) {
      console.error("Error saving product:", err.message);
      setErrorMsg("❌ Error submitting product. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>
        {/* Banner */}
        <div style={styles.banner}>
          <div style={styles.bannerLeft}>
            <div style={styles.bannerIconBox}>
              {ICONS.products &&
                ICONS.products({ size: 34, color: "#fff" })}
            </div>
            <div>
              <h1 style={styles.bannerTitle}>Submit a New Product</h1>
              <p style={styles.bannerSub}>
                Submit products to be sold by other affiliates for you.
              </p>
            </div>
          </div>
          <button style={styles.backBtn} onClick={() => router.back()}>
            ← Back
          </button>
        </div>

        <div style={styles.grid}>
          <form onSubmit={handleSubmit} style={styles.formBox}>
            <label>Product Title:</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={styles.input}
            />

            <label>Description:</label>
            <textarea
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={styles.textarea}
            />

            <label>Sales Page URL:</label>
            <input
              type="url"
              value={salesPageUrl}
              onChange={(e) => setSalesPageUrl(e.target.value)}
              style={styles.input}
            />

            <label>Affiliate Link (optional):</label>
            <input
              type="url"
              value={affiliateLink}
              onChange={(e) => setAffiliateLink(e.target.value)}
              placeholder="https://your-affiliate-link.com"
              style={styles.input}
            />

            <label>Sale Price ($):</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) => handleSalePriceChange(e.target.value)}
              style={styles.input}
            />

            <label>Commission (%):</label>
            <input
              type="number"
              min="0"
              max="100"
              value={commission}
              onChange={(e) => handleCommissionChange(e.target.value)}
              style={styles.input}
            />

            <label>Revenue Per Sale ($):</label>
            <input
              type="text"
              value={revenuePerSale || "0.00"}
              readOnly
              style={{ ...styles.input, background: "#1f2937" }}
            />

            <label>Category:</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={styles.select}
            >
              <option value="">Select a category...</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <label>Thumbnail Image:</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
            />

            <label>Additional Images (up to 4):</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleExtraImagesChange}
            />

            {errorMsg && <p style={styles.error}>{errorMsg}</p>}

            <button type="submit" disabled={loading} style={styles.saveBtn}>
              {loading ? "Saving..." : "Save Product"}
            </button>
          </form>

          <div style={styles.previewBox}>
            <h3 style={styles.previewTitle}>Preview</h3>
            <div style={styles.previewFrame}>
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={styles.previewImg}
                />
              ) : (
                <p>No image selected</p>
              )}
            </div>

            <div style={styles.extraPreviewWrap}>
              {extraPreviews.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Extra ${i + 1}`}
                  style={styles.extraImg}
                />
              ))}
            </div>

            <div style={styles.previewText}>
              <strong>{title || "Product Title"}</strong>
              <p>{description || "Product description will appear here."}</p>
              <p>
                <strong>Sale Price:</strong> ${salePrice || "0.00"}
              </p>
              <p>
                <strong>Commission:</strong> {commission || "0"}%
              </p>
              <p>
                <strong>Revenue Per Sale:</strong> $
                {revenuePerSale || "0.00"}
              </p>
              {affiliateLink && (
                <p>
                  <strong>Affiliate Link:</strong>{" "}
                  <a
                    href={affiliateLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#f97316" }}
                  >
                    Visit Link
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
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
    display: "flex",
    justifyContent: "center",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  inner: { width: "100%", maxWidth: 1320 },

  // Banner styling to match other modules
  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#f97316",
    color: "#fff",
    padding: "26px 30px",
    borderRadius: 14,
    marginBottom: 26,
  },
  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  bannerIconBox: {
    width: 58,
    height: 58,
    borderRadius: 14,
    background: "rgba(0,0,0,0.25)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  bannerTitle: {
    fontSize: 28,
    fontWeight: 900,
    margin: 0,
  },
  bannerSub: {
    fontSize: 15,
    opacity: 0.95,
    marginTop: 4,
    marginBottom: 0,
  },
  backBtn: {
    background: "rgba(0,0,0,0.25)",
    color: "#fff",
    border: "2px solid rgba(255,255,255,0.4)",
    borderRadius: 12,
    padding: "10px 18px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  formBox: {
    background: "#0c121a",
    border: "1px solid #f97316",
    borderRadius: 10,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  previewBox: {
    background: "#0c121a",
    border: "1px solid #f97316",
    borderRadius: 10,
    padding: 18,
    textAlign: "center",
  },
  previewFrame: {
    border: "1px dashed #f97316",
    padding: 10,
    borderRadius: 8,
    minHeight: 200,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImg: {
    maxWidth: "100%",
    borderRadius: 8,
  },
  extraPreviewWrap: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  extraImg: {
    width: 80,
    height: 80,
    objectFit: "cover",
    borderRadius: 6,
    border: "1px solid #f97316",
  },
  previewTitle: { color: "#f97316", fontWeight: 700, marginBottom: 10 },
  previewText: { marginTop: 10, textAlign: "left" },

  input: {
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: 6,
    padding: "8px 10px",
    color: "#fff",
  },
  textarea: {
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: 6,
    padding: "8px 10px",
    color: "#fff",
  },
  select: {
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: 6,
    padding: "8px 10px",
    color: "#fff",
  },
  saveBtn: {
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "10px",
    fontWeight: 700,
    marginTop: 10,
    cursor: "pointer",
  },
  error: { color: "#ef4444", fontWeight: 700 },
};
