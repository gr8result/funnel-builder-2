import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import EstimateBuilderWorkbook from "../../../components/estimate-builder/EstimateBuilderWorkbook";

export default function EstimateBuilderPage() {
  const router = useRouter();
  const previewMode = router.query.mode === "preview";

  return (
    <>
      <Head><title>{previewMode ? "Estimate Builder Preview" : "Estimate Builder"}</title></Head>
      <main style={styles.page}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>Projects Hub</div>
            <h1 style={styles.title}>{previewMode ? "Estimate Builder Preview" : "Estimate Builder"}</h1>
            <p style={styles.subtitle}>
              {previewMode
                ? "Blank locked preview. Editing, copying, saving, and exports are disabled."
                : "Data Input Sheet, Quotation, and Summary."}
            </p>
          </div>
          <Link href="/modules/construction">
            <button style={styles.backButton}>Back to Projects Hub</button>
          </Link>
        </header>

        <EstimateBuilderWorkbook previewMode={previewMode} />
      </main>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    color: "#0f172a",
    padding: 18,
  },
  header: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "16px 18px",
    marginBottom: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  eyebrow: {
    color: "#0f766e",
    fontSize: 16,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  title: {
    margin: "2px 0",
    fontSize: 48,
    lineHeight: 1.1,
    fontWeight: 600,
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    fontSize: 16,
    maxWidth: 600,
  },
  backButton: {
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    borderRadius: 8,
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
