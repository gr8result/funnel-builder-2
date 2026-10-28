// /pages/modules/funnels/index.js
// Funnels list with full GR8 banner + Coming Soon placeholder if needed

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import ICONS from "../../../components/iconMap";
import AuthGate from "../../../components/AuthGate";
import CampaignManager from "../../../components/funnels/CampaignManager";
import { supabase } from "../../../lib/supabaseClient";
import { useBusinessBranding } from "../../../hooks/useBusinessBranding";
import { useWorkspace } from "../../../hooks/useWorkspace";

export default function FunnelsHome() {
  return (
    <AuthGate>
      <FunnelsInner />
    </AuthGate>
  );
}

function FunnelsInner() {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const { branding, error: brandingError } = useBusinessBranding();
  const [session, setSession] = useState(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [navError, setNavError] = useState("");
  const [navigatingTo, setNavigatingTo] = useState("");
  const newNameRef = useRef(null);
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
    refreshAssets(session.user.id);
    fetchFunnelUsage(session.access_token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    const onError = (err, url) => {
      if (err?.cancelled) return;
      setNavigatingTo("");
      setNavError(`We couldn't open ${String(url || "that page").split("?")[0]}: ${err?.message || "the page failed to load"}. Check your connection and try again; if it keeps happening, reload this dashboard.`);
    };
    router.events.on("routeChangeError", onError);
    return () => router.events.off("routeChangeError", onError);
  }, [router.events]);

  async function openCreator(href) {
    setNavError("");
    setNavigatingTo(href);
    try {
      const ok = await router.push(href);
      if (ok === false) throw new Error("navigation was blocked");
    } catch (err) {
      if (err?.cancelled) return;
      setNavigatingTo("");
      setNavError(`We couldn't open the creator: ${err?.message || "the page failed to load"}. Please try again.`);
    }
  }

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
    setCreateError("");
    if (!newName.trim()) {
      setCreateError("Enter a name for the new funnel, then press + Create Funnel.");
      newNameRef.current?.focus();
      return;
    }
    if (!session?.user?.id) {
      setCreateError("Your session has expired. Please sign in again to create a funnel.");
      return;
    }
    if (funnelUsage?.atLimit) {
      setCreateError(`You've reached your funnel limit (${funnelUsage.limit} on the ${funnelUsage.planName} plan). Delete a funnel or upgrade to create more.`);
      return;
    }

    setCreating(true);
    const funnelName = newName.trim();
    const { data, error } = await supabase
      .from("funnels")
      .insert({
        owner_user_id: session.user.id,
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
        name: funnelName,
        description: "",
        slug: null,
        status: "draft",
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      setCreating(false);
      setCreateError(`We couldn't create the funnel: ${error?.message || "no funnel was returned"}. Please try again.`);
      return;
    }

    const { error: stepError } = await supabase.from("funnel_steps").insert({
      funnel_id: data.id,
      title: "Page 1",
      order_index: 0,
      content: buildStarterPageHtml(funnelName),
    });

    if (stepError) {
      await supabase.from("funnels").delete().eq("id", data.id);
      setCreating(false);
      setCreateError(`We couldn't add the first page, so the funnel wasn't created: ${stepError.message}. Please try again.`);
      return;
    }

    await openCreator(`/modules/funnels/edit/${data.id}`);
    setCreating(false);
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
              <h1 style={{ margin: 0, fontSize: 48, fontWeight: 600, color: "#fff", lineHeight: 1.1 }}>Funnel Builder</h1>
              <p style={{ margin: "4px 0 0", fontSize: 18, color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>
                Landing pages and multi-step sales funnels.
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
            <p style={{ color: "#e6eef5", fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>Create a new campaign</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, minWidth: 0 }}>
            <button type="button" onClick={() => openCreator("/modules/landing-pages?from=sales-funnels")} disabled={!!navigatingTo} data-testid="create-ai-landing-page" style={{ padding: "14px 20px", borderRadius: 8, border: "none", background: "#b5224a", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", textAlign: "center" }}>
              {navigatingTo.startsWith("/modules/landing-pages") ? "Opening…" : "Create standalone landing page"}
            </button>
            <button type="button" onClick={() => openCreator("/modules/funnels/new")} disabled={!!navigatingTo} data-testid="create-multi-step-funnel" style={{ padding: "14px 20px", borderRadius: 8, border: "1px solid #93c5fd", background: "transparent", color: "#e6eef5", fontSize: 16, fontWeight: 600, cursor: "pointer", textAlign: "center" }}>
              {navigatingTo === "/modules/funnels/new" ? "Opening…" : "Create multi-step sales funnel"}
            </button>
          </div>
          {navError ? (
            <div role="alert" data-testid="creator-nav-error" style={{ flexBasis: "100%", background: "#3b1219", border: "1px solid #7f1d1d", color: "#fecaca", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {navError}
              <button type="button" onClick={() => window.location.reload()} style={{ ...mediaLink, cursor: "pointer" }}>Reload dashboard</button>
            </div>
          ) : null}
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
              <p style={{ color: "#e6eef5", fontSize: 22, margin: 0, fontWeight: 600 }}>Company Branding & Images</p>
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

          {branding?.logo ? <div role="status" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", flexWrap: "wrap" }}>
            <img src={branding.logo} alt="Saved company logo" style={{ maxWidth: 200, maxHeight: 96, objectFit: "contain", background: "#fff", padding: 8, borderRadius: 6 }} />
            <span style={{ color: "#cbd5e1" }}>Company logo saved</span>
            <Link href="/account" style={mediaLink}>Manage company branding</Link>
          </div> : null}
          {brandingError ? <p role="alert" style={{ color: "#fca5a5" }}>{brandingError}</p> : null}

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
              ref={newNameRef}
              placeholder="e.g. Summer Lead Magnet"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setCreateError(""); }}
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
          <button
            type="button"
            onClick={() => openCreator("/modules/funnels/new")}
            disabled={!!navigatingTo}
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
            <button
              type="button"
              data-testid="create-blank-funnel"
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
          {createError ? <p role="alert" data-testid="create-funnel-error" style={{ margin: "12px 0 0", color: "#fca5a5", fontSize: 16 }}>{createError}</p> : null}
        </div>

        <CampaignManager onFunnelsChanged={() => fetchFunnelUsage(session?.access_token)} />
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

/* ---- styles removed — inline styles used above ---- */
