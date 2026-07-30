import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";

const MESSAGE = "Inclusions & Selections is being rebuilt using a new room-based workflow.";

export default function RetiredSelectionsBookPage() {
  const router = useRouter();
  const newModuleHref = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(router.query || {}).forEach(([key, value]) => {
      const firstValue = Array.isArray(value) ? value[0] : value;
      if (firstValue) params.set(key, firstValue);
    });
    const queryString = params.toString();
    return `/inclusions-selections/areas${queryString ? `?${queryString}` : ""}`;
  }, [router.query]);

  return (
    <>
      <Head>
        <title>Inclusions & Selections - Retired</title>
      </Head>
      <main style={styles.page}>
        <section style={styles.panel}>
          <p style={styles.eyebrow}>Inclusions & Selections - Retired</p>
          <h1 style={styles.title}>{MESSAGE}</h1>
          <p style={styles.copy}>
            Historical records are preserved. The retired selections book is no longer available.
          </p>
          <Link href={newModuleHref} style={styles.button}>
            Open New Inclusions & Selections
          </Link>
        </section>
      </main>
    </>
  );
}

RetiredSelectionsBookPage.disableLayout = true;

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
  button: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    minHeight: 40,
    borderRadius: 8,
    border: "1px solid #67e8f9",
    background: "#155e75",
    color: "#ffffff",
    padding: "9px 14px",
    fontWeight: 800,
    textDecoration: "none",
  },
};
