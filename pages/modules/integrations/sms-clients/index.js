// pages/modules/integrations/sms-clients/index.js
// Admin dashboard to approve/manage SMS clients

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../utils/supabase-client";

export default function SMSClientsAdmin() {
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);  // SMS client applications
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [approving, setApproving] = useState({});  // Track which are being approved

  const page = useMemo(() => ({
    wrap: {
      minHeight: "100vh",
      background: "#0c121a",
      color: "#fff",
      padding: "28px 22px",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      display: "flex",
      justifyContent: "center",
      fontSize: 16,
      fontWeight: 400,
    },
    inner: { width: "100%", maxWidth: 1400 },
    banner: {
      display: "flex",
      alignItems: "center",
      gap: 18,
      background: "#0284c7",
      padding: "26px 30px",
      borderRadius: 14,
      marginBottom: 30,
    },
    title: { fontSize: 48, fontWeight: 600, margin: 0, lineHeight: 1.1 },
    subtitle: { fontSize: 18, opacity: 0.95, marginTop: 4, fontWeight: 500 },
    error: {
      background: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.35)",
      padding: "10px 12px",
      borderRadius: 12,
      fontSize: 16,
      fontWeight: 600,
      marginBottom: 12,
    },
    toast: {
      background: "rgba(34,197,94,0.10)",
      border: "1px solid rgba(34,197,94,0.30)",
      padding: "10px 12px",
      borderRadius: 12,
      fontSize: 16,
      fontWeight: 600,
      marginBottom: 12,
    },
    empty: {
      textAlign: "center",
      padding: "60px 0",
      opacity: 0.7,
      fontSize: 16,
      fontWeight: 600,
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 12,
      overflow: "hidden",
    },
    th: {
      background: "rgba(255,255,255,0.05)",
      padding: "14px",
      textAlign: "left",
      fontWeight: 600,
      borderBottom: "1px solid rgba(255,255,255,0.10)",
    },
    td: {
      padding: "14px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      verticalAlign: "top",
    },
    tr: {
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    },
    trHover: {
      background: "rgba(255,255,255,0.02)",
      cursor: "pointer",
    },
    status: (st) => ({
      display: "inline-block",
      padding: "4px 8px",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      background:
        st === "approved"
          ? "rgba(34,197,94,0.18)"
          : st === "pending"
          ? "rgba(245,158,11,0.18)"
          : "rgba(239,68,68,0.18)",
      color: "#fff",
      border:
        st === "approved"
          ? "1px solid rgba(34,197,94,0.45)"
          : st === "pending"
          ? "1px solid rgba(245,158,11,0.45)"
          : "1px solid rgba(239,68,68,0.45)",
    }),
    btn: {
      background: "#0284c7",
      border: "none",
      color: "#fff",
      padding: "8px 14px",
      borderRadius: 8,
      fontSize: 13,
      cursor: "pointer",
      fontWeight: 600,
      whiteSpace: "nowrap",
    },
    btnDisabled: {
      background: "rgba(148,163,184,0.14)",
      color: "rgba(255,255,255,0.45)",
      cursor: "not-allowed",
      opacity: 0.75,
      pointerEvents: "none",
    },
    detailsRow: {
      background: "rgba(255,255,255,0.02)",
      padding: "12px 14px",
      fontSize: 13,
      opacity: 0.9,
    },
  }), []);

  const fetchClients = async () => {
    setLoading(true);
    setErr("");

    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        setErr("Not logged in");
        return;
      }
      setUser(u.user);

      // Get all accounts that need SMS approval
      // (In production, you'd have a proper "sms_applications" table)
      const { data: accounts, error: accErr } = await supabase
        .from("accounts")
        .select("id,user_id,business_name,email,sms_activated,sender_id,sms_current_balance,created_at")
        .order("created_at", { ascending: false });

      if (accErr) throw accErr;

      // Filter to show accounts needing SMS approval or already approved
      const clientsList = (accounts || [])
        .filter(a => !a.sms_activated || a.sender_id)  // Show unapproved or approved
        .map((a, idx) => ({
          id: a.id,
          user_id: a.user_id,
          business_name: a.business_name || "Unnamed",
          email: a.email || "no-email",
          status: a.sms_activated ? "approved" : "pending",
          sender_id: a.sender_id || "—",
          balance: a.sms_current_balance || 0,
          created_at: a.created_at,
        }));

      setClients(clientsList);
    } catch (e) {
      setErr(e?.message || "Failed to load SMS clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const approveSmsClient = async (client) => {
    setApproving(prev => ({ ...prev, [client.id]: true }));
    setErr("");

    try {
      // Get user email for subaccount
      const { data: userData } = await supabase
        .from("auth.users")
        .select("email")
        .eq("id", client.user_id)
        .single();

      const userEmail = userData?.email || client.email;

      console.log("📱 Approving SMS client:", {
        user_id: client.user_id,
        business_name: client.business_name,
        email: userEmail,
      });

      // Call approval endpoint
      const approvalRes = await fetch("/api/onboarding/approve-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: client.user_id,
          businessName: client.business_name,
          email: userEmail,
          applicationId: client.id,
        }),
      });

      const result = await approvalRes.json();

      if (!approvalRes.ok || !result.ok) {
        throw new Error(result.error || "Approval failed");
      }

      console.log("✅ SMS client approved:", result);
      setToast(`✅ ${client.business_name} approved with $${result.sms_balance} balance`);
      
      // Refresh list
      setTimeout(() => fetchClients(), 1500);
    } catch (e) {
      console.error("❌ Approval error:", e);
      setErr(`Failed to approve ${client.business_name}: ${e.message}`);
    } finally {
      setApproving(prev => ({ ...prev, [client.id]: false }));
    }
  };

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        {/* BANNER */}
        <div style={page.banner}>
          <div>
            <h1 style={page.title}>📱 SMS Clients</h1>
            <p style={page.subtitle}>Manage SMS account approvals & funding</p>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <Link href="/modules/integrations">
              <button style={page.btn}>← Back</button>
            </Link>
          </div>
        </div>

        {err && <div style={page.error}>✖ {err}</div>}
        {toast && <div style={page.toast}>✓ {toast}</div>}

        {loading ? (
          <div style={{ opacity: 0.9, fontSize: 16, fontWeight: 600 }}>Loading…</div>
        ) : clients.length === 0 ? (
          <div style={page.empty}>No SMS clients found</div>
        ) : (
          <table style={page.table}>
            <thead>
              <tr style={page.tr}>
                <th style={page.th}>Business Name</th>
                <th style={page.th}>Email</th>
                <th style={page.th}>Status</th>
                <th style={page.th}>Sender ID</th>
                <th style={page.th}>Balance</th>
                <th style={page.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} style={{ ...page.tr, ...page.trHover }}>
                  <td style={page.td}>
                    <strong>{client.business_name}</strong>
                  </td>
                  <td style={page.td}>{client.email}</td>
                  <td style={page.td}>
                    <div style={page.status(client.status)}>
                      {client.status.toUpperCase()}
                    </div>
                  </td>
                  <td style={page.td}>{client.sender_id}</td>
                  <td style={page.td}>
                    {client.status === "approved" ? (
                      <span style={{ color: "#22c55e" }}>
                        ${Number(client.balance || 0).toFixed(2)}
                      </span>
                    ) : (
                      <span style={{ opacity: 0.6 }}>—</span>
                    )}
                  </td>
                  <td style={page.td}>
                    {client.status === "approved" ? (
                      <span style={{ opacity: 0.6, fontSize: 13 }}>✓ Approved</span>
                    ) : (
                      <button
                        style={{
                          ...page.btn,
                          ...(approving[client.id] ? page.btnDisabled : {}),
                        }}
                        onClick={() => approveSmsClient(client)}
                        disabled={approving[client.id]}
                      >
                        {approving[client.id] ? "Approving..." : "Approve"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
