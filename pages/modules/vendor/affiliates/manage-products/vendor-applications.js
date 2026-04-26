// modules/vendor/affiliates/manage-products/vendor-applications.js 

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../../../utils/supabase-client";
import ICONS from "../../../../../components/iconMap";
import VendorUserBanner from "../../../../../components/vendor/VendorUserBanner";

export default function VendorApplications() {
  const router = useRouter();

  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [modalApp, setModalApp] = useState(null);

  // ✅ ADDED SORT STATE
  const [sortKey, setSortKey] = useState("status");
  const [sortDir, setSortDir] = useState("desc");

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const page = useMemo(() => {
    return {
      wrap: {
        minHeight: "100vh",
        background: "#0c121a",
        color: "#fff",
        padding: "28px 22px",
        display: "flex",
        justifyContent: "center",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        fontSize: 18,
        fontWeight: 600,
      },
      inner: { width: "100%", maxWidth: 1320 },
      banner: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "#f59e0b",
        borderRadius: 14,
        padding: "18px 22px",
        marginBottom: 18,
        gap: 14,
      },
      bannerLeft: {
        display: "flex",
        alignItems: "center",
        gap: 14,
      },
      iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 12,
        background: "rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
      bannerTitle: {
        fontSize: 48,
        fontWeight: 600,
        margin: 0,
        lineHeight: 1.1,
      },
      bannerSubtitle: {
        fontSize: 18,
        marginTop: 6,
        opacity: 0.95,
        fontWeight: 600,
      },
      btn: {
        background: "#1e293b",
        color: "#fff",
        border: "1px solid #334155",
        borderRadius: 10,
        padding: "10px 18px",
        fontSize: 18,
        cursor: "pointer",
        fontWeight: 600,
      },
      grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        gap: 16,
      },
      card: {
        background: "#111827",
        borderRadius: 14,
        padding: 16,
        border: "1px solid rgba(255,255,255,0.1)",
      },
      row: {
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
      },
      title: {
        fontSize: 20,
        fontWeight: 600,
      },
      meta: {
        marginTop: 10,
        fontSize: 16,
        lineHeight: 1.45,
        opacity: 0.9,
      },
      message: {
        marginTop: 10,
        background: "#0b1220",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        maxHeight: 260,
        overflow: "auto",
        whiteSpace: "pre-wrap",
      },
      actions: {
        display: "flex",
        gap: 10,
        marginTop: 12,
      },
      approve: {
        background: "#22c55e",
        color: "#000",
        border: "none",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 16,
        fontWeight: 600,
        cursor: "pointer",
      },
      decline: {
        background: "#ef4444",
        color: "#fff",
        border: "none",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 16,
        fontWeight: 600,
        cursor: "pointer",
      },
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      let resolvedOwnerUserId = null;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        resolvedOwnerUserId = user.id;
      }

      const marketplaceCode =
        typeof window !== "undefined"
          ? localStorage.getItem("xchange_user_code") || ""
          : "";

      // Marketplace-only vendors can access this route without a Supabase auth session.
      if (!resolvedOwnerUserId && marketplaceCode) {
        try {
          const accessResp = await fetch(
            `/api/marketplace/vendor-access?code=${encodeURIComponent(marketplaceCode)}`
          );
          const accessPayload = await accessResp.json();
          if (accessResp.ok && accessPayload?.allowed) {
            resolvedOwnerUserId = accessPayload.authUserId || accessPayload.userId || null;
          }
        } catch (lookupError) {
          console.error("Vendor access lookup failed:", lookupError);
        }
      }

      if (!resolvedOwnerUserId) {
        setError("Could not resolve vendor session for applications.");
        setApps([]);
        setLoading(false);
        return;
      }

      const { data: ownedProducts, error: ownedProductsError } = await supabase
        .from("affiliate_products")
        .select("id")
        .eq("owner_user_id", resolvedOwnerUserId);

      if (ownedProductsError) {
        setError(ownedProductsError.message);
        setApps([]);
        setLoading(false);
        return;
      }

      const ownedProductIds = (ownedProducts || []).map((p) => p.id);
      if (ownedProductIds.length === 0) {
        setApps([]);
        setLoading(false);
        return;
      }

      const { data: appsData, error } = await supabase
        .from("affiliate_product_applications")
        .select(`
          id,
          status,
          affiliate_user_id,
          product_id,
          product:affiliate_products(id, title, image_url, sale_price, commission_value, commission_type)
        `)
        .in("product_id", ownedProductIds);

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const affiliateUserIds = [...new Set((appsData || []).map(a => a.affiliate_user_id).filter(Boolean))];
      let affiliateNames = {};

      if (affiliateUserIds.length > 0) {
        const { data: affiliates } = await supabase
          .from('affiliate_applications')
          .select('affiliate_user_id, name')
          .in('affiliate_user_id', affiliateUserIds);

        affiliateNames = (affiliates || []).reduce((acc, a) => { acc[a.affiliate_user_id] = a.name; return acc; }, {});
      }

      const appsWithNames = (appsData || []).map(app => ({
        ...app,
        affiliate_name: affiliateNames[app.affiliate_user_id] || app.affiliate_user_id
      }));

      setApps(appsWithNames);
      setLoading(false);
    };
    load();
  }, []);

  // ✅ SORT LOGIC
  const sortedApps = useMemo(() => {
    const sorted = [...apps];

    sorted.sort((a, b) => {
      let aVal, bVal;

      switch (sortKey) {
        case "product":
          aVal = a.product?.title || "";
          bVal = b.product?.title || "";
          break;
        case "price":
          aVal = a.product?.sale_price || 0;
          bVal = b.product?.sale_price || 0;
          break;
        case "commission":
          aVal = a.product?.commission_value || 0;
          bVal = b.product?.commission_value || 0;
          break;
        case "affiliate":
          aVal = a.affiliate_name || "";
          bVal = b.affiliate_name || "";
          break;
        case "status":
          aVal = a.status || "";
          bVal = b.status || "";
          break;
        default:
          aVal = a.status || "";
          bVal = b.status || "";
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [apps, sortKey, sortDir]);

  async function handleApproveDeny(applicationId, approve) {
    try {
      const res = await fetch('/api/affiliate-application-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: applicationId, approved: approve })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert('Failed to update status.');
      }
    } catch (e) {
      alert('Error updating status.');
    }
  }

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        <div style={page.banner}>
          <div style={page.bannerLeft}>
            <div style={page.iconWrap}>
              {ICONS.approvals({ size: 48 })}
            </div>
            <div>
              <div style={page.bannerTitle}>Applications from Affiliates</div>
              <div style={page.bannerSubtitle}>
                Manage your Affiliate applications to sell our products
              </div>
            </div>
          </div>
          <button style={page.btn} onClick={() => router.back()}>
            ← Back
          </button>
        </div>

        <VendorUserBanner />

        {loading ? (
          <div>Loading…</div>
        ) : error ? (
          <div style={{ color: "#f87171", fontSize: 20 }}>Error: {error}</div>
        ) : (
          <table style={{ width: "100%", background: "#111827", borderRadius: 12, borderCollapse: "collapse", overflow: "hidden" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937", fontWeight: 600, color: "#ccc", fontSize: 16 }}>Image</th>
                <th onClick={() => toggleSort("product")} style={{ cursor: "pointer", textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937", fontWeight: 600, color: "#ccc", fontSize: 16 }}>Product Name</th>
                <th onClick={() => toggleSort("price")} style={{ cursor: "pointer", textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937", fontWeight: 600, color: "#ccc", fontSize: 16 }}>Sale Price</th>
                <th onClick={() => toggleSort("commission")} style={{ cursor: "pointer", textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937", fontWeight: 600, color: "#ccc", fontSize: 16 }}>Commission %</th>
                <th onClick={() => toggleSort("affiliate")} style={{ cursor: "pointer", textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937", fontWeight: 600, color: "#ccc", fontSize: 16 }}>Affiliate Name</th>
                <th onClick={() => toggleSort("status")} style={{ cursor: "pointer", textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937", fontWeight: 600, color: "#ccc", fontSize: 16 }}>Status</th>
                <th style={{ textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937", fontWeight: 600, color: "#ccc", fontSize: 16 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {apps.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#888', fontSize: 20, padding: 32 }}>
                    No affiliate product applications found.
                  </td>
                </tr>
              ) : (
                sortedApps.map((app) => (
                  <tr key={app.id} style={{ fontSize: 20, fontWeight: 500, letterSpacing: 0.2 }}>
                                       <td style={{ textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937" }}>
                      {app.product?.image_url ? (
                        <img src={app.product.image_url} alt={app.product?.title || 'Product'} style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '2px solid #f59e0b' }} />
                      ) : (
                        <div style={{ width: 64, height: 64, borderRadius: 8, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#fff', fontWeight: 900 }}>🛒</div>
                      )}
                    </td>
                    <td style={{ textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937" }}>{app.product?.title || `Product: ${app.product_id}`}</td>
                    <td style={{ textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937" }}>
                      {typeof app.product?.sale_price === 'number' ? `$${app.product.sale_price.toFixed(2)}` : <span style={{color:'#ef4444'}}>No price</span>}
                    </td>
                    <td style={{ textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937" }}>
                      {app.product?.commission_type === 'percentage' && typeof app.product?.commission_value === 'number'
                        ? `${app.product.commission_value}%`
                        : <span style={{color:'#ef4444'}}>No %</span>}
                    </td>
                    <td style={{ textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937", minWidth: 180 }}>
                      {app.affiliate_name}
                    </td>
                    <td style={{ textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937" }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '6px 18px',
                        borderRadius: 16,
                        background: app.status === 'approved' ? '#22c55e' : '#f59e0b',
                        color: '#222',
                        fontWeight: 700,
                        fontSize: 16
                      }}>{app.status === 'approved' ? 'Approved' : 'Pending'}</span>
                    </td>
                    <td style={{ textAlign: "center", padding: "8px 8px", borderBottom: "1px solid #1f2937" }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <button
                          style={{ background: '#f59e0b', color: '#222', border: 'none', borderRadius: 10, padding: '10px 0', fontWeight: 700, fontSize: 18, cursor: 'pointer', width: 120 }}
                          onClick={async () => {
                            const { data: affiliateApp } = await supabase
                              .from('affiliate_applications')
                              .select('*')
                              .eq('affiliate_user_id', app.affiliate_user_id)
                              .order('created_at', { ascending: false })
                              .limit(1);
                            setModalApp(affiliateApp && affiliateApp[0] ? affiliateApp[0] : { affiliate_user_id: app.affiliate_user_id });
                          }}
                        >Investigate</button>
                        <button
                          style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 10, padding: '10px 0', fontWeight: 700, fontSize: 18, cursor: 'pointer', width: 120 }}
                          onClick={async () => {
                            await fetch('/api/affiliate-application-status', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: app.id, approved: true })
                            });
                            window.location.reload();
                          }}
                        >Approve</button>
                        <button
                          style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 0', fontWeight: 700, fontSize: 18, cursor: 'pointer', width: 120 }}
                          onClick={async () => {
                            await fetch('/api/affiliate-application-status', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: app.id, approved: false })
                            });
                            window.location.reload();
                          }}
                        >Deny</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {modalApp && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#181f2e', color: '#fff', borderRadius: 16, padding: 48, minWidth: 700, maxWidth: 1200, maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>
              <h2 style={{ color: '#22c55e', marginBottom: 24, fontSize: 32 }}>Affiliate Application</h2>
              <table style={{ width: '100%', fontSize: 18, borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['id', modalApp.id],
                    ['name', modalApp.name],
                    ['email', modalApp.email],
                    ['business name', modalApp.business_name],
                    ['phone number', modalApp.phone_number],
                    ['website', modalApp.website],
                    ['abn tax number', modalApp.abn_tax_number],
                    ['affiliate user id', modalApp.affiliate_user_id],
                    ['facebook handle', modalApp.facebook_handle],
                    ['instagram handle', modalApp.instagram_handle],
                    ['linkedin handle', modalApp.linkedin_handle],
                    ['tictoc handle', modalApp.tictoc_handle],
                    ['youtube handle', modalApp.youtube_handle],
                    ['pintrest handle', modalApp.pintrest_handle],
                    ['other social media handles', modalApp.other_social_media_handles],
                    ['marketing tools', modalApp.marketing_tools],
                    ['experience years', modalApp.experience_years],
                    ['paypal', modalApp.paypal],
                    ['paypal user email', modalApp.paypal_user_email],
                    ['bank account', modalApp.bank_account],
                    ['bank account details', modalApp.bank_account_details],
                    ['bsb number', modalApp.bsb_number],
                    ['account number', modalApp.account_number],
                    ['swift code', modalApp.swift_code],
                    ['sent to vendor', modalApp.sent_to_vendor],
                    ['created at', modalApp.created_at],
                    ['email confirmed', modalApp.email_confirmed],
                    ['approved', modalApp.approved],
                    ['status', modalApp.status],
                    ['submitted date', modalApp.submitted_date],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td style={{ fontWeight: 700, padding: '10px 18px', textAlign: 'right', verticalAlign: 'top', color: '#1de9b6', width: 220, fontSize: 18 }}>{label}</td>
                      <td style={{ padding: '10px 18px', wordBreak: 'break-word', fontSize: 18 }}>{value !== undefined && value !== null ? String(value) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'right', marginTop: 32 }}>
                <button style={{ padding: '12px 32px', borderRadius: 10, background: '#3b82f6', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 18 }} onClick={() => setModalApp(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 