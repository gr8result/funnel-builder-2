import Head from "next/head";

const MESSAGE = "Inclusions & Selections is being rebuilt using a new room-based workflow.";

export default function RetiredInclusionsSchedulePage() {
  return (
    <>
      <Head>
        <title>Inclusions & Selections — Rebuilding</title>
      </Head>
      <main style={styles.page}>
        <section style={styles.panel}>
          <p style={styles.eyebrow}>Inclusions & Selections — Rebuilding</p>
          <h1 style={styles.title}>{MESSAGE}</h1>
          <p style={styles.copy}>
            Historical records are preserved. The retired inclusions schedule generator is no longer available.
          </p>
        </section>
      </main>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "#0f172a",
    color: "#e2e8f0",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  panel: {
    width: "min(720px, 100%)",
    border: "1px solid rgba(148, 163, 184, 0.28)",
    borderRadius: 8,
    background: "rgba(15, 23, 42, 0.92)",
    padding: 28,
  },
  eyebrow: {
    margin: "0 0 10px",
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.2,
    color: "#f8fafc",
  },
  copy: {
    margin: "14px 0 0",
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 1.6,
  },
};
