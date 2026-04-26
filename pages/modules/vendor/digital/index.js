// /pages/modules/vendor/digital/index.js

import { useEffect, useState } from "react";
import ICONS from "../../../../components/iconMap";
import { supabase } from "../../../../utils/supabase-client";
import { useAuth } from "../../../../context/AuthContext";
import Link from "next/link";
import VendorUserBanner from "../../../../components/vendor/VendorUserBanner";

const CATEGORY_OPTIONS = [
  "eBook",
  "Online Course",
  "Templates",
  "Software",
  "Audio",
  "Video",
  "Membership",
  "Other"
];

export default function VendorDigitalHome() {
  const { user, session, loading } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [forms, setForms] = useState([]);
  const [aiTagsLoadingIndex, setAiTagsLoadingIndex] = useState(null);
  const [aiDescLoadingIndex, setAiDescLoadingIndex] = useState(null);
  const MAX_PRODUCTS = 6;

  function getMarketplaceCode() {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("xchange_user_code") || "";
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
  }

  async function uploadImageViaMarketplaceApi(file, bucket) {
    const code = getMarketplaceCode();
    if (!code) {
      throw new Error("No marketplace session code found for secure upload fallback.");
    }

    const dataUrl = await fileToDataUrl(file);

    const resp = await fetch("/api/marketplace/vendor-upload-product-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        vendorId: vendor?.id,
        bucket,
        fileName: file?.name || "upload.bin",
        dataUrl,
      }),
    });

    const raw = await resp.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { error: raw || "Invalid server response" };
    }
    if (!resp.ok || !payload?.publicUrl) {
      throw new Error(payload?.error || "Marketplace upload fallback failed.");
    }

    return payload.publicUrl;
  }

  async function saveViaMarketplaceApi(form, uploadedUrls) {
    const code = getMarketplaceCode();
    if (!code) {
      throw new Error("No marketplace session code found for secure save fallback.");
    }

    const resp = await fetch("/api/marketplace/vendor-digital-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        action: "upsert",
        vendorId: vendor?.id,
        product: {
          id: form.id || null,
          title: form.title,
          description: form.description,
          price: parseFloat(form.price),
          category: form.category,
          tags: form.tags,
          image_urls: uploadedUrls,
          is_published: form.publish,
        },
      }),
    });

    const raw = await resp.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { error: raw || "Invalid server response" };
    }
    if (!resp.ok || !payload?.product?.id) {
      throw new Error(payload?.error || "Marketplace save fallback failed.");
    }

    return payload.product;
  }

  async function deleteViaMarketplaceApi(productId) {
    const code = getMarketplaceCode();
    if (!code) {
      throw new Error("No marketplace session code found for secure delete fallback.");
    }

    const resp = await fetch("/api/marketplace/vendor-digital-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        action: "delete",
        vendorId: vendor?.id,
        productId,
      }),
    });

    const raw = await resp.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { error: raw || "Invalid server response" };
    }
    if (!resp.ok || !payload?.ok) {
      throw new Error(payload?.error || "Marketplace delete fallback failed.");
    }
  }

  async function listViaMarketplaceApi(vendorId) {
    const code = getMarketplaceCode();
    if (!code) {
      throw new Error("No marketplace session code found for secure list fallback.");
    }

    if (!vendorId) {
      throw new Error("Missing vendorId for marketplace list fallback.");
    }

    const resp = await fetch("/api/marketplace/vendor-digital-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        action: "list",
        vendorId,
      }),
    });

    const raw = await resp.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { error: raw || "Invalid server response" };
    }
    if (!resp.ok) {
      throw new Error(payload?.error || "Marketplace list fallback failed.");
    }

    return Array.isArray(payload?.products) ? payload.products : [];
  }

  function createEmptyForm() {
    return {
      id: null,
      title: "",
      description: "",
      price: "",
      category: "",
      tags: "",
      sales_page_url: "",
      images: [],
      image_urls: [],
      activeImage: 0,
      publish: false
    };
  }
  async function generateTags(index) {
    setAiTagsLoadingIndex(index);
    try {
      const title = forms[index].title;
      if (!title) throw new Error('Enter a product title first.');
      const res = await fetch('/api/generate-product-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'tags', title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI error');
      updateForm(index, 'tags', data.result);
    } catch (err) {
      alert(err.message || 'AI tag generation failed.');
    } finally {
      setAiTagsLoadingIndex(null);
    }
  }

  async function generateDescription(index) {
    setAiDescLoadingIndex(index);
    try {
      const title = forms[index].title;
      if (!title) throw new Error('Enter a product title first.');
      const res = await fetch('/api/generate-product-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'description', title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI error');
      updateForm(index, 'description', data.result);
    } catch (err) {
      alert(err.message || 'AI description generation failed.');
    } finally {
      setAiDescLoadingIndex(null);
    }
  }

  useEffect(() => {
    async function init() {
      if (loading) return; // Wait for auth to load

      const code = getMarketplaceCode();
      let vendorRecord = null;
      let products = [];

      try {
        if (user?.id && session?.access_token) {
          const res = await fetch("/api/vendor/get-vendor", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (res.ok) {
            const payload = await res.json();
            vendorRecord = payload?.vendor || null;
          }
        }

        if (!vendorRecord && code) {
          const accessRes = await fetch("/api/marketplace/vendor-access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });

          const accessPayload = await accessRes.json();
          if (!accessRes.ok || !accessPayload?.allowed || !accessPayload?.vendorId) {
            alert(accessPayload?.error || "Vendor access is not approved for this account.");
            return;
          }

          vendorRecord = {
            id: accessPayload.vendorId,
            user_id: accessPayload.userId || null,
            email: accessPayload.email || "",
          };

          products = await listViaMarketplaceApi(vendorRecord.id);
        }

        if (!vendorRecord?.id) {
          alert("No active vendor session found. Please sign in.");
          return;
        }

        setVendor(vendorRecord);

        if (!products.length) {
          const { data, error: productError } = await supabase
            .from("products")
            .select("*")
            .eq("vendor_id", vendorRecord.id)
            .eq("type", "digital")
            .order("created_at", { ascending: false });

          if (productError) {
            const isRlsError = /row-level security policy|not authenticated/i.test(productError.message || "");
            if (isRlsError && code) {
              products = await listViaMarketplaceApi(vendorRecord.id);
            } else {
              alert(productError.message);
              return;
            }
          } else {
            products = data || [];
          }
        }

        let productForms = [];

        if (products.length > 0) {
          productForms = products.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            price: p.price,
            category: p.category,
            tags: p.tags,
            images: [],
            image_urls: p.image_urls || [],
            activeImage: 0,
            publish: p.is_published
          }));
        }

        // Only show up to 3 cards (real or placeholder)
        while (productForms.length < 3) {
          productForms.push(createEmptyForm());
        }
        setForms(productForms.slice(0, 3));
      } catch (err) {
        console.error("Vendor initialization error:", err);
        alert(err.message || "Failed to initialize vendor dashboard");
        return;
      }
    }

    init();
  }, [user?.id, session?.access_token, loading]);

  function updateForm(index, key, value) {
    const updated = [...forms];
    updated[index][key] = value;
    setForms(updated);
  }

  function handleImageUpload(index, files) {
    const updated = [...forms];
    const newFiles = Array.from(files);
    updated[index].images = [...updated[index].images, ...newFiles].slice(0, 5);
    setForms(updated);
  }

  async function saveProduct(index) {
    const form = forms[index];

    if (!vendor?.id) return alert("Vendor not found.");
    if (!form.title || !form.price)
      return alert("Title and price required.");

    try {
      let uploadedUrls = [...form.image_urls];

      for (let file of form.images) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2)}.${fileExt}`;
        const filePath = `vendor-${vendor.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("digital-product-images")
          .upload(filePath, file);

        if (uploadError) {
          const isRlsError = /row-level security policy/i.test(uploadError.message || "");
          if (isRlsError) {
            const fallbackUrl = await uploadImageViaMarketplaceApi(file, "digital-product-images");
            uploadedUrls.push(fallbackUrl);
            continue;
          }
          throw uploadError;
        }

        const { data } = supabase.storage
          .from("digital-product-images")
          .getPublicUrl(filePath);

        uploadedUrls.push(data.publicUrl);
      }

      let response;

      if (form.id) {
        response = await supabase
          .from("products")
          .update({
            title: form.title,
            description: form.description,
            price: parseFloat(form.price),
            category: form.category,
            tags: form.tags,
            image_urls: uploadedUrls,
            is_published: form.publish
          })
          .eq("id", form.id)
          .select()
          .single();
      } else {
        response = await supabase
          .from("products")
          .insert({
            vendor_id: vendor.id,
            type: "digital",
            title: form.title,
            description: form.description,
            price: parseFloat(form.price),
            category: form.category,
            tags: form.tags,
            image_urls: uploadedUrls,
            is_published: form.publish
          })
          .select()
          .single();
      }

      if (response.error || !response.data) {
        const errorMessage = response.error?.message || "Save failed.";
        const isRlsError = /row-level security policy/i.test(errorMessage);

        if (isRlsError) {
          const savedFromApi = await saveViaMarketplaceApi(form, uploadedUrls);
          form.id = savedFromApi.id;
          form.image_urls = uploadedUrls;
          form.images = [];
          setForms([...forms]);
          alert("Product saved successfully.");
          return;
        }

        throw new Error(errorMessage);
      }

      form.id = response.data.id;
      form.image_urls = uploadedUrls;
      form.images = [];

      setForms([...forms]);

      alert("Product saved successfully.");
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteProduct(index) {
    const form = forms[index];

    if (!confirm("Delete this product?")) return;

    try {
      if (form.id) {
        for (let url of form.image_urls) {
          const path = url.split("/digital-product-images/")[1];
          if (path) {
            await supabase.storage
              .from("digital-product-images")
              .remove([path]);
          }
        }

        const { error: deleteError } = await supabase
          .from("products")
          .delete()
          .eq("id", form.id);

        if (deleteError) {
          const isRlsError = /row-level security policy/i.test(deleteError.message || "");
          if (isRlsError) {
            await deleteViaMarketplaceApi(form.id);
          } else {
            throw deleteError;
          }
        }
      }

      // 🔥 Instead of removing card — RESET it
      const updated = [...forms];
      updated[index] = createEmptyForm();
      setForms(updated);

      alert("Product deleted.");
    } catch (err) {
      alert(err.message);
    }
  }


  return (
    <div className="wrap">
      <div className="banner">
        <div className="banner-left">
          {ICONS.digitalProducts({ size: 48, color: "#fff" })}
          <div>
            <h1>Digital Products – Vendor Console</h1>
            <p>Create, manage and publish digital products.</p>
          </div>
        </div>
        <Link href="/modules/vendor">
          <button className="save-btn">← Back</button>
        </Link>
      </div>

      <VendorUserBanner />

      {/* Add New Product Button */}
      <div style={{ marginBottom: 24, textAlign: 'right' }}>
        <button
          className="add-btn"
          disabled={forms.length >= MAX_PRODUCTS}
          onClick={() => {
            if (forms.length < MAX_PRODUCTS) {
              setForms([...forms, createEmptyForm()]);
            }
          }}
        >
          + Add New Product
        </button>
      </div>

      <div className="grid">
        {forms.map((form, index) => (
          <div key={index} className="product-card">
            <div className="main-image">
              {form.images.length > 0 ? (
                <img
                  src={URL.createObjectURL(form.images[form.activeImage])}
                  alt=""
                />
              ) : form.image_urls.length > 0 ? (
                <img
                  src={form.image_urls[form.activeImage]}
                  alt=""
                />
              ) : (
                <div className="placeholder">Primary Image</div>
              )}
            </div>
            <div className="upload-label">Upload up to 5 images</div>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleImageUpload(index, e.target.files)}
            />
            <input
              placeholder="Product Title"
              value={form.title}
              onChange={(e) => updateForm(index, "title", e.target.value)}
            />
            <div className="row">
              <select
                value={form.category}
                onChange={(e) => updateForm(index, "category", e.target.value)}
              >
                <option value="">Select Category</option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Price"
                value={form.price}
                onChange={(e) => updateForm(index, "price", e.target.value)}
              />
            </div>
            <input
              placeholder="Tags (comma separated)"
              value={form.tags}
              onChange={(e) => updateForm(index, "tags", e.target.value)}
            />
            <button
              className="ai-btn"
              onClick={() => generateTags(index)}
              disabled={aiTagsLoadingIndex === index}
            >
              {aiTagsLoadingIndex === index ? "Generating Tags..." : "✨ Generate Tags"}
            </button>
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => updateForm(index, "description", e.target.value)}
            />
            <button
              className="ai-btn"
              onClick={() => generateDescription(index)}
              disabled={aiDescLoadingIndex === index}
            >
              {aiDescLoadingIndex === index ? "Generating Description..." : "✨ Generate Description"}
            </button>
            <input
              placeholder="Sales Page URL (optional)"
              value={form.sales_page_url || ''}
              onChange={e => updateForm(index, 'sales_page_url', e.target.value)}
            />
            <label className="publish-toggle">
              <input
                type="checkbox"
                checked={form.publish}
                onChange={(e) => updateForm(index, "publish", e.target.checked)}
              />
              <span>Publish to Marketplace</span>
            </label>
            <div className="button-row">
              <button
                className="save-btn"
                onClick={() => saveProduct(index)}
              >
                Save Product
              </button>
              <button
                className="save-btn delete-btn"
                onClick={() => deleteProduct(index)}
              >
                Delete Product
              </button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .wrap {
          max-width: 1320px;
          margin: 0 auto;
          padding: 40px 20px;
          color: #fff;
        }

        .banner {
          background: #6b7280;
          padding: 24px;
          border-radius: 12px;
          margin-bottom: 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .banner-left {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        h1 {
          font-size: 48px;
          font-weight: 600;
          margin: 0;
          color: rgb(237,200,89);
        }

        p {
          font-size: 18px;
          margin-top: 6px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .product-card {
          background: #1f2937;
          border: 1px solid #4b5563;
          padding: 20px;
          border-radius: 12px;
        }

        .main-image {
          height: 180px;
          background: #111827;
          border-radius: 8px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .main-image img {
          max-width: 100%;
          max-height: 100%;
        }

        .placeholder {
          opacity: 0.4;
        }

        input,
        select,
        textarea {
          width: 100%;
          margin-bottom: 12px;
          padding: 10px;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 6px;
          color: #fff;
        }

        .row {
          display: flex;
          gap: 10px;
        }

        .publish-toggle {
          display: flex;
          gap: 14px;
          align-items: center;
          margin: 12px 0;
        }

        .publish-toggle input {
          width: 26px;
          height: 26px;
        }

        .button-row {
          display: flex;
          gap: 12px;
          margin-top: 10px;
        }

        .save-btn {
          background: #22c55e;
          padding: 12px;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          cursor: pointer;
          flex: 1;
        }

        .delete-btn {
          background: red;
        }
        .add-btn {
          background: #6b7280;
          color: #fff;
          padding: 12px 32px;
          border-radius: 8px;
          border: none;
          font-weight: 700;
          font-size: 18px;
          cursor: pointer;
          margin-bottom: 0;
          transition: background 0.2s;
        }
        .add-btn:disabled {
          background: #334155;
          color: #bbb;
          cursor: not-allowed;
        }
        .ai-btn {
          background: #8b5cf6;
          padding: 10px;
          border-radius: 6px;
          border: none;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          margin-bottom: 12px;
        }
      `}</style>
    </div>
    
  );
}
