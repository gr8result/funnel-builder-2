import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { activatePortalInvitation } from "./apiClient";

export default function ClientPortalActivatePage() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const [status, setStatus] = useState("Activating your client portal...");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!router.isReady || !token) return;
    let cancelled = false;
    async function activate() {
      try {
        const result = await activatePortalInvitation(token);
        if (cancelled) return;
        setStatus("Client portal activated. Opening your project...");
        router.replace(`/client-portal/${encodeURIComponent(result.projectId)}`);
      } catch (activationError) {
        if (cancelled) return;
        if (activationError.status === 401) {
          router.replace(`/login?redirect=${encodeURIComponent(router.asPath)}`);
          return;
        }
        setError(activationError.message || "This invitation could not be activated.");
      }
    }
    activate();
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  return (
    <>
      <Head><title>Activate Client Portal</title></Head>
      <main style={styles.page}>
        <section style={styles.panel}>
          <p style={styles.kicker}>Client Portal</p>
          <h1 style={styles.title}>{error ? "Invitation unavailable" : "Activating access"}</h1>
          <p style={styles.copy}>{error || status}</p>
          {error ? (
            <button type="button" style={styles.button} onClick={() => router.push("/login")}>Sign in</button>
          ) : null}
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
    background: "#f7fafc",
    color: "#0f172a",
    padding: 24,
  },
  panel: {
    width: "min(620px, 100%)",
    border: "1px solid #dbe3ef",
    borderRadius: 8,
    background: "#ffffff",
    padding: 28,
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.10)",
  },
  kicker: { margin: "0 0 8px", color: "#0369a1", fontSize: 13, fontWeight: 800, textTransform: "uppercase" },
  title: { margin: 0, fontSize: 30, lineHeight: 1.15 },
  copy: { margin: "12px 0 0", color: "#475569", fontSize: 17, lineHeight: 1.6 },
  button: {
    marginTop: 18,
    border: 0,
    borderRadius: 8,
    background: "#0f172a",
    color: "#ffffff",
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
  },
};

