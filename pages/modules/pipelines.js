// /pages/modules/pipelines/index.js
// Subscription Pipelines — placeholder page with proper banner + Coming Soon

import Link from "next/link";
import ICONS from "../../components/iconMap";

export default function Pipelines() {
  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>
        {/* Banner */}
        <div style={styles.banner}>
          <div style={styles.bannerLeft}>
            <div style={styles.bannerIconWrap}>
              <span style={{ fontSize: 38, lineHeight: 1 }}>🌿</span>
            </div>
            <div>
              <h1 style={styles.bannerTitle}>Subscription Pipeline</h1>
              <p style={styles.bannerDesc}>
                Track recurring offers, upgrade paths and customer journeys.
              </p>
            </div>
          </div>

          <Link href="/dashboard">
            <button style={styles.backBtn}>← Back</button>
          </Link>
        </div>
                  {/* Coming Soon */}
          <div
            style={{
              background: "#111827",
              border: "1px dashed #06b6d4",
              borderRadius: 12,
              padding: 24,
              fontSize: 24,
              textAlign: "center",
              opacity: 0.85,
            }}
          >
            🚧 <strong>Coming Soon</strong> 🚧 <br/> 
            Expected Delivery date: May/June 2026 <br/><br/>  
             This module will let you build subscription flows, manage renewals,
            upgrades, churn-winbacks and more — all tied into your CRM and
            billing.
          </div>

      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#ffffff",
    padding: "28px 22px",
    display: "flex",
    justifyContent: "center",
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  inner: {
    width: "100%",
    maxWidth: 1320,
  },
  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#7c3aed", // u16 purple
    borderRadius: 12,
    padding: "14px 18px",
    marginBottom: 24,
  },
  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  bannerIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 12,
    background: "rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bannerTitle: {
    margin: 0,
    fontSize: 48,
    fontWeight: 600,
  },
  bannerDesc: {
    margin: 0,
    fontSize: 18,
    opacity: 0.9,
  },
  backBtn: {
    background: "#0c121a",
    color: "#ffffff",
    border: "2px solid rgba(255,255,255,0.25)",
    borderRadius: 8,
    padding: "8px 16px",
    fontWeight: 600,
    cursor: "pointer",
  },
  contentBox: {
    background: "#020617",
    borderRadius: 12,
    border: "1px solid #312e81",
    padding: 18,
    maxWidth: 900,
  },
};
