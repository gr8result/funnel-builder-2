import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function EstimateJobPaymentPage() {
  const [job, setJob] = useState(null);
  const [method, setMethod] = useState("stripe");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("estimate-builder-pending-job");
      if (raw) setJob(JSON.parse(raw));
    } catch {}
  }, []);

  return (
    <>
      <Head><title>Estimate Job Payment</title></Head>
      <main style={styles.page}>
        <header style={styles.header}>
          <div style={styles.bannerLeft}>
            <span style={styles.bannerIcon}>$</span>
            <div>
              <h1 style={styles.title}>Payment Access</h1>
              <p style={styles.subtitle}>Confirm payment method before opening the estimate workbook.</p>
            </div>
          </div>
          <Link href="/modules/estimate-builder/register-job">
            <button style={styles.backButton}>Back to Job Registration</button>
          </Link>
        </header>

        <section style={styles.panel}>
          <div style={styles.jobStrip}>
            <div style={styles.jobDetails}>
              <div style={styles.label}>Registered job</div>
              <div style={styles.detailLine}><span>Client name:</span><strong>{job?.clientName || "Client pending"}</strong></div>
              <div style={styles.detailLine}><span>Job #:</span><strong>{job?.jobNumber || job?.jobId || "Job # pending"}</strong></div>
              <div style={styles.detailLine}><span>Job Name:</span><strong>{job?.jobName || "Estimate job"}</strong></div>
            </div>
          </div>

          <div style={styles.confirmBox}>
            <p style={styles.confirmText}>You hereby confirm you are about to pay the amount of</p>
            <div style={styles.amount}>$59.00</div>
            <p style={styles.confirmText}>for the above job.</p>
          </div>

          <div style={styles.paymentBox}>
            <h3 style={styles.sectionTitle}>Payment method</h3>
            <label style={method === "stripe" ? styles.methodActive : styles.method}>
              <input type="radio" name="paymentMethod" value="stripe" checked={method === "stripe"} onChange={() => setMethod("stripe")} />
              <span>
                <strong>Stripe</strong>
                <small>Card payment through Stripe checkout.</small>
              </span>
            </label>
            <label style={method === "paypal" ? styles.methodActive : styles.method}>
              <input type="radio" name="paymentMethod" value="paypal" checked={method === "paypal"} onChange={() => setMethod("paypal")} />
              <span>
                <strong>PayPal</strong>
                <small>Pay using PayPal when this gateway is connected.</small>
              </span>
            </label>

            <button style={styles.primaryButton} onClick={() => {}}>
              Confirm {method === "stripe" ? "Stripe" : "PayPal"} Payment
            </button>
          </div>
        </section>
      </main>
    </>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f1f5f9", color: "#0f172a", padding: 18 },
  header: {
    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 16,
    padding: "24px 28px",
    margin: "0 auto 16px",
    width: "100%",
    maxWidth: 1320,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  bannerLeft: { display: "flex", alignItems: "center", gap: 18 },
  bannerIcon: {
    width: 72,
    height: 72,
    borderRadius: 999,
    background: "rgba(255,255,255,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 1,
    flexShrink: 0,
  },
  title: { margin: 0, fontSize: 48, lineHeight: 1.1, fontWeight: 600, color: "#ffffff" },
  subtitle: { margin: "4px 0 0", color: "#ffffff", opacity: 0.92, fontSize: 18, maxWidth: 780, fontWeight: 500 },
  backButton: {
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 10,
    padding: "9px 18px",
    fontSize: 18,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  panel: {
    maxWidth: 860,
    margin: "0 auto",
    display: "grid",
    gap: 16,
  },
  jobStrip: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: 18,
  },
  label: { color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" },
  jobDetails: { display: "grid", gap: 10 },
  detailLine: { display: "flex", justifyContent: "space-between", gap: 16, color: "#334155", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 },
  confirmBox: { background: "#ffffff", border: "1px solid #fcd34d", borderRadius: 12, padding: 22, textAlign: "center" },
  confirmText: { margin: 0, color: "#475569", fontSize: 16, lineHeight: 1.5 },
  amount: { margin: "8px 0", color: "#92400e", fontSize: 52, fontWeight: 950, lineHeight: 1 },
  paymentBox: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, padding: 18, display: "grid", gap: 12 },
  sectionTitle: { margin: "0 0 4px", fontSize: 20 },
  method: { border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "flex", gap: 12, alignItems: "center", cursor: "pointer" },
  methodActive: { border: "2px solid #f59e0b", borderRadius: 10, padding: 13, display: "flex", gap: 12, alignItems: "center", cursor: "pointer", background: "#fffbeb" },
  primaryButton: { marginTop: 4, background: "#0f766e", color: "#ffffff", border: "1px solid #0f766e", borderRadius: 8, padding: "12px 16px", fontWeight: 900, cursor: "pointer" },
};
