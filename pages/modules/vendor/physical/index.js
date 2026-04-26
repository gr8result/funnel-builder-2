// /pages/modules/vendor/physical/index.js

import { useEffect, useState } from "react";
import ICONS from "../../../../components/iconMap";
import { supabase } from "../../../../utils/supabase-client";
import { useAuth } from "../../../../context/AuthContext";
import Link from "next/link";
import VendorUserBanner from "../../../../components/vendor/VendorUserBanner";

const CATEGORY_OPTIONS = [
  "General",
  "Health & Fitness",
  "Clothing & Apparel",
  "Electronics",
  "Home & Garden",
  "Beauty & Personal Care",
  "Books",
  "Toys & Games",
  "Sports Equipment",
  "Automotive",
  "Food & Beverage",
  "Pet Supplies",
  "Jewelry",
  "Tools",
  "Office Supplies",
  "Outdoor & Camping",
  "Other",
];

function createEmptyForm() {
  return {
    id: null,
    title: "",
    description: "",
    price: "",
    category: "General",
    tags: "",
    images: [],
    image_urls: [],
    activeImage: 0,
    publish: false,
  };
}

export default function VendorPhysicalHome() {
  const { user, session, loading } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [forms, setForms] = useState([
    createEmptyForm(),
    createEmptyForm(),
    createEmptyForm(),
  ]);
  const [aiTagsLoadingIndex, setAiTagsLoadingIndex] = useState(null);
  const [aiDescLoadingIndex, setAiDescLoadingIndex] = useState(null);
  const MAX_PRODUCTS = 50;

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

    const resp = await fetch("/api/marketplace/vendor-physical-products", {
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
          price: parseFloat(form.price) || 0,
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

    const resp = await fetch("/api/marketplace/vendor-physical-products", {
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

    const resp = await fetch("/api/marketplace/vendor-physical-products", {
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

  async function generateTags(index) {
    setAiTagsLoadingIndex(index);
    try {
      const form = forms[index];
      if (!form.description) {
        alert("Please enter a product description first.");
        setAiTagsLoadingIndex(null);
        return;
      }
      const res = await fetch("/api/generate-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: form.description }),
      });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }
      if (!res.ok) {
        const msg = data.error || res.statusText || "AI tag generation failed.";
        throw new Error(msg);
      }
      if (!data.tags) throw new Error("No tags returned from AI.");
      updateForm(index, "tags", data.tags);
    } catch (err) {
      alert(err.message || "AI tag generation failed.");
    } finally {
      setAiTagsLoadingIndex(null);
    }
  }

  async function generateDescription(index) {
    setAiDescLoadingIndex(index);
    try {
      const form = forms[index];
      if (!form.title) {
        alert("Please enter a product title first.");
        setAiDescLoadingIndex(null);
        return;
      }
      const res = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title }),
      });
      if (!res.ok) throw new Error("AI description generation failed.");
      const data = await res.json();
      if (!data.description) throw new Error("No description returned from AI.");
      updateForm(index, "description", data.description);
    } catch (err) {
      alert(err.message || "AI description generation failed.");
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
            .eq("type", "physical")
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

        if (!products) return;

        const loaded = products.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description || "",
          price: p.price,
          category: p.category || "General",
          tags: p.tags || "",
          images: [],
          image_urls: p.image_urls || [],
          activeImage: 0,
          publish: p.is_published,
        }));

        // Only show up to 9 cards (real or placeholder)
        while (loaded.length < 9) {
          loaded.push(createEmptyForm());
        }
        setForms(loaded.slice(0, 9));
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
    const newFiles = Array.from(files).slice(0, 5);
    updated[index].images = newFiles;
    updated[index].activeImage = 0;
    setForms(updated);
  }

  function getPreviewImage(form) {
    // PRIORITY 1: New uploaded images (live preview)
    if (form.images && form.images.length > 0) {
      return URL.createObjectURL(form.images[form.activeImage]);
    }

    // PRIORITY 2: Saved DB images
    if (form.image_urls && form.image_urls.length > 0) {
      return form.image_urls[form.activeImage];
    }

    return null;
  }

  async function saveProduct(index) {
    if (!vendor?.id) return alert("Vendor loading...");

    const form = forms[index];
    if (!form.title) return alert("Title required.");

    try {
      let uploadedUrls = [...form.image_urls];

      for (let file of form.images) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2)}.${fileExt}`;
        const filePath = `vendor-${vendor.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, file);

        if (uploadError) {
          const isRlsError = /row-level security policy/i.test(uploadError.message || "");
          if (isRlsError) {
            const fallbackUrl = await uploadImageViaMarketplaceApi(file, "product-images");
            uploadedUrls.push(fallbackUrl);
            continue;
          }
          throw uploadError;
        }

        const { data } = supabase.storage
          .from("product-images")
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
            price: parseFloat(form.price) || 0,
            category: form.category,
            tags: form.tags,
            image_urls: uploadedUrls,
            is_published: form.publish,
          })
          .eq("id", form.id)
          .select()
          .single();
      } else {
        response = await supabase
          .from("products")
          .insert({
            vendor_id: vendor.id,
            type: "physical",
            title: form.title,
            description: form.description,
            price: parseFloat(form.price) || 0,
            category: form.category,
            tags: form.tags,
            image_urls: uploadedUrls,
            is_published: form.publish,
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
          alert("Product saved.");
          return;
        }

        throw new Error(errorMessage);
      }

      form.id = response.data.id;
      form.image_urls = uploadedUrls;
      form.images = []; // clear temp images
      setForms([...forms]);

      alert("Product saved.");
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteProduct(index) {
    const form = forms[index];
    if (!confirm("Delete this product?")) return;

    try {
      if (form.id) {
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

      // FULL RESET of card (fix preview issue)
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
          {ICONS.products({ size: 48, color: "#fff" })}
          <div>
            <h1>Physical Products – Vendor Console</h1>
            <p>Create, manage and publish physical products.</p>
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
        {forms.map((form, index) => {
          const preview = getPreviewImage(form);
          return (
            <div key={index} className="product-card">
              <div className="main-image">
                {preview ? (
                  <img src={preview} alt="" />
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
              <label className="publish-toggle">
                <input
                  type="checkbox"
                  checked={form.publish}
                  onChange={(e) => updateForm(index, "publish", e.target.checked)}
                />
                <span>Publish to Marketplace</span>
              </label>
              <div className="btn-row">
                <button
                  className="save-btn"
                  onClick={() => saveProduct(index)}
                >
                  Save Product
                </button>
                <button
                  className="delete-btn"
                  onClick={() => deleteProduct(index)}
                >
                  Delete Product
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
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
        .wrap {
          max-width: 1320px;
          margin: 0 auto;
          padding: 40px 20px;
          color: #fff;
        }

        .banner {
          background: #0ea5e9;
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

        .btn-row {
          display: flex;
          gap: 12px;
        }

        .save-btn {
          background: #22c55e;
          padding: 12px;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
        }

        .delete-btn {
          background: red;
          padding: 12px;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
        }
        .add-btn {
          background: #0ea5e9;
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
      `}</style>
    </div>
  );
}
