import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import supabase from "../../../lib/supabaseClient";

export default function WebsiteBuilderBackupsPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [projectId, setProjectId] = useState("");
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [restoringId, setRestoringId] = useState("");

  useEffect(() => {
    let subscription;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
      ({
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession || null)));
    })();

    return () => subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    const routeProjectId = String(router.query?.projectId || "").trim();
    if (routeProjectId) setProjectId(routeProjectId);
  }, [router.query?.projectId]);

  async function loadBackups(nextProjectId = projectId) {
    const id = String(nextProjectId || "").trim();
    if (!id) {
      setMessage("Enter a website project id first.");
      return;
    }
    if (!session?.access_token) {
      setMessage("Log in before loading backups.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/website-builder/backups?projectId=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not load backups");
      setBackups(Array.isArray(payload.backups) ? payload.backups : []);
      setMessage(payload.backups?.length ? "" : "No backups found for this project yet.");
    } catch (error) {
      setBackups([]);
      setMessage(error?.message || "Could not load backups.");
    } finally {
      setLoading(false);
    }
  }

  async function restoreBackup(backupId) {
    const id = String(projectId || "").trim();
    if (!id || !backupId || !session?.access_token) return;
    const confirmed = window.confirm(`Restore backup ${backupId}? A pre-restore backup will be created first.`);
    if (!confirmed) return;

    setRestoringId(backupId);
    setMessage("");
    try {
      const response = await fetch("/api/website-builder/backups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ projectId: id, backupId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not restore backup");
      setMessage("Backup restored. Reopen the visual builder to load the restored files.");
      await loadBackups(id);
    } catch (error) {
      setMessage(error?.message || "Could not restore backup.");
    } finally {
      setRestoringId("");
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Website Builder Backups</h1>
            <p style={styles.copy}>List and restore file snapshots for a website project.</p>
          </div>
          <button type="button" onClick={() => router.push("/modules/website-builder")} style={styles.secondaryBtn}>
            Back
          </button>
        </div>

        <div style={styles.controls}>
          <input
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            placeholder="Project id"
            style={styles.input}
          />
          <button type="button" onClick={() => loadBackups()} disabled={loading} style={styles.primaryBtn}>
            {loading ? "Loading..." : "Load Backups"}
          </button>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        <div style={styles.list}>
          {backups.map((backup) => (
            <article key={backup.id} style={styles.card}>
              <div>
                <strong style={styles.cardTitle}>{backup.id}</strong>
                <div style={styles.meta}>Source: {backup.source || backup.metadata?.source || "unknown"}</div>
                <div style={styles.meta}>Time: {backup.metadata?.timestamp || backup.timestamp || "unknown"}</div>
                {backup.metadata?.pageName ? <div style={styles.meta}>Page: {backup.metadata.pageName}</div> : null}
              </div>
              <button
                type="button"
                onClick={() => restoreBackup(backup.id)}
                disabled={!!restoringId}
                style={styles.restoreBtn}
              >
                {restoringId === backup.id ? "Restoring..." : "Restore"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#07111f",
    color: "#f8fafc",
    padding: 28,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  panel: {
    maxWidth: 980,
    margin: "0 auto",
    border: "1px solid rgba(148,163,184,0.28)",
    borderRadius: 10,
    background: "#0b1626",
    padding: 22,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  title: { margin: 0, fontSize: 28 },
  copy: { margin: "8px 0 0", color: "#cbd5e1", fontSize: 15 },
  controls: { display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" },
  input: {
    flex: "1 1 420px",
    minHeight: 42,
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "#081120",
    color: "#f8fafc",
    padding: "0 12px",
    fontSize: 15,
  },
  primaryBtn: {
    minHeight: 42,
    border: 0,
    borderRadius: 8,
    background: "#22c55e",
    color: "#052e16",
    fontWeight: 700,
    padding: "0 16px",
    cursor: "pointer",
  },
  secondaryBtn: {
    minHeight: 38,
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "transparent",
    color: "#e2e8f0",
    fontWeight: 700,
    padding: "0 14px",
    cursor: "pointer",
  },
  message: {
    marginTop: 18,
    border: "1px solid rgba(250,204,21,0.38)",
    background: "rgba(250,204,21,0.10)",
    color: "#fde68a",
    borderRadius: 8,
    padding: 12,
  },
  list: { display: "grid", gap: 12, marginTop: 20 },
  card: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    border: "1px solid rgba(148,163,184,0.22)",
    borderRadius: 8,
    background: "#081120",
    padding: 14,
  },
  cardTitle: { display: "block", fontSize: 15, marginBottom: 6 },
  meta: { color: "#94a3b8", fontSize: 13, lineHeight: 1.5 },
  restoreBtn: {
    minHeight: 38,
    border: 0,
    borderRadius: 8,
    background: "#38bdf8",
    color: "#082f49",
    fontWeight: 700,
    padding: "0 14px",
    cursor: "pointer",
  },
};
