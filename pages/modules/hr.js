// /pages/modules/hr.js
import Link from "next/link";
import ICONS from "../../components/iconMap";

export default function HumanResources() {
  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>

        {/* Banner */}
        <div style={styles.banner}>
          <div style={styles.bannerLeft}>
            <div style={styles.bannerIconWrap}>
              <span style={{ fontSize: 38, lineHeight: 1 }}>👨‍💼</span>
            </div>
            <div>
              <h1 style={styles.bannerTitle}>Human Resources</h1>
              <p style={styles.bannerDesc}>
                Employee management, onboarding, and HR workflows.
              </p>
            </div>
          </div>
          <Link href="/dashboard">
            <button style={styles.backBtn}>← Back</button>
          </Link>
        </div>

        {/* Coming Soon */}
        <div style={styles.comingSoonBox}>
          <div style={styles.comingSoonEmoji}>👨‍💼</div>
          <h2 style={styles.comingSoonTitle}>Coming Soon</h2>
          <p style={styles.comingSoonDate}>Expected Delivery: Q3 2026</p>
          <p style={styles.comingSoonDesc}>
            The HR module will let you manage employees, track leave, run onboarding workflows,
            store documents, and integrate payroll — all within your existing workspace.
          </p>
          <div style={styles.featureGrid}>
            {[
              { icon: "👤", label: "Employee Profiles" },
              { icon: "📋", label: "Onboarding Workflows" },
              { icon: "🗓️", label: "Leave Management" },
              { icon: "📄", label: "Document Storage" },
              { icon: "💰", label: "Payroll Integration" },
              { icon: "📊", label: "Performance Tracking" },
            ].map((f) => (
              <div key={f.label} style={styles.featureCard}>
                <span style={styles.featureIcon}>{f.icon}</span>
                <span style={styles.featureLabel}>{f.label}</span>
              </div>
            ))}
          </div>
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
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  inner: { width: "100%", maxWidth: 1320 },
  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#1d4ed8",
    borderRadius: 12,
    padding: "14px 18px",
    marginBottom: 28,
  },
  bannerLeft: { display: "flex", alignItems: "center", gap: 14 },
  bannerIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 12,
    background: "rgba(0,0,0,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bannerTitle: { margin: 0, fontSize: 40, fontWeight: 600, lineHeight: 1.1 },
  bannerDesc: { margin: "4px 0 0", fontSize: 18, opacity: 0.9 },
  backBtn: {
    background: "#0c121a",
    color: "#ffffff",
    border: "2px solid rgba(255,255,255,0.25)",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  comingSoonBox: {
    background: "#111827",
    border: "1px dashed #3b82f6",
    borderRadius: 16,
    padding: "48px 32px",
    textAlign: "center",
  },
  comingSoonEmoji: { fontSize: 64, lineHeight: 1, marginBottom: 16 },
  comingSoonTitle: { margin: "0 0 8px", fontSize: 36, fontWeight: 600 },
  comingSoonDate: { margin: "0 0 20px", fontSize: 18, color: "#3b82f6", fontWeight: 600 },
  comingSoonDesc: {
    margin: "0 auto 36px",
    fontSize: 18,
    opacity: 0.75,
    maxWidth: 680,
    lineHeight: 1.6,
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
    maxWidth: 800,
    margin: "0 auto",
  },
  featureCard: {
    background: "rgba(59,130,246,0.08)",
    border: "1px solid rgba(59,130,246,0.25)",
    borderRadius: 10,
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  featureIcon: { fontSize: 28 },
  featureLabel: { fontSize: 16, fontWeight: 600, opacity: 0.9 },
};
