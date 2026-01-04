// /pages/modules/accounting/index.js
// Accounting hub – invoices + Xero card + real Connect link + affiliate link
// UI tuned: deeper banner, bigger text, larger logo

import Link from "next/link";
import { useEffect, useState } from "react";
import ICONS from "../../../components/iconMap";
import { supabase } from "../../../utils/supabase-client";

// Use your preferred affiliate link here (pricing link works well)
const XERO_AFFILIATE_LINK =
  "https://xero5440.partnerlinks.io/q2d32hkcam61-nx0cim"; // Xero Pricing Plans link

export default function Accounting() {
  const [user, setUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data?.session?.user || null;
      setUser(u);
      if (u) {
        await fetchInvoices(u);
      } else {
        setLoadingInvoices(false);
      }
    })();
  }, []);

  async function fetchInvoices(u) {
    try {
      setLoadingInvoices(true);
      const { data, error } = await supabase
        .from("accounting_invoices")
        .select("*")
        .eq("user_id", u.id)
        .order("due_date", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error("Invoice load error:", err.message);
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }

  const handleImport = () => alert("CSV import coming soon");
  const handleExport = () => alert("CSV export coming soon");

  // REAL connect: go to API route which redirects to Xero
  const handleConnectXero = () => {
    window.location.href = "/api/integrations/xero/start";
  };

  return (
    <div className="wrap">
      {/* Banner – same style family as main dashboard, just blue for Accounting */}
      <div className="banner">
        <div className="banner-left">
          <span className="banner-icon">{ICONS.billing({ size: 48 })}</span>
          <div>
            <h1 className="banner-title">Accounting</h1>
            <p className="banner-desc">
              Manage invoices and connect your Xero account directly to GR8 RESULT.
            </p>
          </div>
        </div>
        <Link href="/dashboard">
          <button className="back-btn">← Back to Dashboard</button>
        </Link>
      </div>

      <div className="content">
        {/* ACTION BAR */}
        <div className="actions-bar">
          <button className="action-btn primary" onClick={handleImport}>
            Import CSV
          </button>
          <button className="action-btn" onClick={handleExport}>
            Export CSV
          </button>
          <button className="action-btn outline" onClick={handleConnectXero}>
            Connect Xero
          </button>
        </div>

        {/* MAIN TWO-COLUMN LAYOUT */}
        <div className="main-grid">
          {/* LEFT: Invoices */}
          <section className="panel">
            <div className="panel-header">
              <h2>Invoices overview</h2>
              <span className="section-tag">
                {user ? "Linked to your account" : "Please log in"}
              </span>
            </div>

            <div className="table-wrap">
              {loadingInvoices ? (
                <div className="empty-state">
                  <p>Loading invoices…</p>
                </div>
              ) : !user ? (
                <div className="empty-state">
                  <p>No user session.</p>
                  <p className="empty-sub">
                    Log in to view and manage your accounting data.
                  </p>
                </div>
              ) : invoices.length === 0 ? (
                <div className="empty-state">
                  <p>No invoices yet.</p>
                  <p className="empty-sub">
                    Import from CSV or connect Xero to start syncing invoices.
                  </p>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Client</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Currency</th>
                      <th>Due</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.invoice_number}</td>
                        <td>{inv.client_name}</td>
                        <td>
                          <span
                            className={`status-pill status-${(inv.status || "")
                              .toLowerCase()
                              .replace(/\s+/g, "")}`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td>{Number(inv.amount || 0).toFixed(2)}</td>
                        <td>{inv.currency || "AUD"}</td>
                        <td>
                          {inv.due_date
                            ? new Date(inv.due_date).toLocaleDateString()
                            : "—"}
                        </td>
                        <td>{inv.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* RIGHT: Xero card */}
          <section className="panel xero-panel">
            <div className="xero-header">
              <div className="xero-logo-wrap">
                <img src="/assets/images/xero.webp" alt="Xero logo" />
              </div>
              <div>
                <h2>Xero</h2>
                <p className="xero-sub">
                  Official Xero partner – sign up through our link and connect your account.
                </p>
              </div>
            </div>

            <div className="xero-body">
              <p>
                Connect GR8 RESULT to Xero to sync invoices, contacts and payments. Keep your
                store, CRM and accounting fully aligned without manual data entry.
              </p>

              <div className="xero-actions">
                <a
                  href={XERO_AFFILIATE_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="primary-large-link"
                >
                  Sign up to Xero (partner link)
                </a>
                <button className="secondary-large" onClick={handleConnectXero}>
                  Connect existing Xero account
                </button>
              </div>

              <div className="xero-note">
                <p>
                  Using the partner link ensures Xero tracks that GR8 RESULT referred you, which
                  helps support ongoing development of the platform.
                </p>
              </div>

              <div className="xero-status">
                <span className="status-dot" />
                <span>Connection flow wired – tokens storage is the next step.</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #0c121a;
          color: #fff;
          padding: 34px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          font-size: 18px;
        }

        .banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: #0ea5e9;
          padding: 20px 24px;
          border-radius: 16px;
          margin-bottom: 32px;
          width: 100%;
          max-width: 1320px;
        }

        .banner-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .banner-icon {
          background: rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          padding: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .banner-title {
          margin: 0;
          font-size: 48px;
          font-weight: 700;
        }

        .banner-desc {
          margin: 3px 0 0;
          font-size: 18px;
          opacity: 0.95;
        }

        .back-btn {
          background: rgba(15, 23, 42, 0.95);
          color: #fff;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.95);
          padding: 8px 16px;
          font-size: 18px;
          cursor: pointer;
        }

        .content {
          width: 100%;
          max-width: 1320px;
        }

        .actions-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 22px;
        }

        .action-btn {
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 16px;
          border: 1px solid #1f2937;
          background: #020617;
          color: #e5e7eb;
          cursor: pointer;
        }

        .action-btn.primary {
          background: #facc15;
          border-color: #facc15;
          color: #111827;
          font-weight: 600;
        }

        .action-btn.outline {
          border-color: #0ea5e9;
          color: #0ea5e9;
        }

        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 2.1fr) minmax(0, 1.3fr);
          gap: 20px;
        }

        @media (max-width: 1024px) {
          .main-grid {
            grid-template-columns: 1fr;
          }
        }

        .panel {
          background: #020617;
          border-radius: 16px;
          border: 1px solid #1f2937;
          padding: 18px 20px 20px;
        }

        .panel-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        h2 {
          font-size: 19px;
          margin: 0;
          font-weight: 700;
        }

        .section-tag {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 4px 9px;
          border-radius: 999px;
          background: #020617;
          border: 1px solid #1f2937;
          color: #9ca3af;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid #111827;
          background: #020617;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          font-size: 16px;
        }

        .table th,
        .table td {
          padding: 10px 11px;
          text-align: left;
          border-bottom: 1px solid #111827;
        }

        .table th {
          background: #020617;
          font-weight: 600;
          color: #e5e7eb;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 12px;
        }

        .status-paid {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }

        .status-overdue {
          background: rgba(248, 113, 113, 0.15);
          color: #fca5a5;
        }

        .status-draft {
          background: rgba(168, 163, 184, 0.15);
          color: #cbd5f5;
        }

        .empty-state {
          padding: 24px;
          text-align: center;
          font-size: 15px;
        }

        .empty-sub {
          margin-top: 6px;
          font-size: 16px;
          color: #9ca3af;
        }

        .xero-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .xero-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 8px;
        }

        .xero-logo-wrap {
          width: 250px;
          height: 100px;
          border-radius: 999px;
          background: #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 5px;
        }

        .xero-logo-wrap img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }


        .xero-sub {
          margin: 4px 0 0;
          font-size: 18px;
          color: #e4bb08ff;
        }

        .xero-body p {
          margin: 0 0 10px;
          font-size: 18px;
          color: #e5e7eb;
        }

        .xero-actions {
          display: flex;
          flex-direction: column;
          gap: 9px;
          margin: 12px 0;
        }

        .primary-large-link {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          border-radius: 999px;
          padding: 9px 18px;
          font-size: 18px;
          font-weight: 500;
          background: #0ea5e9;
          color: #020617;
          text-decoration: none;
        }

        .secondary-large {
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 18px;
          border: 1px solid #1f2937;
          background: transparent;
          color: #e5e7eb;
          cursor: pointer;
        }

        .xero-note {
          margin-top: 6px;
          padding: 16px 10px;
          border-radius: 10px;
          background: #020617;
          border: 1px solid #111827;
          font-size: 18px;
          color: #9ca3af;
        }

        .xero-status {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
          font-size: 18px;
          color: #9ca3af;
        }

        .status-dot {
          width: 9px;
          height: 12px;
          border-radius: 999px;
          background: #22c55e;
        }
      `}</style>
    </div>
  );
}
