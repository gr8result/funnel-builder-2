import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ClientPortalRouteBridge() {
  const router = useRouter();
  const projectId = typeof router.query.projectId === "string" ? router.query.projectId : "";
  const workspaceId = typeof router.query.workspace_id === "string"
    ? router.query.workspace_id
    : typeof router.query.organisationId === "string"
      ? router.query.organisationId
      : "";

  useEffect(() => {
    if (!router.isReady || !projectId) return;
    const query = new URLSearchParams({ mode: "preview" });
    if (workspaceId) query.set("workspace_id", workspaceId);
    router.replace(`/client-portal/${encodeURIComponent(projectId)}?${query.toString()}`);
  }, [projectId, router, workspaceId]);

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <p style={styles.kicker}>Client Portal</p>
        <h1 style={styles.title}>Open a synced project to preview the client portal.</h1>
        <p style={styles.copy}>
          The old Estimate Builder portal route has been retired so clients never see the internal estimate editor.
          Open the Client Portal card from a Project Workspace job that has been synced to the platform.
        </p>
        <button type="button" style={styles.button} onClick={() => router.replace("/modules/estimate-builder?page=projectDashboard")}>
          Back to Project Workspace
        </button>
      </section>
    </main>
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
    width: "min(720px, 100%)",
    border: "1px solid #dbe3ef",
    borderRadius: 8,
    background: "#ffffff",
    padding: 28,
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.10)",
  },
  kicker: { margin: "0 0 8px", color: "#0369a1", fontSize: 13, fontWeight: 800, textTransform: "uppercase" },
  title: { margin: 0, fontSize: 28, lineHeight: 1.15 },
  copy: { margin: "12px 0 22px", color: "#475569", fontSize: 16, lineHeight: 1.6 },
  button: {
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

