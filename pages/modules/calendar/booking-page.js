// pages/modules/calendar/booking-page.js
// Edit your public booking page appearance + copy per-service links

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://yourdomain.com";
const CALENDAR_COLOR_STORAGE_KEY = "calendar.booking.savedColors";

const S = {
  page:        { minHeight: "100vh", background: "#0c121a", color: "#fff", padding: "0 20px 60px", fontFamily: "system-ui,sans-serif" },
  banner:      { maxWidth: 1320, margin: "16px auto 28px", background: "#84cc16", borderRadius: 16, padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  bannerLeft:  { display: "flex", alignItems: "center", gap: 16 },
  bannerTitle: { fontSize: 48, fontWeight: 600, color: "#fff", margin: 0 },
  bannerSub:   { fontSize: 18, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  backBtn:     { fontSize: 18, fontWeight: 600, background: "rgb(0, 0, 0)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", padding: "10px 20px", borderRadius: 9, cursor: "pointer" },
  shell:       { maxWidth: 1320, margin: "0 auto" },
  grid:        { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, alignItems: "start" },
  card:        { background: "#161e2b", border: "1px solid #243047", borderRadius: 16, padding: "24px 26px", marginBottom: 22 },
  cardTitle:   { fontSize: 18, fontWeight: 600, color: "#fff", marginBottom: 20, marginTop: 0 },
  label:       { display: "block", fontSize: 16, color: "#9CA3AF", marginBottom: 6 },
  input:       { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: 16, outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  textarea:    { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #374151", background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: 16, outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", minHeight: 80 },
  field:       { marginBottom: 18 },
  saveBtn:     { padding: "11px 28px", background: "#84cc16", border: "none", borderRadius: 9, color: "#fff", fontWeight: 600, fontSize: 18, cursor: "pointer" },
  saved:       { fontSize: 16, color: "#6EE7B7", marginLeft: 14 },
  hint:        { fontSize: 14, color: "#6B7280", marginTop: 4 },
  urlBox:      { background: "#0c121a", border: "1px solid #243047", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  urlText:     { fontSize: 15, color: "#e5e7eb", fontFamily: "monospace", wordBreak: "break-all", flex: 1 },
  copyBtn:     { padding: "8px 16px", background: "#22c55e", border: "none", borderRadius: 8, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 },
  copiedBtn:   { padding: "8px 16px", background: "#374151", border: "none", borderRadius: 8, color: "#9CA3AF", fontSize: 15, fontWeight: 600, cursor: "default", whiteSpace: "nowrap", flexShrink: 0 },
  serviceRow:  { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #1e293b", gap: 12 },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: 16, fontWeight: 600, color: "#fff" },
  serviceSub:  { fontSize: 14, color: "#9CA3AF", marginTop: 2 },
  previewBtn:  { padding: "8px 18px", background: "#84cc16", border: "none", borderRadius: 8, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", textDecoration: "none" },
  swatch:      (col, sel) => ({ width: 32, height: 32, borderRadius: "50%", background: col, cursor: "pointer", border: sel ? "3px solid #fff" : "3px solid transparent", boxSizing: "border-box" }),
};

const COLORS = ["#84cc16","#3b82f6","#8b5cf6","#ec4899","#f59e0b","#06b6d4","#ef4444","#10b981"];

function normalizeHexColor(input) {
  if (!input) return "";
  const value = `${input}`.trim().toLowerCase();
  const short = value.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    const d = short[1];
    return `#${d[0]}${d[0]}${d[1]}${d[1]}${d[2]}${d[2]}`;
  }
  const full = value.match(/^#([0-9a-f]{6})$/i);
  return full ? `#${full[1]}` : "";
}

export default function BookingPageEditor() {
  const [username, setUsername]       = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [pageTitle, setPageTitle]     = useState("");
  const [pageBio, setPageBio]         = useState("");
  const [accentColor, setAccentColor] = useState("#84cc16");
  const [logoUrl, setLogoUrl]         = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [services, setServices]       = useState([]);
  const [svcSettings, setSvcSettings] = useState({}); // { [serviceId]: { pageTitle, pageBio, accentColor, logoUrl, saving, saved, error, open } }
  const [loading, setLoading]         = useState(true);
  const [saved, setSaved]             = useState(false);
  const [saveError, setSaveError]     = useState("");
  const [copied, setCopied]           = useState(null); // stores url that was copied
  const [savedColors, setSavedColors] = useState([]);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CALENDAR_COLOR_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setSavedColors(parsed.map((c) => normalizeHexColor(c)).filter(Boolean).slice(0, 24));
    } catch {
      // ignore malformed local storage data
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CALENDAR_COLOR_STORAGE_KEY, JSON.stringify(savedColors));
    } catch {
      // ignore storage write errors
    }
  }, [savedColors]);

  function rememberColor(color) {
    const hex = normalizeHexColor(color);
    if (!hex) return;
    setSavedColors((prev) => [hex, ...prev.filter((c) => c !== hex)].slice(0, 24));
  }

  function setGlobalAccent(color) {
    const hex = normalizeHexColor(color);
    if (!hex) return;
    setAccentColor(hex);
    rememberColor(hex);
  }

  function setServiceAccent(serviceId, color) {
    const hex = normalizeHexColor(color);
    if (!hex) return;
    updateSvc(serviceId, "accentColor", hex);
    rememberColor(hex);
  }

  async function loadConfig(uid) {
    try {
      const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(`${uid}/booking-page-config.json`);
      const res = await fetch(publicUrl + "?t=" + Date.now());
      return res.ok ? await res.json() : null;
    } catch { return null; }
  }

  async function writeConfig(uid, config) {
    const blob = new Blob([JSON.stringify(config)], { type: "application/json" });
    const { error } = await supabase.storage.from("assets").upload(`${uid}/booking-page-config.json`, blob, { upsert: true });
    return !error;
  }

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }
    const uid = session.user.id;

    const [profileRes, servicesRes, config] = await Promise.all([
      supabase.from("profiles").select("username").eq("user_id", uid).maybeSingle(),
      supabase.from("services").select("*").eq("user_id", uid).eq("active", true).order("created_at", { ascending: true }),
      loadConfig(uid),
    ]);

    setUsername(profileRes.data?.username || "");
    setUsernameInput(profileRes.data?.username || "");

    const g = config?.global || {};
    setPageTitle(g.pageTitle || "");
    setPageBio(g.pageBio || "");
    setAccentColor(g.accentColor || "#84cc16");
    setLogoUrl(g.logoUrl || "");

    const svcs = servicesRes.data || [];
    setServices(svcs);

    const map = {};
    svcs.forEach(sv => {
      const svcCfg = (config?.services || {})[sv.id] || {};
      map[sv.id] = {
        pageTitle:   svcCfg.pageTitle   || "",
        pageBio:     svcCfg.pageBio     || "",
        accentColor: svcCfg.accentColor || "#84cc16",
        logoUrl:     svcCfg.logoUrl     || "",
        saving: false, saved: false, error: "", open: false,
      };
    });
    setSvcSettings(map);
    setLoading(false);
  }

  async function saveUsername() {
    setUsernameError("");
    const val = usernameInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!val) { setUsernameError("Username cannot be empty."); return; }
    if (val.length < 3) { setUsernameError("Must be at least 3 characters."); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Check uniqueness
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", val)
      .neq("user_id", session.user.id)
      .maybeSingle();

    if (existing) { setUsernameError("That username is already taken. Try another."); return; }

    const { error } = await supabase
      .from("profiles")
      .update({ username: val })
      .eq("user_id", session.user.id);

    if (error) { setUsernameError("Failed to save. Try again."); return; }

    setUsername(val);
    setUsernameInput(val);
    setUsernameSaved(true);
    setTimeout(() => setUsernameSaved(false), 2500);
  }

  async function saveServicePage(svcId) {
    const s = svcSettings[svcId];
    if (!s) return;
    setSvcSettings(p => ({ ...p, [svcId]: { ...p[svcId], saving: true, error: "" } }));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Build full config and overwrite the file
    const servicesMap = {};
    Object.entries(svcSettings).forEach(([id, ss]) => {
      servicesMap[id] = { pageTitle: ss.pageTitle, pageBio: ss.pageBio, accentColor: ss.accentColor, logoUrl: ss.logoUrl };
    });
    // Apply the current edit
    servicesMap[svcId] = { pageTitle: s.pageTitle, pageBio: s.pageBio, accentColor: s.accentColor, logoUrl: s.logoUrl };

    const ok = await writeConfig(session.user.id, {
      global:   { pageTitle, pageBio, accentColor, logoUrl },
      services: servicesMap,
    });

    if (!ok) {
      setSvcSettings(p => ({ ...p, [svcId]: { ...p[svcId], saving: false, error: "Upload failed. Check storage permissions." } }));
      return;
    }
    setSvcSettings(p => ({ ...p, [svcId]: { ...p[svcId], saving: false, saved: true } }));
    setTimeout(() => setSvcSettings(p => ({ ...p, [svcId]: { ...p[svcId], saved: false } })), 2500);
  }

  function updateSvc(svcId, field, value) {
    setSvcSettings(p => ({ ...p, [svcId]: { ...p[svcId], [field]: value } }));
  }

  async function save() {
    setSaveError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const servicesMap = {};
    Object.entries(svcSettings).forEach(([id, ss]) => {
      servicesMap[id] = { pageTitle: ss.pageTitle, pageBio: ss.pageBio, accentColor: ss.accentColor, logoUrl: ss.logoUrl };
    });

    const ok = await writeConfig(session.user.id, {
      global:   { pageTitle, pageBio, accentColor, logoUrl },
      services: servicesMap,
    });

    if (!ok) {
      setSaveError("Upload failed. Check that your Supabase \'assets\' storage bucket is public.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function copy(url) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const baseUrl = `${SITE}/u/${username}`;

  if (loading) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading…</div>;

  return (
    <div style={S.page}>
      <div style={S.banner}>
        <div style={S.bannerLeft}>
          <div style={{ fontSize: 42 }}>🌐</div>
          <div>
            <h1 style={S.bannerTitle}>Booking Page</h1>
            <div style={S.bannerSub}>Customise and share your public booking page</div>
          </div>
        </div>
        <Link href="/modules/calendar/dashboard">
          <button style={S.backBtn}>← Calendar Dashboard</button>
        </Link>
      </div>

      <div style={S.shell}>
        <div style={S.grid}>

          {/* LEFT — Appearance */}
          <div>
            <div style={S.card}>
              <p style={S.cardTitle}>✏️ Page Appearance</p>

              <div style={S.field}>
                <label style={S.label}>Page Logo</label>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="logo" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: "1px solid #374151" }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 10, background: "#1e293b", border: "1px dashed #374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#4B5563" }}>🖼️</div>
                  )}
                  <div>
                    <label style={{ ...S.saveBtn, padding: "8px 18px", fontSize: 15, cursor: "pointer", display: "inline-block" }}>
                      {logoUploading ? "Uploading…" : logoUrl ? "Change Logo" : "Upload Logo"}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        disabled={logoUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setLogoUploading(true);
                          const { data: { session } } = await supabase.auth.getSession();
                          const path = `${session.user.id}/booking-logo-${Date.now()}`;
                          const { error: upErr } = await supabase.storage.from("assets").upload(path, file, { upsert: true });
                          if (!upErr) {
                            const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(path);
                            setLogoUrl(publicUrl);
                          }
                          setLogoUploading(false);
                        }}
                      />
                    </label>
                    {logoUrl && (
                      <button onClick={() => setLogoUrl("")} style={{ marginLeft: 10, background: "none", border: "none", color: "#f87171", fontSize: 14, cursor: "pointer" }}>Remove</button>
                    )}
                    <div style={S.hint}>Shown at the top of your public booking page. Square images work best.</div>
                  </div>
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>Page Title</label>
                <input
                  value={pageTitle}
                  placeholder={username ? `Book with ${username}` : "Book an appointment"}
                  onChange={(e) => setPageTitle(e.target.value)}
                  style={S.input}
                />
                <div style={S.hint}>Shown as the heading on your public booking page</div>
              </div>

              <div style={S.field}>
                <label style={S.label}>Bio / Intro Text</label>
                <textarea
                  value={pageBio}
                  placeholder="Tell clients about yourself or what to expect…"
                  onChange={(e) => setPageBio(e.target.value)}
                  style={S.textarea}
                />
              </div>

              <div style={S.field}>
                <label style={S.label}>Accent Colour</label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                  {COLORS.map((col) => (
                    <button
                      key={col}
                      onClick={() => setGlobalAccent(col)}
                      style={S.swatch(col, accentColor === col)}
                      title={col}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setGlobalAccent(e.target.value)}
                    style={{ width: 40, height: 32, borderRadius: 6, border: "1px solid #374151", background: "none", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 14, color: "#9CA3AF" }}>Custom colour</span>
                </div>
                {savedColors.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      Saved Colours
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {savedColors.map((col) => (
                        <button
                          key={col}
                          onClick={() => setGlobalAccent(col)}
                          style={S.swatch(col, accentColor === col)}
                          title={col}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center" }}>
                <button style={S.saveBtn} onClick={save}>Save Changes</button>
                {saved && <span style={S.saved}>✓ Saved</span>}
                {saveError && <span style={{ fontSize: 14, color: "#f87171", marginLeft: 14 }}>{saveError}</span>}
              </div>
            </div>
          </div>

          {/* RIGHT — URLs */}
          <div>
              {/* Username */}
              <div style={S.card}>
                <p style={S.cardTitle}>🔗 Your Booking URL</p>
                <p style={{ fontSize: 16, color: "#9CA3AF", marginTop: 0, marginBottom: 16 }}>
                  Share this link on your ads, posts, bio, and emails. Anyone who visits it can book directly.
                </p>

                {/* Username input always visible */}
                <div style={S.field}>
                  <label style={S.label}>Username</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                      <span style={{ position: "absolute", left: 12, color: "#6B7280", fontSize: 16, pointerEvents: "none" }}>/u/</span>
                      <input
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                        placeholder="yourname"
                        style={{ ...S.input, paddingLeft: 44 }}
                        onKeyDown={(e) => e.key === "Enter" && saveUsername()}
                      />
                    </div>
                    <button onClick={saveUsername} style={{ ...S.copyBtn, background: "#84cc16", padding: "10px 20px", fontSize: 16 }}>
                      {usernameSaved ? "Saved ✓" : "Save"}
                    </button>
                  </div>
                  {usernameError && <div style={{ color: "#f87171", fontSize: 14, marginTop: 6 }}>{usernameError}</div>}
                  {!usernameError && <div style={S.hint}>Lowercase letters, numbers, hyphens and underscores only. Min 3 characters.</div>}
                </div>

                {username ? (
                  <>
                    <div style={S.urlBox}>
                      <span style={S.urlText}>{baseUrl}</span>
                      <button style={copied === baseUrl ? S.copiedBtn : S.copyBtn} onClick={() => copy(baseUrl)}>
                        {copied === baseUrl ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <a href={baseUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <button style={{ ...S.saveBtn, marginTop: 12, background: "#1e293b", border: "1px solid #374151" }}>
                        Preview Page ↗
                      </button>
                    </a>
                  </>
                ) : (
                  <div style={{ fontSize: 15, color: "#6B7280", marginTop: 4 }}>Set a username above to generate your booking link.</div>
                )}
              </div>

            {/* Per-service Pages */}
            <div style={S.card}>
              <p style={S.cardTitle}>🎯 Per-Service Pages</p>
              <p style={{ fontSize: 15, color: "#9CA3AF", marginTop: 0, marginBottom: 20 }}>
                Each service can have its own title, bio, colours and logo. Expand a service to customise it — or just share its link as-is.
              </p>
              {services.length === 0 ? (
                <div style={{ fontSize: 15, color: "#6B7280" }}>
                  No active services yet.{" "}
                  <Link href="/modules/calendar/services" style={{ color: "#84cc16" }}>Create one →</Link>
                </div>
              ) : (
                services.map((svc) => {
                  const url = `${SITE}/u/${username}?service=${svc.id}`;
                  const ss  = svcSettings[svc.id] || {};
                  return (
                    <div key={svc.id} style={{ borderBottom: "1px solid #1e293b", paddingBottom: 14, marginBottom: 14 }}>
                      {/* Header row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={S.serviceName}>{svc.name}</div>
                          <div style={S.serviceSub}>{svc.duration_minutes} min {svc.price > 0 ? `· $${svc.price.toFixed(2)}` : "· Free"}</div>
                        </div>
                        <button style={copied === url ? S.copiedBtn : S.copyBtn} onClick={() => copy(url)}>{copied === url ? "Copied!" : "Copy Link"}</button>
                        <a href={url} target="_blank" rel="noopener noreferrer"><button style={{ ...S.copyBtn, background: "#374151" }}>↗</button></a>
                        <button
                          onClick={() => setSvcSettings(p => ({ ...p, [svc.id]: { ...p[svc.id], open: !ss.open } }))}
                          style={{ background: ss.open ? "#84cc16" : "#1e293b", border: "1px solid #374151", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, padding: "7px 14px", cursor: "pointer" }}
                        >{ss.open ? "▲ Close" : "✏️ Edit Page"}</button>
                      </div>

                      {/* Expandable editor */}
                      {ss.open && (
                        <div style={{ background: "#0c121a", border: "1px solid #243047", borderRadius: 10, padding: "18px 20px", marginTop: 14 }}>
                          <div style={S.field}>
                            <label style={S.label}>Page Title</label>
                            <input value={ss.pageTitle || ""} placeholder={`Book: ${svc.name}`} onChange={e => updateSvc(svc.id, "pageTitle", e.target.value)} style={S.input} />
                          </div>
                          <div style={S.field}>
                            <label style={S.label}>Bio / Intro</label>
                            <textarea value={ss.pageBio || ""} placeholder="Describe this service…" onChange={e => updateSvc(svc.id, "pageBio", e.target.value)} style={S.textarea} />
                          </div>
                          <div style={S.field}>
                            <label style={S.label}>Accent Colour</label>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                              {COLORS.map(col => (
                                <button key={col} onClick={() => setServiceAccent(svc.id, col)} style={S.swatch(col, (ss.accentColor || "#84cc16") === col)} />
                              ))}
                              <input type="color" value={ss.accentColor || "#84cc16"} onChange={e => setServiceAccent(svc.id, e.target.value)} style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid #374151", background: "none", cursor: "pointer" }} />
                              {savedColors.map(col => (
                                <button key={`${svc.id}-${col}`} onClick={() => setServiceAccent(svc.id, col)} style={S.swatch(col, (ss.accentColor || "#84cc16") === col)} title={col} />
                              ))}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button onClick={() => saveServicePage(svc.id)} disabled={ss.saving} style={{ ...S.saveBtn, fontSize: 15, padding: "9px 22px" }}>{ss.saving ? "Saving…" : "Save Service Page"}</button>
                            {ss.saved && <span style={S.saved}>✓ Saved</span>}
                            {ss.error && <span style={{ fontSize: 13, color: "#f87171" }}>{ss.error}</span>}
                          </div>
                          <div style={{ marginTop: 14, borderTop: "1px solid #1e293b", paddingTop: 12 }}>
                            <div style={{ ...S.urlText, fontSize: 13, color: "#4B5563" }}>{url}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
