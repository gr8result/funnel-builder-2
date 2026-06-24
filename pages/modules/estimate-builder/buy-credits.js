import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

const PACKAGES = [
  { id: "single", credits: 1, discount: 0 },
  { id: "five", credits: 5, discount: 0.1 },
  { id: "ten", credits: 10, discount: 0.15 },
];

const BASE_PRICE = 59;

export default function BuyEstimateCreditsPage() {
  const [selected, setSelected] = useState("five");
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCredits(Number(window.localStorage.getItem("estimate-builder-credits") || 0));
  }, []);

  const pack = PACKAGES.find((item) => item.id === selected) || PACKAGES[0];
  const pricePerJob = BASE_PRICE * (1 - pack.discount);
  const total = pricePerJob * pack.credits;

  function confirmPurchase() {
    if (typeof window === "undefined") return;
    const nextCredits = credits + pack.credits;
    window.localStorage.setItem("estimate-builder-credits", String(nextCredits));
    setCredits(nextCredits);
  }

  return (
    <>
      <Head><title>Buy Estimate Credits</title></Head>
      <main style={styles.page}>
        <header style={styles.header}>
          <div style={styles.bannerLeft}>
            <span style={styles.bannerIcon}>$</span>
            <div>
              <h1 style={styles.title}>Buy Estimate Credits</h1>
              <p style={styles.subtitle}>Purchase job credits to use when registering Estimate Builder jobs.</p>
            </div>
          </div>
          <Link href="/modules/construction">
            <button style={styles.backButton}>Back to Projects Hub</button>
          </Link>
        </header>

        <section style={styles.shell}>
          <div style={styles.creditBalance}>
            <span>Current balance</span>
            <strong>{credits} {credits === 1 ? "job" : "jobs"} remaining</strong>
          </div>

          <div style={styles.packageGrid}>
            {PACKAGES.map((item) => {
              const active = selected === item.id;
              const itemPrice = BASE_PRICE * (1 - item.discount);
              return (
                <button key={item.id} type="button" style={active ? styles.packageActive : styles.package} onClick={() => setSelected(item.id)}>
                  <span style={styles.packageCount}>{item.credits}</span>
                  <span style={styles.packageTitle}>{item.credits === 1 ? "Single job credit" : `${item.credits} job credits`}</span>
                  <span style={styles.packagePrice}>${itemPrice.toFixed(2)} per job</span>
                  <span style={styles.packageDiscount}>{item.discount ? `${Math.round(item.discount * 100)}% discount` : "Standard rate"}</span>
                </button>
              );
            })}
          </div>

          <div style={styles.summaryBox}>
            <div style={styles.summaryLine}><span>Selected package</span><strong>{pack.credits} credits</strong></div>
            <div style={styles.summaryLine}><span>Price per job</span><strong>${pricePerJob.toFixed(2)}</strong></div>
            <div style={styles.totalLine}><span>Total</span><strong>${total.toFixed(2)}</strong></div>
            <button type="button" style={styles.primaryButton} onClick={confirmPurchase}>
              Confirm Credit Purchase
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
  shell: { maxWidth: 1080, margin: "0 auto", display: "grid", gap: 16 },
  creditBalance: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    color: "#334155",
  },
  packageGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 },
  package: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: 18,
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: 8,
  },
  packageActive: {
    background: "#fffbeb",
    border: "2px solid #f59e0b",
    borderRadius: 12,
    padding: 17,
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: 8,
  },
  packageCount: { color: "#92400e", fontSize: 42, lineHeight: 1, fontWeight: 950 },
  packageTitle: { color: "#0f172a", fontSize: 18, fontWeight: 900 },
  packagePrice: { color: "#334155", fontSize: 15 },
  packageDiscount: { color: "#0f766e", fontSize: 13, fontWeight: 900 },
  summaryBox: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, padding: 18, display: "grid", gap: 12 },
  summaryLine: { display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: 10 },
  totalLine: { display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 950 },
  primaryButton: { background: "#0f766e", color: "#ffffff", border: "1px solid #0f766e", borderRadius: 8, padding: "12px 16px", fontWeight: 900, cursor: "pointer" },
};
