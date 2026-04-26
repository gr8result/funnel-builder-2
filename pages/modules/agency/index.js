// /pages/modules/agency/index.js

import { useState } from "react";

export default function AgencyDashboard() {
  const [clients] = useState([
    { id: 1, name: "ABC Homes", plan: "Pro", contacts: 12400, emails: 8200, status: "Active" },
    { id: 2, name: "XYZ Builds", plan: "Growth", contacts: 3200, emails: 1500, status: "Active" },
  ]);

  const totalContacts = clients.reduce((a, c) => a + c.contacts, 0);
  const totalEmails = clients.reduce((a, c) => a + c.emails, 0);

  return (
    <div style={styles.wrap}>
      <div style={styles.container}>

        {/* Banner */}
        <div style={styles.banner}>
          <div style={styles.bannerLeft}>
            <div style={styles.bannerIcon}>🏢</div>
            <div>
              <h1 style={styles.bannerTitle}>Agency Dashboard</h1>
              <div style={styles.bannerSubtitle}>Manage all your client accounts in one place</div>
            </div>
          </div>

          <button style={styles.backBtn} onClick={() => window.history.back()}>
            ← Back
          </button>
        </div>

        {/* Stats */}
        <div style={styles.statsGrid}>
          <Stat label="Clients" value={clients.length} />
          <Stat label="Contacts" value={totalContacts.toLocaleString()} />
          <Stat label="Emails Sent" value={totalEmails.toLocaleString()} />
          <Stat label="MRR" value="$2,589" highlight />
        </div>

        {/* Client List */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>Client Accounts</div>

          <div style={styles.clientList}>
            {clients.map((c) => (
              <div key={c.id} style={styles.clientRow}>

                <div style={styles.clientLeft}>
                  <div style={styles.avatar}>{c.name.charAt(0)}</div>
                  <div>
                    <div style={styles.clientName}>{c.name}</div>
                    <div style={styles.clientSub}>
                      {c.contacts.toLocaleString()} contacts
                    </div>
                  </div>
                </div>

                <div style={styles.clientStats}>
                  <Badge text={c.plan} type="plan" />
                  <div style={styles.metric}>{c.emails.toLocaleString()} emails</div>
                  <Badge text={c.status} type="status" />
                </div>

                <div>
                  <button style={styles.manageBtn}>Manage</button>
                </div>

              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div
      style={{
        ...styles.statCard,
        border: highlight ? "1px solid #3b82f6" : "1px solid #1e293b",
        boxShadow: highlight ? "0 0 20px rgba(59,130,246,0.25)" : "none",
      }}
    >
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function Badge({ text, type }) {
  const colors = {
    plan: "#3b82f6",
    status: "#10b981",
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${colors[type]}`,
        color: colors[type],
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {text}
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "30px 20px",
  },

  container: {
    maxWidth: 1200,
    margin: "0 auto",
  },

  banner: {
    maxWidth: 1320,
    margin: "0 auto 30px auto",
    background: "#10b981",
    borderRadius: 14,
    padding: "18px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  bannerIcon: {
    fontSize: 48,
  },

  bannerTitle: {
    fontSize: 44,
    fontWeight: 600,
    margin: 0,
  },

  bannerSubtitle: {
    fontSize: 18,
    opacity: 0.9,
  },

  backBtn: {
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 30,
  },

  statCard: {
    background: "#111827",
    padding: 20,
    borderRadius: 12,
  },

  statValue: {
    fontSize: 24,
    fontWeight: 700,
  },

  statLabel: {
    fontSize: 13,
    opacity: 0.6,
  },

  card: {
    background: "#111827",
    borderRadius: 12,
    padding: 20,
    border: "1px solid #1e293b",
  },

  cardHeader: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 16,
  },

  clientList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  clientRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid #1e293b",
  },

  clientLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#10b981",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },

  clientName: {
    fontWeight: 600,
  },

  clientSub: {
    fontSize: 12,
    opacity: 0.6,
  },

  clientStats: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  metric: {
    fontSize: 13,
    opacity: 0.8,
  },

  manageBtn: {
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
  },
};