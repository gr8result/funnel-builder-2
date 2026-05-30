// /pages/modules/affiliates/affiliate-marketplace/affiliate_applications.js
import { useEffect, useState } from "react";
import { supabase } from "../../../../utils/supabase-client";
import ICONS from "../../../../components/iconMap";
import VendorUserBanner from "../../../../components/vendor/VendorUserBanner";

// Default styles for page layout
const page = {
  wrap: { background: '#101624', minHeight: '100vh', padding: '32px 0' },
  inner: { maxWidth: 1320, margin: '0 auto', background: '#181f2a', borderRadius: 16, boxShadow: '0 2px 16px 0 rgba(0,0,0,0.10)', padding: '32px 40px' },
  banner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, background: "#43f916", padding: '24px 32px', borderRadius: 16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  leftBanner: { display: 'flex', alignItems: 'center', gap: 24 },
  bannerIconWrap: { width: 64, height: 64, background: '#232e47', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 18 },
  bannerTitle: { fontSize: 48, fontWeight: 600, color: '#fff', marginBottom: 6 },
  bannerSubtitle: { fontSize: 18, color: '#ffffff', fontWeight: 500 },
  backBtn: { background: '#221a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 600, cursor: 'pointer', fontSize: 18, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)' }
};

export default function AffiliateApplications() {
  const [appliedProducts, setAppliedProducts] = useState([]);
  const [assetsByProductId, setAssetsByProductId] = useState({});
  const [expandedByAppId, setExpandedByAppId] = useState({});
  const [expandedTextByAssetId, setExpandedTextByAssetId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [affiliateCookieCode, setAffiliateCookieCode] = useState("");

  const getAssetType = (asset) => asset?.category || asset?.asset_type || "Other";
  const getAppProductIds = (app) => {
    const ids = [app?.product_id, app?.products?.id]
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    return Array.from(new Set(ids));
  };

  const getAssetsForApp = (app) => {
    const ids = getAppProductIds(app);
    const merged = [];
    const seen = new Set();

    ids.forEach((id) => {
      (assetsByProductId[id] || []).forEach((asset) => {
        if (!asset?.id || seen.has(asset.id)) return;
        seen.add(asset.id);
        merged.push(asset);
      });
    });

    return merged;
  };

  const truncateText = (value, max = 120) => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.length <= max) return text;
    return `${text.slice(0, max)}...`;
  };

  const toggleAppAssets = (appId) => {
    setExpandedByAppId((prev) => ({
      ...prev,
      [appId]: !prev[appId],
    }));
  };

  const toggleAssetText = (assetId) => {
    setExpandedTextByAssetId((prev) => ({
      ...prev,
      [assetId]: !prev[assetId],
    }));
  };

  const copyImageToClipboard = async (imageUrl) => {
    try {
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error("Image download failed");
      const blob = await resp.blob();
      if (!navigator?.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard image API not available");
      }
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || "image/png"]: blob }),
      ]);
      alert("Image copied to clipboard.");
    } catch (err) {
      try {
        await navigator.clipboard.writeText(imageUrl);
        alert("Image URL copied (browser blocked direct image clipboard).");
      } catch {
        alert("Could not copy image. Try a Chromium browser over HTTPS/localhost.");
      }
    }
  };

  useEffect(() => {
    async function loadApplications() {
      try {
        setLoading(true);
        setError(null);

        let resolvedUserId = null;
        let resolvedAffiliateCode = "";

        const code =
          typeof window !== "undefined"
            ? localStorage.getItem("xchange_user_code")
            : null;

        // Prefer marketplace identity when present.
        if (code) {
          resolvedAffiliateCode = String(code).slice(0, 8).toUpperCase();
          const { data: marketplaceUser, error: marketplaceUserError } = await supabase
            .from("users")
            .select("id, user_code")
            .eq("user_code", code)
            .maybeSingle();

          if (marketplaceUserError) throw marketplaceUserError;
          if (marketplaceUser?.id) {
            resolvedUserId = marketplaceUser.id;
          }
        }

        // Fallback to Supabase auth session for main-platform users.
        if (!resolvedUserId) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user?.id) {
            resolvedUserId = user.id;
            if (!resolvedAffiliateCode) {
              resolvedAffiliateCode = String(user.id).slice(0, 8).toUpperCase();
            }
          }
        }

        setAffiliateCookieCode(resolvedAffiliateCode);

        if (!resolvedUserId) {
          setAppliedProducts([]);
          return;
        }

        const { data, error } = await supabase
          .from('affiliate_product_applications')
          .select('*, products:product_id(*)')
          .eq('affiliate_user_id', resolvedUserId);

        if (error) throw error;
        const apps = data || [];
        setAppliedProducts(apps);

        const productIds = Array.from(
          new Set(
            apps
              .flatMap((app) => getAppProductIds(app))
              .filter(Boolean)
          )
        );

        if (!productIds.length) {
          setAssetsByProductId({});
        } else {
          const resp = await fetch("/api/affiliate/product-assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productIds }),
          });

          const payload = await resp.json();
          if (!resp.ok || !payload?.ok) {
            console.error("Failed to load product assets:", payload?.error || "Unknown API error");
            setAssetsByProductId({});
          } else {
            const grouped = {};
            (payload.assets || []).forEach((asset) => {
              const key = asset.product_id;
              if (!key) return;
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(asset);
            });
            setAssetsByProductId(grouped);
          }
        }
      } catch (e) {
        setError(e.message || 'Error loading affiliate applications');
      } finally {
        setLoading(false);
      }
    }
    loadApplications();
  }, []);

  return (
    <div style={page?.wrap}>
      <div style={page?.inner}>
        {/* Banner */}
        <div style={page?.banner}>
          <div style={page?.leftBanner}>
            <div style={page?.bannerIconWrap}>
              {ICONS.products({ size: 48, color: "#ffff" })}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={page?.bannerTitle}>Affiliate Applications</div>
              <div style={page?.bannerSubtitle}>
                Review our applications for Affiliate programs.
              </div>
            </div>
          </div>
          <button
            style={page?.backBtn}
            onClick={() => window.history.back()}
            onMouseOver={e => (e.currentTarget.style.background = "#111827")}
            onMouseOut={e => (e.currentTarget.style.background = "#0c121a")}
          >
            ← Back
          </button>
        </div>
        <VendorUserBanner />
        {/* Application List */}
        <div style={{marginTop: 32}}>
          {loading && (
            <div style={{ fontSize: 22, opacity: 0.85, fontWeight: 600, textAlign: 'center' }}>Loading products…</div>
          )}
          {error && (
            <div style={{ color: 'red', fontSize: 18, textAlign: 'center' }}>{error}</div>
          )}
          {!loading && !error && (
            <>
              <table style={{ width: '100%', background: '#181f2a', borderRadius: 12, overflow: 'hidden', fontSize: 18 }}>
                <thead>
                  <tr style={{ background: '#232e47', color: '#fff' }}>
                    <th style={{ padding: '12px 10px', textAlign: 'left' }}>Image</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left' }}>Title</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left' }}>Commission</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left' }}>Price</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left' }}>Assets</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left' }}>Affiliate URL</th>
                  </tr>
                </thead>
                <tbody>
                  {appliedProducts.map((app) => {
                    const assets = getAssetsForApp(app);
                    const hasAssets = assets.length > 0;
                    const isExpanded = Boolean(expandedByAppId[app.id]);

                    return (
                      <>
                        <tr key={`row-${app.id}`} style={{ borderBottom: '1px solid #232e47' }}>
                          <td style={{ padding: '10px 10px' }}>
                            {app.products?.image_url ? (
                              <img
                                src={app.products.image_url}
                                alt={app.products.title}
                                style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: '2px solid #22c55e' }}
                              />
                            ) : '-'}
                          </td>
                          <td style={{ padding: '10px 10px' }}>{app.products?.title || '-'}</td>
                          <td style={{ padding: '10px 10px' }}>{app.products?.category || '-'}</td>
                          <td style={{ padding: '10px 10px' }}>{app.products?.commission_value ? `${app.products.commission_value}${app.products.commission_type === 'percentage' ? '%' : ''}` : '-'}</td>
                          <td style={{ padding: '10px 10px' }}>{app.products?.sale_price ? `$${Number(app.products.sale_price).toFixed(2)}` : '-'}</td>
                          <td style={{ padding: '10px 10px' }}>
                            {app.status === 'approved' && <span style={{ color: '#22c55e', fontWeight: 600 }}>Approved</span>}
                            {app.status === 'pending' && <span style={{ color: '#facc15', fontWeight: 600 }}>Pending</span>}
                            {app.status === 'rejected' && <span style={{ color: '#ef4444', fontWeight: 600 }}>Rejected</span>}
                            {!['approved','pending','rejected'].includes(app.status) && <span>{app.status}</span>}
                          </td>
                          <td style={{ padding: '10px 10px' }}>
                            <button
                              type="button"
                              disabled={!hasAssets}
                              style={{
                                background: hasAssets ? "#3b82f6" : "#334155",
                                color: "#fff",
                                border: "none",
                                borderRadius: 8,
                                padding: "8px 12px",
                                fontWeight: 600,
                                cursor: hasAssets ? "pointer" : "not-allowed",
                                fontSize: 16,
                                opacity: hasAssets ? 1 : 0.7,
                              }}
                              onClick={() => toggleAppAssets(app.id)}
                            >
                              {hasAssets
                                ? `${isExpanded ? "Hide" : "Show"} Assets (${assets.length})`
                                : "No Assets"}
                            </button>
                          </td>
                          <td style={{ padding: '10px 10px' }}>
                            {app.status === "approved" ? (
                              <button
                                style={{
                                  background: "#22c55e",
                                  color: "#000",
                                  border: "none",
                                  borderRadius: 8,
                                  padding: "8px 14px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  fontSize: 16
                                }}
                                onClick={() => {
                                  let url = '';
                                  if (app.products?.sales_page_url) {
                                    if (/^https?:\/\//i.test(app.products.sales_page_url)) {
                                      url = `${app.products.sales_page_url}?ref=${affiliateCookieCode}`;
                                    } else {
                                      const baseUrl = window.location.origin || 'https://yourdomain.com';
                                      url = `${baseUrl}${app.products.sales_page_url}?ref=${affiliateCookieCode}`;
                                    }
                                  } else {
                                    const baseUrl = window.location.origin || 'https://yourdomain.com';
                                    url = `${baseUrl}/product/${app.products?.id || ''}?ref=${affiliateCookieCode}`;
                                  }
                                  navigator.clipboard.writeText(url);
                                  alert("Affiliate URL copied:\n\n" + url + "\n\nPaste this link in your ad or post.");
                                }}
                              >
                                Copy Affiliate URL
                              </button>
                            ) : (
                              <span style={{ color: "#888", fontWeight: 600 }}>
                                {app.status === "pending"
                                  ? "Waiting Approval"
                                  : "Not Approved"}
                              </span>
                            )}
                          </td>
                        </tr>

                        {isExpanded && hasAssets && (
                          <tr key={`assets-${app.id}`} style={{ borderBottom: '1px solid #1e293b' }}>
                            <td colSpan={8} style={{ padding: '14px 12px', background: '#0f172a' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                                {assets.map((asset) => {
                                  const expandedText = Boolean(expandedTextByAssetId[asset.id]);
                                  const description = String(asset.description || '').trim();
                                  const showToggle = description.length > 120;

                                  return (
                                    <div key={asset.id} style={{ background: '#111827', border: '1px solid #334155', borderRadius: 12, padding: 10 }}>
                                      {asset.image_url ? (
                                        <img
                                          src={asset.image_url}
                                          alt={asset.title || 'Asset image'}
                                          title="Click to copy image"
                                          onClick={() => copyImageToClipboard(asset.image_url)}
                                          style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8, marginBottom: 8, cursor: 'copy' }}
                                        />
                                      ) : (
                                        <div style={{ width: '100%', height: 150, borderRadius: 8, marginBottom: 8, background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                          No image
                                        </div>
                                      )}

                                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 3 }}>
                                        {asset.title || 'Untitled Asset'}
                                      </div>
                                      <div style={{ fontSize: 16, color: '#93c5fd', marginBottom: 6 }}>
                                        {getAssetType(asset)}
                                      </div>

                                      <div style={{ fontSize: 16, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                                        {expandedText ? description : truncateText(description, 120) || 'No description'}
                                      </div>

                                      {showToggle && (
                                        <button
                                          type="button"
                                          style={{ marginTop: 8, background: '#334155', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 8px', fontSize: 16, cursor: 'pointer' }}
                                          onClick={() => toggleAssetText(asset.id)}
                                        >
                                          {expandedText ? 'Show less' : 'Expand text'}
                                        </button>
                                      )}

                                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                        <button
                                          type="button"
                                          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 16, cursor: 'pointer' }}
                                          onClick={() => {
                                            navigator.clipboard.writeText(description || '');
                                            alert('Asset text copied.');
                                          }}
                                        >
                                          Copy Text
                                        </button>

                                        {asset.link && (
                                          <button
                                            type="button"
                                            style={{ background: '#22c55e', color: '#04120a', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 16, cursor: 'pointer' }}
                                            onClick={() => {
                                              navigator.clipboard.writeText(asset.link);
                                              alert('Asset link copied.');
                                            }}
                                          >
                                            Copy Link
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                  {!appliedProducts.length && (
                    <tr>
                      <td colSpan={8} style={{ padding: '18px 12px', textAlign: 'center', color: '#cbd5e1' }}>
                        No affiliate applications found yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );}