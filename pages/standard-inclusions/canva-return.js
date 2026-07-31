import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabase-client";

export default function CanvaReturnPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Validating Canva return...");
  const [error, setError] = useState("");
  const [designId, setDesignId] = useState("");

  const correlationJwt = useMemo(() => String(router.query?.correlation_jwt || ""), [router.query]);

  useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;
    async function validateReturn() {
      try {
        if (!correlationJwt) throw new Error("Missing Canva return-navigation JWT.");
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token || "";
        if (!token) throw new Error("Sign in again before completing Canva return.");
        const saved = JSON.parse(window.localStorage.getItem("gr8-standard-inclusions-canva-return") || "{}");
        const workspaceId = saved.workspaceId || "";
        if (!workspaceId) throw new Error("Missing workspace context for Canva return.");
        const response = await fetch("/api/standard-inclusions/canva/return", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "x-workspace-id": workspaceId,
          },
          body: JSON.stringify({ workspace_id: workspaceId, correlationJwt }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not validate Canva return.");
        if (cancelled) return;
        const returnedDesignId = payload.correlation?.design_id || payload.design?.design?.id || payload.design?.id || "";
        setDesignId(returnedDesignId);
        setStatus("Returned from Canva. Design information refreshed.");
        window.localStorage.setItem("gr8-standard-inclusions-canva-return-result", JSON.stringify({
          ok: true,
          designId: returnedDesignId,
          at: new Date().toISOString(),
        }));
      } catch (nextError) {
        if (cancelled) return;
        setError(nextError?.message || "Canva return validation failed.");
        setStatus("Canva return failed.");
      }
    }
    validateReturn();
    return () => { cancelled = true; };
  }, [router.isReady, correlationJwt]);

  return (
    <main style={styles.shell}>
      <section style={styles.panel}>
        <h1 style={styles.title}>Canva Standard Inclusions</h1>
        <p style={error ? styles.error : styles.status}>{error || status}</p>
        {designId ? <p style={styles.meta}>Design ID: {designId}</p> : null}
        <p style={styles.meta}>Return to Gr8 Result and use Export latest PDF to save the finished document.</p>
        <button type="button" style={styles.button} onClick={() => router.push("/modules/estimate-builder")}>Back to Gr8 Result</button>
      </section>
    </main>
  );
}

const styles = {
  shell: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", color: "#0f172a", padding: 24 },
  panel: { width: "min(560px, 100%)", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: 24, display: "grid", gap: 12 },
  title: { margin: 0, fontSize: 28, fontWeight: 900 },
  status: { margin: 0, color: "#166534", fontWeight: 800 },
  error: { margin: 0, color: "#b91c1c", fontWeight: 800 },
  meta: { margin: 0, color: "#475569", fontWeight: 700 },
  button: { justifySelf: "start", border: "1px solid #0f766e", background: "#0f766e", color: "#ffffff", borderRadius: 8, padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
};
