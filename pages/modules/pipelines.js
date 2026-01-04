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
              {ICONS.subscription({ size: 26 })}
            </div>
            <div>
              <h1 style={styles.bannerTitle}>Subscription pipeline</h1>
              <p style={styles.bannerDesc}>
                Track recurring offers, upgrade paths and customer journeys.
              </p>
            </div>
          </div>

          <Link href="/dashboard">
            <button style={styles.backBtn}>← Back</button>
          </Link>
        </div>

        {/* Coming soon content */}
        <div style={styles.contentBox}>
          <p style={{ marginBottom: 8 }}>
            <strong>Coming soon</strong>
          </p>
          <p style={{ marginBottom: 6 }}>
            This module will let you build subscription flows, manage renewals,
            upgrades, churn-winbacks and more — all tied into your CRM and
            billing.
          </p>
          <p style={{ opacity: 0.8 }}>
            For now this is just a placeholder so you don’t see a 404 while the
            builder and reports are being wired up.
          </p>
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
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bannerTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
  },
  bannerDesc: {
    margin: 0,
    fontSize: 14,
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
