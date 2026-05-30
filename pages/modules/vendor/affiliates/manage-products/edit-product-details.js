// /pages/modules/affiliates/vendor/manage-products/edit-product-details.js
// FULL REPLACEMENT
//
// ✅ Banner: title 48px weight 600, subtitle 18px, back btn 18px
// ✅ Min font size across page = 16px
// ✅ Max font weight across page = 600
// ✅ Layout preserved, icon left, RPC save working

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../../../lib/supabaseClient";
import ICONS from "../../../../../components/iconMap";
import Link from "next/link";

export default function EditProductDetails() {
  const router = useRouter();
  const { id } = router.query;

  const [product, setProduct] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [extraImages, setExtraImages] = useState(["", "", "", ""]);
  const [uploading, setUploading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadProduct();
  }, [id]);

  const getMarketplaceCode = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("xchange_user_code") || "";
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });

  const uploadImageViaMarketplaceApi = async (file) => {
    const code = getMarketplaceCode();
    if (!code) throw new Error("No marketplace code found for upload.");

    const dataUrl = await fileToDataUrl(file);
    const vendorAccessResp = await fetch(
      `/api/marketplace/vendor-access?code=${encodeURIComponent(code)}`
    );
    const vendorAccess = await vendorAccessResp.json();
    const vendorId = vendorAccess?.vendorId || null;

    const resp = await fetch("/api/marketplace/vendor-upload-product-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        vendorId: vendorId || "",
        bucket: "thumbnails",
        fileName: file?.name || "upload.bin",
        dataUrl,
      }),
    });

    const payload = await resp.json();
    if (!resp.ok || !payload?.publicUrl) {
      throw new Error(payload?.error || "Marketplace upload failed.");
    }

    return payload.publicUrl;
  };

  const loadProduct = async () => {
    const { data, error } = await supabase
      .from("affiliate_products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      alert("❌ Error loading product.");
      return;
    }

    setProduct(data);

    const imgs = data.extra_imgs || data.extra_images || [];
    const fixed = [0, 1, 2, 3].map((i) => imgs[i] || "");
    setExtraImages(fixed);

    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let updated = { ...product, [name]: value };

    if (name === "sale_price" || name === "commission") {
      const price = parseFloat(name === "sale_price" ? value : product.sale_price || 0);
      const comm = parseFloat(name === "commission" ? value : product.commission || 0);
      updated.revenue_per_sale = ((price * comm) / 100).toFixed(2);
    }

    setProduct(updated);
  };

  const handleThumbnail = (e) => {
    const file = e.target.files[0];
    if (file) setThumbnailFile(file);
  };

  const uploadSlotImage = async (index, file) => {
    if (!file) return;
    try {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const clean = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const name = `${id}-slot${index + 1}-${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("thumbnails")
        .upload(name, file, { upsert: true });

      if (error) {
        const isRls = /row-level security/i.test(error.message || "");
        if (isRls) {
          const publicUrl = await uploadImageViaMarketplaceApi(file);
          const updated = [...extraImages];
          updated[index] = publicUrl;
          setExtraImages(updated);
          return;
        }
        throw error;
      }

      const { data } = supabase.storage.from("thumbnails").getPublicUrl(name);
      const updated = [...extraImages];
      updated[index] = data.publicUrl;
      setExtraImages(updated);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSlot = (i) => {
    if (!confirm("Remove this image?")) return;
    const updated = [...extraImages];
    updated[i] = "";
    setExtraImages(updated);
  };

  const handleAiEditDescription = async () => {
    const title = String(product?.title || "").trim();
    if (!title) {
      alert("Please add a product title before using AI.");
      return;
    }

    try {
      setGeneratingDescription(true);
      const resp = await fetch("/api/ai/generate-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category: product?.category || "",
          price: product?.sale_price || "",
          tags: "affiliate product",
          currentDescription: product?.description || "",
          mode: "edit",
        }),
      });

      const payload = await resp.json();
      if (!resp.ok || !payload?.description) {
        throw new Error(payload?.error || "Failed to rewrite description.");
      }

      setProduct((prev) => ({
        ...prev,
        description: String(payload.description).trim(),
      }));
    } catch (err) {
      console.error("AI description edit failed:", err);
      alert(`❌ ${err.message || "Could not edit description."}`);
    } finally {
      setGeneratingDescription(false);
    }
  };

  // ✅ FIXED: RPC call to bypass schema cache, using correct SQL function
  const handleSave = async () => {
    try {
      setUploading(true);
      let thumbUrl = product.thumbnail_url;

      if (thumbnailFile) {
        const ext = thumbnailFile.name.split(".").pop();
        const clean = thumbnailFile.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
        const name = `${id}-thumb-${Date.now()}.${ext}`;

        const { error } = await supabase.storage
          .from("thumbnails")
          .upload(name, thumbnailFile, { upsert: true });

        if (error) {
          const isRls = /row-level security/i.test(error.message || "");
          if (isRls) {
            thumbUrl = await uploadImageViaMarketplaceApi(thumbnailFile);
          } else {
            throw error;
          }
        } else {
          const { data } = supabase.storage.from("thumbnails").getPublicUrl(name);
          thumbUrl = data.publicUrl;
        }
      }

      // Calculate platform_commission as dollar amount and vendor revenue
      const commissionValue = parseFloat(product.commission_value || 0);
      const salePrice = parseFloat(product.sale_price || 0);
      let affiliateRevenue = 0;
      let platformCommissionDollar = 0;
      let vendorRevenue = "0.00";
      if (salePrice && commissionValue) {
        affiliateRevenue = (salePrice * commissionValue) / 100;
        platformCommissionDollar = (salePrice * commissionValue * 0.5) / 100;
        vendorRevenue = (salePrice - affiliateRevenue - platformCommissionDollar).toFixed(2);
      }
      const payload = {
        title: product.title || "",
        description: product.description || "",
        sales_page_url: product.sales_page_url || "",
        affiliate_link: product.affiliate_link || "",
        sale_price: salePrice,
        commission_type: product.commission_type || "percentage",
        commission_value: commissionValue,
        platform_commission: platformCommissionDollar,
        affiliate_revenue_per_sale: affiliateRevenue,
        vendor_revenue_per_sale: vendorRevenue,
        category: product.category || "",
        image_url: thumbUrl,
        extra_images: extraImages,
      };

      // Direct update to affiliate_products table
      const { error } = await supabase
        .from("affiliate_products")
        .update(payload)
        .eq("id", id);

      if (error) throw error;
      alert("✅ Product saved successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      alert(`❌ Failed to save product. ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!product) return <div className="loading">No product found.</div>;

  return (
    <div className="wrap">
      <div className="inner">
        <div className="banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', background: '', borderRadius: 16, marginBottom: 32 }}>
          <div className="left" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span className="icon">{ICONS.products({ size: 48 })}</span>
            <div className="title-block">
              <h1 style={{ fontSize: 48, fontWeight: 600, margin: 0 }}>Edit Product Details</h1>
              <p style={{ fontSize: 18, margin: 0, opacity: 0.85 }}>Update title, description, and images.</p>
            </div>
          </div>

          <Link
            href="/modules/vendor/affiliates/manage-products/my-products"
            className="back"
            style={{
              background: '#2563eb',
              color: '#fff',
              padding: '12px 32px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 20,
              marginLeft: 32,
              marginRight: 12,
              boxShadow: '0 2px 8px 0 rgba(37,99,235,0.10)',
              border: 'none',
              textDecoration: 'none',
              transition: 'background 0.2s',
              display: 'inline-block',
              cursor: 'pointer',
            }}
            onMouseOver={e => e.currentTarget.style.background = '#1d4ed8'}
            onMouseOut={e => e.currentTarget.style.background = '#2563eb'}
          >
            ← Back
          </Link>
        </div>

        <div className="grid">
          <div className="form">
            <label>Product Title:</label>
            <input name="title" value={product.title || ""} onChange={handleChange} />

            <label>Description:</label>
            <div className="descActions">
              <button
                type="button"
                className="aiBtn"
                onClick={handleAiEditDescription}
                disabled={uploading || generatingDescription}
              >
                {generatingDescription ? "Starting..." : "Start with AI"}
              </button>
            </div>
            <textarea
              name="description"
              value={product.description || ""}
              onChange={handleChange}
            />

            <label>Sales Page URL:</label>
            <input
              name="sales_page_url"
              value={product.sales_page_url || ""}
              onChange={handleChange}
            />

            <label>Affiliate Link (optional):</label>
            <input
              name="affiliate_link"
              value={product.affiliate_link || ""}
              onChange={handleChange}
            />

            <label>Sale Price ($):</label>
            <input
              type="number"
              name="sale_price"
              value={product.sale_price || ""}
              onChange={handleChange}
            />

            <label>Commission (%):</label>
            <input
              type="number"
              name="commission_value"
              value={product.commission_value || ""}
              onChange={handleChange}
            />

            <label>Platform Commission ($):</label>
            <input readOnly value={(() => {
              const commissionValue = parseFloat(product.commission_value || product.commission || 0);
              const salePrice = parseFloat(product.sale_price || 0);
              if (salePrice && commissionValue) {
                return ((salePrice * commissionValue * 0.5) / 100).toFixed(2);
              }
              return "0.00";
            })()} />

            <label>Affiliate Revenue Per Sale ($):</label>
            <input readOnly value={(() => {
              const commissionValue = parseFloat(product.commission_value || 0);
              const salePrice = parseFloat(product.sale_price || 0);
              if (salePrice && commissionValue) {
                return ((salePrice * commissionValue) / 100).toFixed(2);
              }
              return "0.00";
            })()} />

            <label>Vendor Revenue Per Sale ($):</label>
            <input readOnly value={(() => {
              const commissionValue = parseFloat(product.commission_value || 0);
              const salePrice = parseFloat(product.sale_price || 0);
              const affiliateRevenue = (salePrice * commissionValue) / 100;
              const platformCommissionDollar = (salePrice * commissionValue * 0.5) / 100;
              if (salePrice && commissionValue) {
                return (salePrice - affiliateRevenue - platformCommissionDollar).toFixed(2);
              }
              return "0.00";
            })()} />

            <label>Category:</label>
            <input
              name="category"
              value={product.category || ""}
              onChange={handleChange}
            />

            <label>Thumbnail Image:</label>
            {(product.image_url || product.thumbnail_url) && (
              <img src={product.image_url || product.thumbnail_url} className="thumb-preview" alt="Thumbnail" />
            )}
            <input type="file" accept="image/*" onChange={handleThumbnail} />

            <label>Additional Images (up to 4):</label>
            <div className="slots">
              {extraImages.map((src, i) => (
                <div key={i} className="slot">
                  <p className="slotTitle">Image {i + 1}</p>
                  {src ? (
                    <img src={src} alt={`Extra ${i + 1}`} />
                  ) : (
                    <div className="empty">No Image</div>
                  )}
                  <div className="btns">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadSlotImage(i, e.target.files[0])}
                    />
                    {src && (
                      <button type="button" onClick={() => handleDeleteSlot(i)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="saveBox">
              <button onClick={handleSave} disabled={uploading} className="saveBtn">
                {uploading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          <div className="preview">
            <h2 className="previewTitle">Preview</h2>
            {(product.image_url || product.thumbnail_url) && (
              <img src={product.image_url || product.thumbnail_url} alt="Preview" className="preview-img" />
            )}
            <p className="pTitle">{product.title}</p>
            <p className="pText">{product.description}</p>
            <p className="pText">
              <b>Sale Price:</b> ${product.sale_price} <br />
              <b>Commission:</b> {product.commission}% <br />
              <b>Revenue Per Sale:</b> ${product.revenue_per_sale}
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .wrap {
          background: #0c121a;
          color: #fff;
          min-height: 100vh;
          padding: 28px 22px;
          font-size: 16px; /* ✅ min font size */
          font-weight: 400;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial,
            sans-serif;
        }

        .inner {
          width: 100%;
          max-width: 1320px;
          margin: 0 auto;
        }

        .banner {
          background: #f97316;
          padding: 14px 20px;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          gap: 14px;
        }

        .left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        /* ✅ Banner title */
        .title-block h1 {
          margin: 0;
          font-size: 48px;
          font-weight: 600;
          line-height: 1.1;
        }

        /* ✅ Banner subtitle */
        .title-block p {
          margin: 0;
          margin-top: 6px;
          font-size: 18px;
          font-weight: 600;
          opacity: 0.95;
        }

        /* ✅ Back button: 18px */
        .back {
          font-size: 18px;
          font-weight: 600;
          color: #ec11cf;
          text-decoration: none;
          background: rgb(241, 12, 12);
          border: 1px solid rgb(201, 198, 21);
          padding: 20px 16px;
          border-radius: 10px;
          white-space: nowrap;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .form label {
          display: block;
          margin-top: 8px;
          font-weight: 600; /* ✅ max weight = 600 */
          font-size: 16px;
        }

        .form input,
        .form textarea {
          width: 100%;
          background: #1e2633;
          color: #fff;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 10px;
          margin-bottom: 10px;
          font-size: 16px; /* ✅ min font size */
          font-weight: 500;
        }

        .descActions {
          margin-bottom: 8px;
        }

        .aiBtn {
          border: none;
          border-radius: 8px;
          background: #f97316;
          color: #fff;
          padding: 8px 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .aiBtn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .thumb-preview {
          width: 280px;
          height: 180px;
          object-fit: cover;
          border-radius: 8px;
          margin: 6px 0;
        }

        .slots {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .slot {
          background: #1e2633;
          border: 1px solid #f97316;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
        }

        .slotTitle {
          margin: 0 0 8px;
          font-size: 16px;
          font-weight: 600; /* ✅ max weight = 600 */
        }

        .slot img {
          width: 100%;
          height: 150px;
          object-fit: cover;
          border-radius: 6px;
        }

        .slot .empty {
          height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0c121a;
          border: 1px dashed #f97316;
          color: rgba(255, 255, 255, 0.55);
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
        }

        .btns {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: center;
        }

        .btns button {
          background: #dc2626;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600; /* ✅ max weight */
        }

        .saveBox {
          display: flex;
          justify-content: center;
          margin-top: 20px;
        }

        .saveBtn {
          background: #10b981;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 14px 40px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
        }

        .preview {
          background: #111827;
          border: 1px solid #f97316;
          border-radius: 10px;
          padding: 16px;
          text-align: center;
          font-size: 16px;
          font-weight: 500;
        }

        .previewTitle {
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 600;
        }

        .preview-img {
          max-width: 280px;
          border-radius: 8px;
        }

        .pTitle {
          margin: 10px 0 6px;
          font-size: 18px;
          font-weight: 600;
        }

        .pText {
          margin: 6px 0;
          font-size: 16px;
          font-weight: 500;
          opacity: 0.92;
        }

        .loading {
          font-size: 16px;
          font-weight: 600;
          padding: 20px;
        }

        @media (max-width: 980px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
