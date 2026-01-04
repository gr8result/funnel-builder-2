// /pages/modules/email/broadcast/view.js
// FULL REPLACEMENT — same UI, but resend now includes Authorization Bearer token

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../../utils/supabase-client";
import styles from "../../../../styles/email-crm.module.css";

export default function ViewBroadcasts() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [listsById, setListsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const safeDate = (iso) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso || "";
    }
  };

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

  const recipientsLabel = (b) => {
    const type = String(b.audience_type || "");
    if (type === "list") {
      const id = b.list_id ? String(b.list_id) : "";
      return listsById[id] || "List";
    }

    const tf = String(b.to_field || "").trim();
    if (!tf) return "—";

    const emails = tf
      .split(/[,;\n]/)
      .map((x) => x.trim())
      .filter((x) => x && isEmail(x));

    if (!emails.length) return "—";
    return emails.length === 1 ? emails[0] : `${emails.length} emails`;
  };

  const loadEverything = async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();

      if (!u) {
        setUser(null);
        setBroadcasts([]);
        setListsById({});
        setLoading(false);
        return;
      }

      setUser(u);

      const { data: lists, error: listsErr } = await supabase
        .from("lead_lists")
        .select("id,name")
        .eq("user_id", u.id);

      if (listsErr) throw new Error("Failed to load lead lists: " + listsErr.message);

      const map = {};
      (lists || []).forEach((l) => (map[String(l.id)] = l.name || ""));
      setListsById(map);

      const { data: bcasts, error: bErr } = await supabase
        .from("email_broadcasts")
        .select(
          "id, created_at, title, subject, preheader, audience_type, list_id, to_field, ab_enabled, ab_subject_a, ab_subject_b, html_content"
        )
        .eq("user_id", u.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (bErr) throw new Error("Failed to load broadcasts: " + bErr.message);

      setBroadcasts(bcasts || []);
    } catch (e) {
      setError(e.message || "Failed to load broadcasts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEverything();
  }, []);

  const openToEdit = (id) => router.push(`/modules/email/broadcast?mode=edit&broadcastId=${id}`);

  const deleteBroadcast = async (id) => {
    if (!confirm("Delete this broadcast?")) return;

    try {
      setBusyId(id);

      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) throw new Error("Not logged in.");

      const { error: dErr } = await supabase
        .from("email_broadcasts")
        .delete()
        .eq("id", id)
        .eq("user_id", u.id);

      if (dErr) throw new Error(dErr.message || "Delete failed");

      await loadEverything();
    } catch (e) {
      alert("Delete error: " + (e.message || "Unknown error"));
    } finally {
      setBusyId(null);
    }
  };

  // ✅ RESEND (Bearer token REQUIRED by API)
  const resendBroadcast = async (id) => {
    try {
      setBusyId(id);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error("Not logged in.");

      const res = await fetch("/api/email/resend-broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ broadcastId: id }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error((json && (json.error || json.message)) || `HTTP ${res.status}`);
      }
      if (!json || !json.success) {
        throw new Error((json && json.error) || "Resend failed.");
      }

      const ab = !!json.ab_enabled;
      const split = json.split || {};
      const sent = json.results?.sent || {};
      const failed = json.results?.failed || {};

      alert(
        `Resent.\n` +
          (ab ? `A/B split: A=${split.A || 0}  B=${split.B || 0}\n` : "") +
          `Sent: A=${sent.A || 0}  B=${sent.B || 0}\n` +
          `Failed: A=${failed.A || 0}  B=${failed.B || 0}`
      );
    } catch (e) {
      alert("Error resending broadcast: " + (e.message || "Unknown error"));
    } finally {
      setBusyId(null);
    }
  };

  const rows = useMemo(() => broadcasts || [], [broadcasts]);

  return (
    <div style={{ background: "#0c121a", minHeight: "100vh", color: "#fff", fontSize: 16 }}>
      <div
        style={{
          width: "1320px",
          maxWidth: "100%",
          margin: "0 auto",
          background: "#f59e0b",
          color: "#111",
          padding: "18px 22px",
          borderRadius: "16px",
          marginTop: 24,
          marginBottom: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 48 }}>📨</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 48, fontWeight: 600, lineHeight: 1.05 }}>View broadcasts</span>
            <span style={{ fontSize: 18, fontWeight: 500, opacity: 0.9, marginTop: 2 }}>
              Preview, resend, edit or delete previous broadcasts.
            </span>
          </div>
        </div>

        <Link
          href="/modules/email/broadcast"
          style={{
            background: "#111",
            color: "#fff",
            fontSize: 18,
            fontWeight: 600,
            borderRadius: 8,
            padding: "6px 14px",
            textDecoration: "none",
            border: "1px solid #000",
          }}
        >
          ← Back to create
        </Link>
      </div>

      <div className={styles.main}>
        <section
          className={styles.panel}
          style={{
            width: "1320px",
            maxWidth: "100%",
            margin: "0 auto 40px",
            background: "#0b1220",
            color: "#fff",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 16, display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Broadcasts</div>
            <button
              onClick={loadEverything}
              style={{
                background: "#111827",
                color: "#fff",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "8px 14px",
                fontWeight: 800,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              Refresh
            </button>
          </div>

          {error && <div style={{ padding: "0 16px 12px", color: "#fca5a5", fontWeight: 800 }}>{error}</div>}

          {loading ? (
            <div style={{ padding: 16, opacity: 0.9 }}>Loading…</div>
          ) : !user ? (
            <div style={{ padding: 16, opacity: 0.9 }}>You’re not logged in.</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 16, opacity: 0.9 }}>No broadcasts found.</div>
          ) : (
            <div style={{ padding: 16, paddingTop: 0 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 1fr 240px 220px 360px",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontWeight: 900,
                  color: "#fff",
                  fontSize: 14,
                }}
              >
                <div>Preview</div>
                <div>Broadcast</div>
                <div>Recipients</div>
                <div>Date</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {rows.map((b) => {
                  const id = String(b.id);
                  const title = (b.title || "").trim() || (b.subject || "").trim() || "Broadcast";
                  const subject = (b.subject || "").trim();
                  const ab = !!b.ab_enabled;
                  const html = (b.html_content || "").trim();

                  return (
                    <div
                      key={id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "150px 1fr 240px 220px 360px",
                        gap: 12,
                        padding: "12px 12px",
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.25)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 140,
                          height: 80,
                          borderRadius: 10,
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "#fff",
                          position: "relative",
                        }}
                        title="Email preview"
                      >
                        {html ? (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: 700,
                              height: 400,
                              transform: "scale(0.2)",
                              transformOrigin: "top left",
                              overflow: "hidden",
                              background: "#fff",
                            }}
                            dangerouslySetInnerHTML={{ __html: html }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 900,
                              color: "#111",
                              fontSize: 12,
                            }}
                          >
                            No preview
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, fontSize: 16, color: "#fff" }}>{title}</div>
                        <div style={{ opacity: 0.85, fontSize: 13, marginTop: 2, color: "#e5e7eb" }}>
                          Subject: {subject || "—"}{" "}
                          {ab ? <span style={{ marginLeft: 8, color: "#fbbf24", fontWeight: 900 }}>A/B enabled</span> : null}
                        </div>
                      </div>

                      <div style={{ fontWeight: 800, color: "#fff" }}>{recipientsLabel(b)}</div>
                      <div style={{ color: "#e5e7eb", fontWeight: 700 }}>{safeDate(b.created_at)}</div>

                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button
                          onClick={() => openToEdit(id)}
                          disabled={busyId === id}
                          style={{
                            background: "#16a34a",
                            color: "#062",
                            border: "none",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontWeight: 900,
                            cursor: "pointer",
                            opacity: busyId === id ? 0.65 : 1,
                            fontSize: 14,
                          }}
                        >
                          Open to edit
                        </button>

                        <button
                          onClick={() => resendBroadcast(id)}
                          disabled={busyId === id}
                          style={{
                            background: "#1d4ed8",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontWeight: 900,
                            cursor: "pointer",
                            opacity: busyId === id ? 0.65 : 1,
                            fontSize: 14,
                          }}
                        >
                          {busyId === id ? "Working..." : "Send again as is"}
                        </button>

                        <button
                          onClick={() => deleteBroadcast(id)}
                          disabled={busyId === id}
                          style={{
                            background: "#dc2626",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontWeight: 900,
                            cursor: "pointer",
                            opacity: busyId === id ? 0.65 : 1,
                            fontSize: 14,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
