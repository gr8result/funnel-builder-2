// /pages/admin/dashboard.js
// Real-time Admin Dashboard — live Supabase subscription + stats + recent applications.

// /pages/admin/dashboard.js
// Real-time Admin Dashboard — live Supabase subscription + stats + recent applications.

import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../../utils/supabase-client";

export default function AdminDashboard() {

  const [stats, setStats] = useState({ marketplaceUsers: 0, platformAccounts: 0, approvedVendorsCount: 0, affiliateAppsCount: 0 });
  const [recent, setRecent] = useState([]);
  const [affiliateApps, setAffiliateApps] = useState([]);
  const [platformApps, setPlatformApps] = useState([]);
  const [approvedVendors, setApprovedVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inspectUser, setInspectUser] = useState(null);
  const [viewApp, setViewApp] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorProducts, setVendorProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const pauseAccount = async (account) => {
    const reason = window.prompt("Enter pause reason for this user:", "Policy breach review in progress");
    if (!reason || !reason.trim()) return;

    try {
      const response = await fetch('/api/admin/pause-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account.id, reason: reason.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to pause account');
      await loadStats();
      alert('Account paused and user notified by email.');
    } catch (error) {
      console.error('Pause account failed:', error);
      alert(error.message || 'Failed to pause account.');
    }
  };

  const resumeAccount = async (account) => {
    try {
      const response = await fetch('/api/admin/resume-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to resume account');
      await loadStats();
      alert('Account resumed and user notified by email.');
    } catch (error) {
      console.error('Resume account failed:', error);
      alert(error.message || 'Failed to resume account.');
    }
  };

  const fetchVendorProducts = async (vendor) => {
    setLoadingProducts(true);
    setVendorProducts([]);
    try {
      const params = new URLSearchParams();
      if (vendor?.id) params.set("vendorId", vendor.id);
      if (vendor?.user_id) params.set("userId", vendor.user_id);
      if (vendor?.email) params.set("email", vendor.email);

      const response = await fetch(`/api/admin/vendor-products?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load vendor products");
      }

      setVendorProducts(payload.products || []);
    } catch (error) {
      console.error("Vendor products load failed:", error);
      setVendorProducts([]);
    }
    setLoadingProducts(false);
  };

  // Debug: Log affiliate applications to console
  useEffect(() => {
    if (!loading) {
      console.log('Affiliate Applications:', affiliateApps);
    }
  }, [affiliateApps, loading]);

  // Load all dashboard data
  const loadStats = async () => {
    setLoading(true);
    const [
      usersCountRes,
      accountsCountRes,
      approvedVendorsCountRes,
      { data: recentData },
      affiliateApiRes,
      { data: platformData },
      { data: vendorData }
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase.from("accounts").select("*", { count: "exact", head: true }),
      supabase.from("vendors").select("*", { count: "exact", head: true }),
      supabase
        .from("users")
        .select("id, name, email, created_at, verified")
        .order("created_at", { ascending: false })
        .limit(50),
      // Use server-side admin API to bypass RLS on affiliate_applications
      fetch("/api/admin/get-all-affiliates").then((r) => r.json()),
      supabase
        .from("accounts")
        .select("id, full_name, email, business_name, created_at, approved, status")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("vendors")
        .select("id, business_name, user_id, full_name, created_at, stripe_account_id, charges_enabled, email")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    const affiliateData = affiliateApiRes?.affiliates || [];
    const affiliateCount = affiliateApiRes?.count || affiliateData.length;
    setStats({
      marketplaceUsers: usersCountRes.count || 0,
      platformAccounts: accountsCountRes.count || 0,
      approvedVendorsCount: vendorData?.length || approvedVendorsCountRes.count || 0,
      affiliateAppsCount: affiliateCount,
    });
    setRecent(recentData || []);
    setAffiliateApps(affiliateData);
    setPlatformApps(platformData || []);
    setApprovedVendors(vendorData || []);
    
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
    // Real-time updates for both accounts and affiliate_applications
    const channel = supabase
      .channel("admin_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts" },
        () => loadStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "affiliate_applications" },
        () => loadStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendor_agreements" },
        () => loadStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendors" },
        () => loadStats()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      {inspectUser && (
        {/* Modal removed: now direct link from Inspect button */}
      )}
      <Head>
        <title>Admin Dashboard | Gr8 Result Digital Solutions</title>
      </Head>
      <div className="wrap">
        <div className="header">
          <div className="header-left">
            <img src="/logo/gr8result-logo.png" alt="Gr8 Result Logo" className="gr8-logo" />
            <div>
              <h1 className="dashboard-title">Admin Dashboard</h1>
              <div className="dashboard-subtitle">Manage user and affiliate applications</div>
            </div>
          </div>
          <div className="nav-buttons">
            <Link href="/dev/spreadsheet" className="btn purple">📊 Developer Dashboard</Link>
          </div>
        </div>

        {loading ? (
          <p>Loading dashboard data...</p>
        ) : (
          <>
            <div className="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, marginBottom: 32 }}>
              <div className="card stat-purple"><h3>Approved Vendors</h3><p>{stats.approvedVendorsCount}</p></div>
              <div className="card stat-green"><h3>Platform Accounts</h3><p>{stats.platformAccounts}</p></div>
              <div className="card stat-blue"><h3>Marketplace Users</h3><p>{stats.marketplaceUsers}</p></div>
              <div className="card stat-orange"><h3>Affiliate Applications</h3><p>{stats.affiliateAppsCount}</p></div>
            </div>

            {/* Approved Vendors Section */}
            <div className="section section-purple">
              <h2>Approved Vendors</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Created</th>
                    <th>Payments</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedVendors.map((vendor) => {
                    return (
                      <tr key={"vendor-" + vendor.id}>
                        <td>{vendor.business_name || "—"}</td>
                        <td>{vendor.email || "—"}</td>
                        <td>{vendor.full_name || "—"}</td>
                        <td>{vendor.created_at ? new Date(vendor.created_at).toLocaleDateString("en-AU") : "—"}</td>
                        <td>
                          <span className={`pill ${vendor.charges_enabled ? 'green' : 'yellow'}`}>
                            {vendor.charges_enabled ? 'Charges Enabled' : 'Stripe Pending'}
                          </span>
                        </td>
                        <td>
                          <button
                            style={{ padding: '6px 14px', borderRadius: 8, background: '#3b82f6', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedVendor(vendor);
                              fetchVendorProducts(vendor);
                            }}
                          >
                            View Products
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {approvedVendors.length === 0 && (
                    <tr><td colSpan="6">No approved vendors found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Vendor Products Modal */}
            {selectedVendor && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#181f2e', color: '#fff', borderRadius: 12, padding: 32, minWidth: 420, maxWidth: 800, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>
                  <h2 style={{ color: '#22c55e', marginBottom: 18 }}>Products for {selectedVendor.business_name}</h2>
                  {loadingProducts ? (
                    <p>Loading products...</p>
                  ) : vendorProducts.length === 0 ? (
                    <p>No products found for this vendor.</p>
                  ) : (
                    <table style={{ width: '100%', fontSize: 16, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Description</th>
                          <th>Price</th>
                          <th>Status</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorProducts.map((p) => (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td>{p.type || "—"}</td>
                            <td>{p.description}</td>
                            <td>{p.price}</td>
                            <td>{p.status}</td>
                            <td>{p.created_at ? new Date(p.created_at).toLocaleDateString("en-AU") : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div style={{ textAlign: 'right', marginTop: 24 }}>
                    <button style={{ padding: '8px 22px', borderRadius: 8, background: '#3b82f6', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 16 }}
                      onClick={() => { setSelectedVendor(null); setVendorProducts([]); }}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="section section-green">
              <h2>Platform User Applications</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Company</th><th>Created</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {platformApps.length === 0
                    ? <tr><td colSpan="6">No platform user applications.</td></tr>
                    : platformApps.map((a) => (
                        <tr key={a.id}>
                          <td>{a.full_name || "—"}</td>
                          <td>{a.email}</td>
                          <td>{a.business_name || "—"}</td>
                          <td>{a.created_at ? new Date(a.created_at).toLocaleDateString("en-AU") : "—"}</td>
                            <td>{a.status === 'paused' ? <span className="pill red">Paused</span> :
                              a.status === 'approved' || a.approved ? <span className="pill green">Approved</span> :
                              a.status === 'denied' ? <span className="pill red">Denied</span> :
                              <span className="pill yellow">Pending</span>}
                          </td>
                          <td>
                            <a
                              href={`/admin/user/${a.id}`}
                              style={{ padding: '6px 14px', borderRadius: 8, background: '#3b82f6', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', marginRight: 8, textDecoration: 'none', display: 'inline-block' }}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Inspect
                            </a>
                            {a.status === 'paused' ? (
                              <button style={{ padding: '6px 14px', borderRadius: 8, background: '#22c55e', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', marginRight: 8 }}
                                onClick={() => resumeAccount(a)}>
                                Resume
                              </button>
                            ) : (
                              <button style={{ padding: '6px 14px', borderRadius: 8, background: '#f59e0b', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', marginRight: 8 }}
                                onClick={() => pauseAccount(a)}>
                                Pause
                              </button>
                            )}
                            {(!a.approved && a.status !== 'approved' && a.status !== 'paused') && (
                              <>
                                <button style={{ padding: '6px 14px', borderRadius: 8, background: '#22c55e', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', marginRight: 8 }}
                                  onClick={async () => {
                                    const res = await fetch('/api/admin/approve-user', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: a.id }),
                                    });
                                    const data = await res.json();
                                    if (!res.ok) {
                                      alert('Approval failed: ' + (data.error || 'Unknown error'));
                                      return;
                                    }
                                    if (data.emailStatus === 'failed') {
                                      alert('✅ User approved, but the confirmation email FAILED to send.\n\nReason: ' + (data.emailError || 'Unknown') + '\n\nCheck that RESEND_API_KEY is set and the domain is verified.');
                                    } else {
                                      alert('✅ User approved and confirmation email sent to ' + a.email);
                                    }
                                    loadStats();
                                  }}>Approve</button>
                                <button style={{ padding: '6px 14px', borderRadius: 8, background: '#ef4444', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                                  onClick={async () => {
                                    await supabase.from('accounts').update({ approved: false, status: 'denied' }).eq('id', a.id);
                                    loadStats();
                                  }}>Deny</button>
                              </>
                            )}
                            {(a.approved || a.status === 'approved') && (
                              <button style={{ padding: '6px 14px', borderRadius: 8, background: '#7c3aed', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', marginLeft: 4 }}
                                onClick={async () => {
                                  const res = await fetch('/api/admin/approve-user', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: a.id }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok) {
                                    alert('Failed: ' + (data.error || 'Unknown error'));
                                    return;
                                  }
                                  if (data.emailStatus === 'failed') {
                                    alert('Email FAILED to send.\n\nReason: ' + (data.emailError || 'Unknown') + '\n\nCheck RESEND_API_KEY and domain verification in Resend dashboard.');
                                  } else {
                                    alert('Approval email resent to ' + a.email);
                                  }
                                }}>Resend Email</button>
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Marketplace User Applications Section */}
            <div className="section section-blue">
              <h2>Marketplace User Applications</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Created</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent && recent.length === 0
                    ? <tr><td colSpan="4">No recent applications.</td></tr>
                    : (recent || []).map((r) => (
                        <tr key={r.id}>
                          <td>{r.name || "—"}</td>
                          <td>{r.email}</td>
                          <td>{r.created_at ? new Date(r.created_at).toLocaleDateString("en-AU") : "—"}</td>
                          <td>{r.verified === true ? <span className="pill green">Approved</span> : <span className="pill yellow">Pending</span>}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Affiliate Applications Section */}
            <div className="section section-orange">
              <h2>Affiliate Applications</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Company</th><th>Created</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {affiliateApps.length === 0
                    ? <tr><td colSpan="6">No affiliate applications.</td></tr>
                    : affiliateApps.map((a) => (
                        <tr key={a.id}>
                            <td>{a.name || "—"}</td>
                            <td>{a.email}</td>
                            <td>{a.business_name || "—"}</td>
                            <td>{a.created_at ? new Date(a.created_at).toLocaleDateString("en-AU") : "—"}</td>
                            <td>{a.status === 'approved' ? <span className="pill green">Approved</span> :
                              a.status === 'denied' ? <span className="pill red">Denied</span> :
                              <span className="pill yellow">Pending</span>}
                            </td>
                          <td>
                            <button style={{ padding: '6px 14px', borderRadius: 8, background: '#3b82f6', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', marginRight: 8 }}
                              onClick={() => setViewApp(a)}>
                              Inspect
                            </button>
                            <button style={{ padding: '6px 14px', borderRadius: 8, background: '#22c55e', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', marginRight: 8 }}
                              onClick={async () => {
                                const response = await fetch('/api/admin/approve-affiliate', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: a.id }),
                                });
                                const payload = await response.json().catch(() => ({}));
                                if (!response.ok) {
                                  alert(payload.error || 'Failed to approve affiliate application. Check server logs.');
                                  return;
                                }
                                await loadStats();
                              }}>
                              Approve
                            </button>
                            <button style={{ padding: '6px 14px', borderRadius: 8, background: '#ef4444', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                              onClick={async () => {
                                if (confirm('Deny this affiliate application?')) {
                                  const response = await fetch('/api/admin/deny-affiliate', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: a.id }),
                                  });
                                  const payload = await response.json().catch(() => ({}));
                                  if (!response.ok) {
                                    alert(payload.error || 'Failed to deny affiliate application. Check server logs.');
                                    return;
                                  }
                                  await loadStats();
                                }
                              }}>
                              Deny
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Modal for viewing full affiliate application */}
            {viewApp && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#181f2e', color: '#fff', borderRadius: 16, padding: 48, minWidth: 700, maxWidth: 1200, maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>
                  <h2 style={{ color: '#22c55e', marginBottom: 24, fontSize: 32 }}>Affiliate Application</h2>
                  <table style={{ width: '100%', fontSize: 18, borderCollapse: 'collapse' }}>
                    <tbody>
                      {Object.entries(viewApp).map(([key, value]) => (
                        <tr key={key}>
                          <td style={{ fontWeight: 600, padding: '10px 18px', textAlign: 'right', verticalAlign: 'top', color: '#1de9b6', width: 220, fontSize: 18 }}>{key.replace(/_/g, ' ')}</td>
                          <td style={{ padding: '10px 18px', wordBreak: 'break-word', fontSize: 18 }}>{String(value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ textAlign: 'right', marginTop: 32 }}>
                    <button style={{ padding: '12px 32px', borderRadius: 10, background: '#3b82f6', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 18 }}
                      onClick={() => setViewApp(null)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <style jsx>{`
        .wrap {
          max-width: 1600px;
          margin: 0 auto;
          padding: 30px;
          background: #0c121a;
          color: #fff;
          min-height: 100vh;
        }
        .header {
          background: #22c55e;
          padding: 18px 22px;
          border-radius: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .gr8-logo {
          height: 56px;
          width: auto;
          border-radius: 12px;
        }
        .dashboard-title {
          font-size: 48px;
          font-weight: 600;
          margin: 0;
        }
        .dashboard-subtitle {
          font-size: 18px;
          font-weight: 500;
          opacity: 0.95;
          margin-top: 6px;
        }
        .nav-buttons{display:flex;gap:10px;}
        .btn{background:#111827;color:#fff;text-decoration:none;padding:8px 14px;border:1px solid #fff;border-radius:6px;font-weight:700;transition:0.2s;}
        .btn:hover{background:#1e293b;}
        .btn.purple{border-color:#8b5cf6;}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:32px;}
        .card{background:#111827;border-radius:10px;padding:20px;text-align:center;border:2px solid transparent;}
        .stat-blue{border-color:#3b82f6;}.stat-blue h3{color:#3b82f6;}
        .stat-green{border-color:#22c55e;}.stat-green h3{color:#22c55e;}
        .stat-purple{border-color:#8b5cf6;}.stat-purple h3{color:#8b5cf6;}
        .stat-teal{border-color:#06b6d4;}.stat-teal h3{color:#06b6d4;}
        .stat-orange{border-color:#f97316;}.stat-orange h3{color:#f97316;}
        .card h3{font-size:15px;font-weight:600;} .card p{font-size:28px;font-weight:600;margin:8px 0 0;}
        .section h2{font-size:22px;font-weight:700;margin-bottom:12px;}
        .section-purple h2{color:#8b5cf6;}
        .section-green h2{color:#22c55e;}
        .section-blue h2{color:#3b82f6;}
        .section-teal h2{color:#06b6d4;}
        .section-orange h2{color:#f97316;}
        table{width:100%;border-collapse:collapse;}
        th,td{padding:10px;border-bottom:1px solid #1f2937;text-align:left;}
        th{background:#111827;font-weight:600;opacity:0.9;}
        td{background:#0f172a;}
        .pill{padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;}
        .pill.green{background:rgba(34,197,94,0.15);color:#86efac;border:1px solid #16a34a;}
        .pill.yellow{background:rgba(250,204,21,0.15);color:#fde047;border:1px solid #facc15;}
        .pill.red{background:rgba(239,68,68,0.15);color:#f87171;border:1px solid #ef4444;}
      `}</style>
      </div>
  );
}


