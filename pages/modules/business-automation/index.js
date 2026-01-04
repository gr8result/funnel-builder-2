// /pages/modules/business-automation/index.js
// BUSINESS AUTOMATION — Coming Soon placeholder with full banner + Back button

import Link from "next/link";
import ICONS from "../../../components/iconMap"; // only ../.. to go up 3 levels

export default function BusinessAutomation() {
  return (
    <div style={styles.wrap}>
      {/* Banner */}
      <div style={styles.banner}>
        <div style={styles.bannerLeft}>
          <div style={styles.iconBox}>
            {ICONS.automation({ size: 48 })}
          </div>
          <div>
            <h1 style={styles.title}>Business Automation</h1>
            <p style={styles.desc}>
              Workflows, triggers & automated actions to streamline everything.
            </p>
          </div>
        </div>

        <Link href="/dashboard">
          <button style={styles.backBtn}>← Back</button>
        </Link>
      </div>

      {/* Coming Soon Content */}
      <div style={styles.contentBox}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>
          🚀 Coming Soon
        </h2>
        <p style={{ fontSize: 18, opacity: 0.85, marginTop: 12 }}>
          Visual workflow automation, triggers, AI actions, delays, webhooks and more.
        </p>
        <p style={{ fontSize: 16, opacity: 0.55 }}>
          This module is currently being built and will roll out prior to launch.
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },

  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#fb923c",
    padding: "18px 40px",
    borderRadius: 12,
    width: "100%",
    maxWidth: 1320,
    marginBottom: 35,
  },

  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    background: "rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  title: {
    fontSize: 48,
    fontWeight: 600,
    margin: 0,
  },

  desc: {
    fontSize: 20,
    opacity: 0.9,
    margin: 0,
    marginTop: 2,
  },

  backBtn: {
    background: "#0c121a",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: 8,
    padding: "8px 16px",
    fontWeight: 600,
    fontSize: 18,
    cursor: "pointer",
  },

  contentBox: {
    background: "#111827",
    borderRadius: 14,
    border: "1px solid #fb923c",
    padding: "40px 28px",
    maxWidth: 900,
    width: "100%",
    textAlign: "center",
  },
};
