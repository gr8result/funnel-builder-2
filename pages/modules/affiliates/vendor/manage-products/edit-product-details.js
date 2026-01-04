// /pages/modules/affiliates/vendor/manage-products/edit-product-details.js
// Final verified version — layout preserved, banner icon left, Supabase RPC fix working

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../../../utils/supabase-client";
import ICONS from "../../../../../components/iconMap";
import Link from "next/link";

export default function EditProductDetails() {
  const router = useRouter();
  const { id } = router.query;

  const [product, setProduct] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [extraImages, setExtraImages] = useState(["", "", "", ""]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadProduct();
  }, [id]);

  const loadProduct = async () => {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
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
      const { error } = await supabase.storage.from("thumbnails").upload(name, file, { upsert: true });
      if (error) throw error;
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

  // ✅ FIXED: RPC call to bypass schema cache, using correct SQL function
  const handleSave = async () => {
    try {
      setUploading(true);
      let thumbUrl = product.thumbnail_url;

      if (thumbnailFile) {
        const ext = thumbnailFile.name.split(".").pop();
        const clean = thumbnailFile.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
        const name = `${id}-thumb-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("thumbnails").upload(name, thumbnailFile, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from("thumbnails").getPublicUrl(name);
        thumbUrl = data.publicUrl;
      }

      const payload = {
        title: product.title || "",
        description: product.description || "",
        sales_page_url: product.sales_page_url || "",
        affiliate_link: product.affiliate_link || "",
        sale_price: parseFloat(product.sale_price) || 0,
        commission: parseFloat(product.commission) || 0,
        revenue_per_sale: parseFloat(product.revenue_per_sale) || 0,
        category: product.category || "",
        thumbnail_url: thumbUrl,
        extra_imgs: extraImages,
      };

      const { error } = await supabase.rpc("save_product_direct", {
        pid: id,
        payload,
      });

      if (error) throw error;
      alert("✅ Product saved successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      alert(`❌ Failed to save product. ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!product) return <div>No product found.</div>;

  return (
    <div className="wrap">
      <div className="inner">
        <div className="banner">
          <div className="left">
            <span className="icon">{ICONS.products({ size: 28 })}</span>
            <div className="title-block">
              <h1>Edit Product Details</h1>
              <p>Update title, description, and images.</p>
            </div>
          </div>
          <Link href="/modules/affiliates/vendor/manage-products/my-products" className="back">
            ← Back
          </Link>
        </div>

        <div className="grid">
          <div className="form">
            <label>Product Title:</label>
            <input name="title" value={product.title || ""} onChange={handleChange} />
            <label>Description:</label>
            <textarea name="description" value={product.description || ""} onChange={handleChange} />
            <label>Sales Page URL:</label>
            <input name="sales_page_url" value={product.sales_page_url || ""} onChange={handleChange} />
            <label>Affiliate Link (optional):</label>
            <input name="affiliate_link" value={product.affiliate_link || ""} onChange={handleChange} />
            <label>Sale Price ($):</label>
            <input type="number" name="sale_price" value={product.sale_price || ""} onChange={handleChange} />
            <label>Commission (%):</label>
            <input type="number" name="commission" value={product.commission || ""} onChange={handleChange} />
            <label>Revenue Per Sale ($):</label>
            <input readOnly value={product.revenue_per_sale || ""} />
            <label>Category:</label>
            <input name="category" value={product.category || ""} onChange={handleChange} />

            <label>Thumbnail Image:</label>
            {product.thumbnail_url && <img src={product.thumbnail_url} className="thumb-preview" alt="Thumbnail" />}
            <input type="file" accept="image/*" onChange={handleThumbnail} />

            <label>Additional Images (up to 4):</label>
            <div className="slots">
              {extraImages.map((src, i) => (
                <div key={i} className="slot">
                  <p>Image {i + 1}</p>
                  {src ? <img src={src} alt={`Extra ${i + 1}`} /> : <div className="empty">No Image</div>}
                  <div className="btns">
                    <input type="file" accept="image/*" onChange={(e) => uploadSlotImage(i, e.target.files[0])} />
                    {src && <button onClick={() => handleDeleteSlot(i)}>Delete</button>}
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
            <h2>Preview</h2>
            {product.thumbnail_url && <img src={product.thumbnail_url} alt="Preview" className="preview-img" />}
            <p className="title">{product.title}</p>
            <p>{product.description}</p>
            <p>
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
        }
        .left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .title-block h1 {
          margin: 0;
        }
        .form label {
          display: block;
          margin-top: 8px;
          font-weight: 700;
        }
        .form input,
        .form textarea {
          width: 100%;
          background: #1e2633;
          color: #fff;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 10px;
        }
        .thumb-preview {
          width: 120px;
          height: 120px;
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
          color: #999;
          border-radius: 6px;
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
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
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
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }
        .preview {
          background: #111827;
          border: 1px solid #f97316;
          border-radius: 10px;
          padding: 16px;
          text-align: center;
        }
        .preview-img {
          max-width: 200px;
          border-radius: 8px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
      `}</style>
    </div>
  );
}
