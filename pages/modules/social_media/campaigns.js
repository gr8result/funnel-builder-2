// File Path: pages/modules/social_media/campaigns.js
import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

export default function SocialCampaigns() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [expandedId, setExpandedId] = useState("");

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    setLoading(true);
    setNotice("");
    try {
      const token = await getToken();
      if (!token) { setNotice("Sign in to view campaigns."); setLoading(false); return; }
      const res = await fetch("/api/social/get-campaigns", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({ ok: false, success: false, error: "Server error — please try again." }));
      if (!json.ok) throw new Error(json.error || "Failed to load campaigns");
      setCampaigns(json.campaigns || []);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createCampaign(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setNotice("");
    try {
      const token = await getToken();
      const res = await fetch("/api/social/create-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      const json = await res.json().catch(() => ({ ok: false, success: false, error: "Server error — please try again." }));
      if (!json.ok) throw new Error(json.error || "Failed to create campaign");
      setNewName("");
      setNewDesc("");
      setNotice(`Campaign "${json.campaign.name}" created.`);
      await loadCampaigns();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function deleteCampaign(id, name) {
    if (!confirm(`Delete campaign "${name}"? This does not delete the posts.`)) return;
    setDeletingId(id);
    setNotice("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/social/delete-campaign?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({ ok: false, success: false, error: "Server error — please try again." }));
      if (!json.ok) throw new Error(json.error || "Failed to delete");
      setNotice(`Campaign "${name}" deleted.`);
      await loadCampaigns();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setDeletingId("");
    }
  }

  const totalPosts = campaigns.reduce((sum, c) => sum + (c.social_campaign_posts?.length || 0), 0);

  return (
    <>
      <Head><title>Social Campaigns | GR8 RESULT</title></Head>
      <div style={{ minHeight: "100vh", background: "#0c121a", color: "#fff", padding: "28px 22px" }}>
        <div style={{ width: "100%", maxWidth: 1320, margin: "0 auto" }}>

          {/* Banner */}
          <div style={styles.banner}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={styles.bannerIcon}>{ICONS.social({ size: 42 })}</div>
              <div>
                <h1 style={{ fontSize: 32, margin: 0, fontWeight: 600 }}>Social Campaigns</h1>
                <p style={{ margin: 0, opacity: 0.8 }}>Group posts into named campaigns for tracking and batch scheduling.</p>
              </div>
            </div>
            <button onClick={() => router.push("/modules/social_media/dashboard")} style={styles.backBtn}>← Back</button>
          </div>

          {notice && (
            <div style={{ background: notice.startsWith("❌") || notice.toLowerCase().includes("fail") || notice.toLowerCase().includes("error") ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)", border: `1px solid ${notice.startsWith("❌") || notice.toLowerCase().includes("fail") ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)"}`, color: "#fff", padding: "10px 16px", borderRadius: 10, marginBottom: 20, fontSize: 16 }}>
              {notice}
            </div>
          )}

          <div style={styles.mainGrid}>
            {/* Left: Create + Stats */}
            <div style={styles.sideColumn}>
              <div style={styles.glassCard}>
                <h3 style={styles.colLabel}>Create Campaign</h3>
                <form onSubmit={createCampaign}>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Campaign name *"
                    style={styles.input}
                    maxLength={80}
                  />
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Description (optional)"
                    style={{ ...styles.input, height: 70, resize: "vertical", marginTop: 10 }}
                    maxLength={300}
                  />
                  <button type="submit" disabled={creating || !newName.trim()} style={{ ...styles.primaryBtn, marginTop: 12, opacity: creating || !newName.trim() ? 0.5 : 1 }}>
                    {creating ? "Creating..." : "+ Create Campaign"}
                  </button>
                </form>
              </div>

              <div style={styles.glassCard}>
                <h3 style={styles.colLabel}>Stats</h3>
                <div style={styles.statRow}><span>Total Campaigns</span><strong>{campaigns.length}</strong></div>
                <div style={styles.statRow}><span>Total Posts Grouped</span><strong>{totalPosts}</strong></div>
              </div>
            </div>

            {/* Center: Campaign list */}
            <div style={{ ...styles.sideColumn, flex: 2 }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: 60, opacity: 0.4 }}>Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div style={styles.emptyBox}>
                  <h3>No Campaigns Yet</h3>
                  <p>Create a campaign to group posts for tracking and batch scheduling.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {campaigns.map((c) => {
                    const postCount = c.social_campaign_posts?.length || 0;
                    const isExpanded = expandedId === c.id;
                    return (
                      <div key={c.id} style={styles.glassCard}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 17 }}>{c.name}</div>
                            {c.description && <div style={{ fontSize: 16, opacity: 0.6, marginTop: 3 }}>{c.description}</div>}
                            <div style={{ fontSize: 16, opacity: 0.4, marginTop: 6 }}>
                              {postCount} post{postCount !== 1 ? "s" : ""} &nbsp;·&nbsp; Created {new Date(c.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                            {postCount > 0 && (
                              <button
                                style={styles.slimBtn}
                                onClick={() => setExpandedId(isExpanded ? "" : c.id)}
                              >
                                {isExpanded ? "Hide Posts" : "View Posts"}
                              </button>
                            )}
                            <button
                              style={{ ...styles.slimBtn, borderColor: "rgba(239,68,68,0.4)", color: "#f87171" }}
                              disabled={deletingId === c.id}
                              onClick={() => deleteCampaign(c.id, c.name)}
                            >
                              {deletingId === c.id ? "..." : "Delete"}
                            </button>
                          </div>
                        </div>

                        {isExpanded && postCount > 0 && (
                          <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                            {c.social_campaign_posts.map((cp) => {
                              const post = cp.social_posts;
                              if (!post) return null;
                              return (
                                <div key={cp.post_id} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 10 }}>
                                  <div style={{ fontSize: 16, opacity: 0.5 }}>{post.platform} · {post.status}</div>
                                  <div style={{ fontSize: 16, marginTop: 4, opacity: 0.85, whiteSpace: "pre-wrap" }}>{post.content?.slice(0, 200)}{post.content?.length > 200 ? "…" : ""}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  banner: { background: "#8126e9", padding: "24px 30px", borderRadius: 16, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 },
  bannerIcon: { width: 62, height: 62, background: "rgba(0,0,0,0.2)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" },
  backBtn: { background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "10px 22px", borderRadius: 12, cursor: "pointer", fontWeight: 600 },
  mainGrid: { display: "flex", gap: 24 },
  sideColumn: { flex: 1, display: "flex", flexDirection: "column", gap: 20 },
  glassCard: { background: "#111827", padding: 22, borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)" },
  colLabel: { fontSize: 16, textTransform: "uppercase", opacity: 0.4, marginBottom: 18, margin: "0 0 14px" },
  input: { width: "100%", background: "#0c121a", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", padding: "10px 12px", borderRadius: 8, fontSize: 16, boxSizing: "border-box" },
  primaryBtn: { width: "100%", background: "rgba(129,38,233,0.2)", border: "1px solid rgba(129,38,233,0.4)", color: "#a78bfa", padding: "12px", borderRadius: 10, cursor: "pointer", fontWeight: 600 },
  slimBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 16 },
  emptyBox: { textAlign: "center", padding: 80, background: "#111827", borderRadius: 20, border: "2px dashed rgba(255,255,255,0.1)" },
  statRow: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" },
};