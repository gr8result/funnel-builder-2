// /pages/modules/funnels/index.js
// Funnels list with full GR8 banner + Coming Soon placeholder if needed

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ICONS from "../../../components/iconMap";
import AuthGate from "../../../components/AuthGate";
import { supabase } from "../../../lib/supabaseClient";

export default function FunnelsHome() {
  return (
    <AuthGate>
      <FunnelsInner />
    </AuthGate>
  );
}

function FunnelsInner() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [funnelUsage, setFunnelUsage] = useState(null);
  const [assetFiles, setAssetFiles] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [assetMsg, setAssetMsg] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState("icon");
  const [aiSize, setAiSize] = useState("1024x1024");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [latestAiUrl, setLatestAiUrl] = useState("");
  const logoInputRef = useRef(null);
  const imagesInputRef = useRef(null);

  useEffect(() => {
    let sub;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      ({ data: { subscription: sub } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null)));
    })();
    return () => sub?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    refresh();
    refreshAssets(session.user.id);
    fetchFunnelUsage(session.access_token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  function safeName(name = "") {
    return name.replace(/[^a-zA-Z0-9._-]/g, "-");
  }

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildStarterPageHtml(name = "") {
    const safeTitle = escapeHtml(name || "New Funnel");
    return `
      <section style="min-height:100vh;padding:80px 20px;background:linear-gradient(135deg,#0f172a 0%,#111827 100%);color:#ffffff;">
        <div style="max-width:960px;margin:0 auto;text-align:center;">
          <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(59,130,246,0.18);color:#93c5fd;font-weight:700;font-size:13px;margin-bottom:16px;">Draft page</div>
          <h1 style="font-size:48px;line-height:1.1;margin:0 0 14px;">${safeTitle}</h1>
          <p style="max-width:720px;margin:0 auto 22px;color:rgba(255,255,255,0.82);font-size:18px;line-height:1.6;">
            This starter page is ready to edit. Replace this copy, add sections, and publish when you are ready.
          </p>
          <a href="#" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:700;">Get Started</a>
        </div>
      </section>
    `.trim();
  }

  function assetPublicUrl(userId, name) {
    const { data } = supabase.storage.from("assets").getPublicUrl(`${userId}/${name}`);
    return data?.publicUrl || "";
  }

  async function refreshAssets(userId) {
    const { data, error } = await supabase.storage
      .from("assets")
      .list(`${userId}/`, { limit: 120, offset: 0, sortBy: { column: "name", order: "desc" } });
    if (error) return;
    setAssetFiles(data || []);
  }

  async function uploadFiles(files, tag) {
    if (!session?.user?.id) {
      setAssetMsg("Please log in first.");
      return;
    }
    if (!files?.length) return;

    try {
      setAssetMsg("Uploading...");
      for (const file of files) {
        const path = `${session.user.id}/${tag}-${Date.now()}-${safeName(file.name)}`;
        const { error } = await supabase.storage.from("assets").upload(path, file, {
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });
        if (error) throw error;
      }
      setAssetMsg(`Uploaded ${files.length} file${files.length > 1 ? "s" : ""}.`);
      await refreshAssets(session.user.id);
    } catch (err) {
      setAssetMsg(err?.message || "Upload failed");
    }
  }

  async function onUploadLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    await uploadFiles([file], "logo");
    setUploadingLogo(false);
  }

  async function onUploadImages(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setUploadingImages(true);
    await uploadFiles(files, "web");
    setUploadingImages(false);
  }

  async function generateAiAsset() {
    const prompt = (aiPrompt || "").trim();
    if (!prompt) {
      setAssetMsg("Add a prompt first for the AI image.");
      return;
    }
    if (!session?.user?.id) {
      setAssetMsg("Please log in first.");
      return;
    }

    try {
      setGeneratingAi(true);
      setAssetMsg("Generating AI image...");

      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: aiStyle,
          size: aiSize,
          userId: session.user.id,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(json?.error || "AI image generation failed");
      }

      setLatestAiUrl(json.url);
      if (json.stored) {
        setAssetMsg("AI image generated and saved to your assets.");
        await refreshAssets(session.user.id);
      } else {
        setAssetMsg("AI image generated. Storage failed, using temporary URL.");
      }
    } catch (err) {
      setAssetMsg(err?.message || "AI image generation failed");
    } finally {
      setGeneratingAi(false);
    }
  }

  async function refresh() {
    setLoading(true);

    let data = null, error = null;
    let q1 = supabase.from("funnels").select("id, name, slug, status, updated_at");
    ({ data, error } = await q1.order("updated_at", { ascending: false }));

    if (error && /updated_at/.test(error.message)) {
      let q2 = supabase.from("funnels").select("id, name, slug, status, created_at");
      const r2 = await q2.order("created_at", { ascending: false });
      data = r2.data; error = r2.error;
    }

    if (error) {
      const r3 = await supabase.from("funnels").select("id, name, slug, status");
      data = r3.data; error = r3.error;
    }

    setRows(data || []);
    setLoading(false);
  }

  async function fetchFunnelUsage(token) {
    if (!token) return;
    try {
      const res = await fetch("/api/funnels/usage", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => null);
      if (j?.ok) setFunnelUsage(j);
    } catch {}
  }

  async function createFunnel() {
    if (!newName.trim()) return alert("Please enter a funnel name.");
    if (!session?.user?.id) return alert("No session.");

    // Frontend quota guard
    if (funnelUsage?.atLimit) {
      alert(`You've reached your funnel limit (${funnelUsage.limit} on the ${funnelUsage.planName} plan). Please upgrade to create more funnels.`);
      return;
    }

    setCreating(true);

    const funnelName = newName.trim();
    const { data, error } = await supabase
      .from("funnels")
      .insert({
        owner_user_id: session.user.id,
        name: funnelName,
        description: "",
        slug: null,
        status: "draft",
      })
      .select("id")
      .single();

    if (error) {
      setCreating(false);
      return alert(error.message);
    }

    const { error: stepError } = await supabase.from("funnel_steps").insert({
      funnel_id: data.id,
      title: "Page 1",
      order_index: 0,
      content: buildStarterPageHtml(funnelName),
    });

    setCreating(false);
    if (stepError) {
      console.error("Could not create starter page:", stepError);
      alert("The funnel was created, but the first page could not be added automatically.");
    }

    window.location.href = `/modules/funnels/edit/${data.id}`;
  }

  async function saveName(id, name) {
    const clean = (name || "").trim();
    if (!clean) return alert("Name can’t be empty.");
    const { error } = await supabase.from("funnels").update({ name: clean }).eq("id", id);
    if (error) return alert(error.message);
    await refresh();
  }

  async function deleteFunnel(id) {
    if (!confirm("Delete this funnel? This cannot be undone.")) return;
    const { error } = await supabase.from("funnels").delete().eq("id", id);
    if (error) return alert(error.message);
    await refresh();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0c121a", color: "#e6eef5", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 16px" }}>

        {/* ── BANNER ── */}
        <div style={{
          background: "linear-gradient(135deg, #ef465d 0%, #b5224a 100%)",
          borderRadius: 16, padding: "22px 28px",
          margin: "16px auto 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 18,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{
              background: "rgba(255,255,255,0.18)", borderRadius: "50%",
              width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {ICONS.funnels({ size: 40, color: "#fff" })}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 48, fontWeight: 600, color: "#fff", lineHeight: 1.1 }}>Funnels</h1>
              <p style={{ margin: "4px 0 0", fontSize: 18, color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>
                Build multi-step funnels that capture leads &amp; drive conversions.
              </p>
            </div>
          </div>
          <Link href="/dashboard">
            <button style={{
              background: "linear-gradient(135deg, #3b82f6, #ef465d)", color: "#fff", border: "none",
              borderRadius: 10, padding: "12px 26px", fontSize: 18, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              boxShadow: "0 2px 12px rgba(59,130,246,0.25)",
              transition: "background 0.2s, box-shadow 0.2s"
            }}>
              ← Back
            </button>
          </Link>
        </div>

        {/* ── CONTENT ── */}

        {/* Wizard CTA — prominent */}
        <div style={{
          background: "linear-gradient(135deg,#1a2860,#0f1a40)",
          border: "1px solid #2b3a6a", borderRadius: 14, padding: "22px 24px",
          marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
        }}>
          <div>
            <p style={{ color: "#93c5fd", fontSize: 16, fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>✨ Recommended</p>
            <p style={{ color: "#e6eef5", fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>Build with the Funnel Wizard</p>
            <p style={{ color: "#64748b", fontSize: 16, margin: 0 }}>Choose a funnel type, enter your offer, and AI writes all the sections — ready to edit in seconds.</p>
          </div>
          <Link href="/modules/funnels/new">
            <button style={{
              padding: "16px 36px", borderRadius: 12, border: "none", whiteSpace: "nowrap",
              background: "linear-gradient(135deg,#3b82f6,#ef465d)",
              color: "#fff", fontSize: 18, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(239,70,93,0.25)",
              transition: "background 0.2s, box-shadow 0.2s"
            }}>
              🧭 Open Wizard →
            </button>
          </Link>
        </div>

        {/* Media upload panel (visible on this page) */}
        <div style={{
          background: "linear-gradient(135deg, #18233b 0%, #101929 100%)",
          border: "1px solid #2b3650", borderRadius: 14, padding: "20px 22px",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <div>
              <p style={{ color: "#93c5fd", fontSize: 16, margin: "0 0 4px", fontWeight: 600, letterSpacing: 1 }}>START HERE</p>
              <p style={{ color: "#e6eef5", fontSize: 22, margin: 0, fontWeight: 600 }}>Upload Logos & Website Images</p>
              <p style={{ color: "#64748b", fontSize: 16, margin: "4px 0 0" }}>Shared library used by Funnels + Website Builder.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} style={{ ...mediaBtn, fontSize: 18, fontWeight: 600, background: "linear-gradient(135deg,#2563eb,#22c55e)" }}>
                {uploadingLogo ? "Uploading Logo..." : "Upload Logo"}
              </button>
              <button onClick={() => imagesInputRef.current?.click()} disabled={uploadingImages} style={{ ...mediaBtn, background: "linear-gradient(135deg,#0ea5e9,#ef465d)", fontSize: 18, fontWeight: 600 }}>
                {uploadingImages ? "Uploading Images..." : "Upload Website Images"}
              </button>
              <Link href="/assets" style={mediaLink}>Open Media Library</Link>
            </div>
          </div>

          <div style={{
            border: "1px solid #2b3650",
            borderRadius: 12,
            padding: 12,
            background: "#0c121a",
            marginBottom: 12,
          }}>
            <p style={{ color: "#93c5fd", fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>DALL-E Icon/Image Generator</p>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe the icon or image you want (example: flat blue funnel icon, transparent background, modern SaaS style)"
              style={{
                width: "100%",
                minHeight: 72,
                borderRadius: 10,
                border: "1px solid #2b3650",
                background: "#08101a",
                color: "#e6eef5",
                padding: 10,
                fontSize: 16,
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
              <select value={aiStyle} onChange={(e) => setAiStyle(e.target.value)} style={aiSelect}>
                <option value="icon">Icon / Flat</option>
                <option value="clean">Clean Graphic</option>
                <option value="photo">Photo Real</option>
              </select>
              <select value={aiSize} onChange={(e) => setAiSize(e.target.value)} style={aiSelect}>
                <option value="1024x1024">Square</option>
                <option value="1536x1024">Landscape</option>
                <option value="1024x1536">Portrait</option>
              </select>
              <button onClick={generateAiAsset} disabled={generatingAi} style={{ ...mediaBtn, background: "linear-gradient(135deg,#22c55e,#ef465d)", fontSize: 18, fontWeight: 600 }}>
                {generatingAi ? "Generating..." : "Generate with DALL-E"}
              </button>
            </div>
            {latestAiUrl ? (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ color: "#cbd5e1", fontSize: 16 }}>Latest AI image generated successfully.</span>
                <a href="/assets" style={mediaLink}>View in Media Library</a>
                <a href={latestAiUrl} target="_blank" rel="noreferrer" style={mediaLink}>Open Generated Image</a>
              </div>
            ) : null}
          </div>

          {assetMsg ? <p style={{ color: "#cbd5e1", margin: "0 0 10px", fontSize: 16 }}>{assetMsg}</p> : null}

          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "12px 14px",
            border: "1px solid #2b3650",
            borderRadius: 12,
            background: "#0c121a",
          }}>
            <p style={{ color: "#94a3b8", margin: 0, fontSize: 16 }}>
              {assetFiles.length > 0 ? `${assetFiles.length} asset${assetFiles.length === 1 ? "" : "s"} available in the shared media library.` : "No assets uploaded yet."}
            </p>
            <Link href="/assets" style={mediaLink}>Open Media Library</Link>
          </div>

          <input ref={logoInputRef} type="file" accept="image/*" onChange={onUploadLogo} style={{ display: "none" }} />
          <input ref={imagesInputRef} type="file" accept="image/*" multiple onChange={onUploadImages} style={{ display: "none" }} />
        </div>

        {/* Create row */}
        <div style={{
          background: "linear-gradient(135deg, #1a2236 0%, #141b27 100%)",
          border: "1px solid #2b3650", borderRadius: 14, padding: "24px 24px",
          marginBottom: 28,
        }}>
          {/* Usage bar */}
          {funnelUsage && funnelUsage.limit !== null && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#94a3b8", fontSize: 16, fontWeight: 600 }}>Funnels used</span>
                <span style={{
                  fontSize: 16, fontWeight: 600,
                  color: funnelUsage.atLimit ? "#ef4444" : funnelUsage.used / funnelUsage.limit >= 0.8 ? "#f59e0b" : "#10b981",
                }}>
                  {funnelUsage.used} / {funnelUsage.limit}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: "#1e2c40", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  width: `${Math.min(100, (funnelUsage.used / funnelUsage.limit) * 100)}%`,
                  background: funnelUsage.atLimit ? "#ef4444" : funnelUsage.used / funnelUsage.limit >= 0.8 ? "#f59e0b" : "#10b981",
                  transition: "width 0.3s",
                }} />
              </div>
              {funnelUsage.atLimit && (
                <p style={{ margin: "8px 0 0", fontSize: 16, color: "#f87171" }}>
                  You&apos;ve reached your funnel limit on the <strong>{funnelUsage.planName}</strong> plan.{" "}
                  <a href="/billing" style={{ color: "#60a5fa", textDecoration: "underline" }}>Upgrade to create more.</a>
                </p>
              )}
              {!funnelUsage.atLimit && funnelUsage.used / funnelUsage.limit >= 0.8 && (
                <p style={{ margin: "8px 0 0", fontSize: 16, color: "#fbbf24" }}>
                  You&apos;re approaching your funnel limit. <a href="/billing" style={{ color: "#60a5fa", textDecoration: "underline" }}>Consider upgrading.</a>
                </p>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: 16, marginBottom: 8, fontWeight: 600 }}>
              New funnel name
            </label>
            <input
              placeholder="e.g. Summer Lead Magnet"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !funnelUsage?.atLimit && createFunnel()}
              disabled={!!funnelUsage?.atLimit}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 10,
                border: "1px solid #2b3650", background: "#0c121a", color: "#e6eef5",
                fontSize: 16, outline: "none",
                opacity: funnelUsage?.atLimit ? 0.5 : 1,
              }}
            />
          </div>
          <Link href="/modules/funnels/new">
            <button
              style={{
                padding: "14px 24px",
                borderRadius: 10,
                border: "1px solid #34517c",
                background: "#112036",
                color: "#93c5fd",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 18,
                whiteSpace: "nowrap",
                marginTop: 28,
              }}
            >
              Start with Template
            </button>
          </Link>
            <button
              onClick={createFunnel}
              disabled={creating || !!funnelUsage?.atLimit}
              style={{
                padding: "14px 32px", borderRadius: 10, border: "none",
                background: (creating || funnelUsage?.atLimit) ? "#555" : "linear-gradient(135deg, #ef465d, #3b82f6)",
                color: "#fff", cursor: (creating || funnelUsage?.atLimit) ? "default" : "pointer",
                fontWeight: 600, fontSize: 18, whiteSpace: "nowrap", marginTop: 28,
                boxShadow: (creating || funnelUsage?.atLimit) ? "none" : "0 4px 14px rgba(239,70,93,0.4)",
                transition: "background 0.2s, box-shadow 0.2s",
                opacity: funnelUsage?.atLimit ? 0.5 : 1,
              }}
            >
            {creating ? "Creating…" : funnelUsage?.atLimit ? "Limit Reached" : "+ Create Funnel"}
          </button>
          </div>
        </div>

        {/* Funnel list */}
        {loading ? (
          <p style={{ fontSize: 16, color: "#94a3b8" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <div style={{
            padding: "48px 24px", border: "2px dashed #2b3650", borderRadius: 14,
            textAlign: "center", color: "#64748b",
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#94a3b8" }}>No funnels yet</p>
            <p style={{ margin: "6px 0 0", fontSize: 16, color: "#64748b" }}>Create your first funnel above to get started.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((r, i) => (
              <Row key={r.id} row={r} onSave={saveName} onDelete={deleteFunnel} idx={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const mediaBtn = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 16,
  cursor: "pointer",
};

const mediaLink = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #34517c",
  color: "#93c5fd",
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 16,
  background: "#112036",
};

const aiSelect = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #2b3650",
  background: "#0c121a",
  color: "#e6eef5",
  fontSize: 16,
};

/* ---- Row component — card style ---- */

// Color palette for cards and icons
const CARD_COLORS = [
  { bg: "#111827", icon: "#60a5fa" }, // blue
  { bg: "#1e293b", icon: "#f59e42" }, // orange
  { bg: "#0e172a", icon: "#22c55e" }, // green
  { bg: "#23272f", icon: "#ef465d" }, // red
  { bg: "#1a2236", icon: "#a78bfa" }, // purple
  { bg: "#18233b", icon: "#fbbf24" }, // yellow
  { bg: "#22223b", icon: "#38bdf8" }, // sky
  { bg: "#2b3650", icon: "#f472b6" }, // pink
];

function Row({ row, onSave, onDelete, idx = 0 }) {
  const [name, setName] = useState(row.name);
  const isPublished = row.status === "published";
  const palette = CARD_COLORS[idx % CARD_COLORS.length];
  // Pick an icon for each card (cycle through a few for demo)
  const icons = [ICONS.funnels, ICONS.email, ICONS.automation, ICONS.billing, ICONS.products, ICONS.leads, ICONS.settings, ICONS.analytics];
  const iconFn = icons[idx % icons.length];

  return (
    <div style={{
      background: palette.bg,
      border: "1px solid #1e2d45",
      borderRadius: 16,
      padding: "28px 20px 18px 20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
      boxShadow: "0 2px 12px 0 rgba(0,0,0,0.10)",
      transition: "background 0.3s"
    }}>
      {/* Large icon on its own line, centered */}
      <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(0,0,0,0.10)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        {iconFn({ size: 44, color: palette.icon })}
      </div>
      <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 14 }}>
        {/* Status dot */}
        <div style={{
          width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
          background: isPublished ? "#22c55e" : "#f59e0b",
          boxShadow: isPublished ? "0 0 8px rgba(34,197,94,0.6)" : "0 0 8px rgba(245,158,11,0.5)",
        }} />
        {/* Name input */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #2b3650",
            background: "#0c121a", color: "#e6eef5", fontSize: 16, fontWeight: 600,
          }}
        />
        {/* Status + URL */}
        <div style={{ minWidth: 160, fontSize: 16 }}>
          {isPublished && row.slug ? (
            <a href={`/p/${row.slug}`} target="_blank" rel="noreferrer"
              style={{ color: "#60a5fa", fontWeight: 600, textDecoration: "none", fontSize: 16 }}>
              /p/{row.slug} ↗
            </a>
          ) : (
            <span style={{ color: "#f59e0b", fontWeight: 600 }}>Draft</span>
          )}
        </div>
        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <a href={`/modules/funnels/edit/${row.id}`}
              style={{
                padding: "10px 20px", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, #2d6cdf, #ef465d)",
                color: "#fff", fontSize: 18, fontWeight: 600, textDecoration: "none",
                boxShadow: "0 2px 8px rgba(45,108,223,0.4)",
                transition: "background 0.2s, box-shadow 0.2s"
              }}>
            Edit
          </a>
          <button onClick={() => onSave(row.id, name)}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "1px solid #22c55e",
              background: "linear-gradient(135deg,#22c55e,#3b82f6)", color: "#fff", fontSize: 18, fontWeight: 600, cursor: "pointer",
              transition: "background 0.2s"
            }}>
            Save
          </button>
          <button onClick={() => onDelete(row.id)}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "1px solid #ef465d",
              background: "linear-gradient(135deg,#ef465d,#b91c1c)", color: "#fff", fontSize: 18, fontWeight: 600, cursor: "pointer",
              transition: "background 0.2s"
            }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- styles removed — inline styles used above ---- */
