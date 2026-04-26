// pages/assets.js
// File uploader + file list under /assets bucket at /<userId>/.
// Content-only: Layout (with SideNav + TopNav) is applied globally in _app.js.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Assets() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [prefix, setPrefix] = useState("");
  const [files, setFiles] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session || null);
      ({
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null)));
    })();
    return () => subscription?.unsubscribe();
  }, []);

  
  useEffect(() => {
    if (!session) return;
    const p = `${session.user.id}/`;
    setPrefix(p);
    listFiles(p);
  }, [session]);

  async function listFiles(p) {
    setLoading(true);
    const { data, error } = await supabase.storage
      .from("assets")
      .list(p, { limit: 200, offset: 0, sortBy: { column: "name", order: "asc" } });
    if (!error) setFiles(data || []);
    setLoading(false);
  }

  function publicUrl(name) {
    const { data } = supabase.storage.from("assets").getPublicUrl(`${prefix}${name}`);
    return data.publicUrl;
  }

  function safeName(name = "") {
    return name.replace(/[^a-zA-Z0-9._-]/g, "-");
  }

  async function uploadSingle(file, tag) {
    if (!file || !session) return;
    const path = `${session.user.id}/${tag}-${Date.now()}-${safeName(file.name)}`;
    const { error } = await supabase.storage.from("assets").upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });
    if (error) throw error;
  }

  async function onUploadLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !session) return;
    setUploadingLogo(true);
    try {
      await uploadSingle(file, "logo");
      await listFiles(prefix);
    } catch (error) {
      alert(error.message || "Logo upload failed");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onUploadWebsiteImages(e) {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (!selected.length || !session) return;
    setUploadingImages(true);
    try {
      for (const file of selected) {
        await uploadSingle(file, "web");
      }
      await listFiles(prefix);
    } catch (error) {
      alert(error.message || "Image upload failed");
    } finally {
      setUploadingImages(false);
    }
  }

  async function useAsLogo(url) {
    if (!session) return;
    const { error } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      logo_url: url,
      updated_at: new Date().toISOString(),
    });
    if (error) return alert(error.message);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("profile-updated"));
    alert("Set as logo.");
  }

  async function deleteFile(name) {
    if (!session) return;
    const ok = confirm(`Delete "${name}"? This cannot be undone.`);
    if (!ok) return;
    const path = `${prefix}${name}`; // path relative to bucket root
    const { error } = await supabase.storage.from("assets").remove([path]);
    if (error) return alert(error.message);
    // Refresh list
    await listFiles(prefix);
  }

  if (!session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0b0b0b",
          color: "#eaeaea",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p>Please log in.</p>
      </div>
    );
  }

  return (
    <main style={{ padding: "20px 16px", maxWidth: 1302, width: "100%", margin: "0 auto" }}>
      <div
        style={{
          background: "#2563eb",
          borderRadius: 16,
          padding: "22px 28px",
          margin: "16px auto 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.18)",
              borderRadius: "50%",
              width: 72,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 34,
            }}
          >
            🖼️
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 48, fontWeight: 600, color: "#fff", lineHeight: 1.1 }}>
              Media Library
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 18, color: "rgba(255,255,255,0.9)" }}>
              Shared logos and website images for Funnels and Website Builder.
            </p>
          </div>
        </div>

        <button
          onClick={() => router.back()}
          style={{
            background: "rgba(0,0,0,0.3)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: 10,
            padding: "10px 22px",
            fontSize: 18,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ← Back
        </button>
      </div>

      <p style={{ color: "#94a3b8", marginTop: 0 }}>
        Uploads go to <code>/{prefix}filename.ext</code>. Public read is enabled.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 12 }}>
        <label style={uploadCard}>
          <div style={uploadTitle}>Upload Logo</div>
          <div style={uploadHint}>Best for brand header/logo files</div>
          <input type="file" accept="image/*" onChange={onUploadLogo} disabled={uploadingLogo} />
          <div style={uploadState}>{uploadingLogo ? "Uploading logo..." : "PNG, JPG, SVG, WEBP"}</div>
        </label>

        <label style={uploadCard}>
          <div style={uploadTitle}>Upload Website Images</div>
          <div style={uploadHint}>Hero images, section photos, product shots</div>
          <input type="file" accept="image/*" multiple onChange={onUploadWebsiteImages} disabled={uploadingImages} />
          <div style={uploadState}>{uploadingImages ? "Uploading images..." : "Select one or more images"}</div>
        </label>
      </div>

      <div style={{ height: 12 }} />

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {files.map((f) => {
            const url = publicUrl(f.name);
            return (
              <div
                key={f.name}
                style={{
                  background: "#151515",
                  border: "1px solid #222",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    height: 160,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0f0f0f",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <img src={url} alt={f.name} style={{ maxWidth: "100%", maxHeight: "100%" }} />
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "#aaa",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {f.name}
                </div>
                <input
                  readOnly
                  value={url}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #333",
                    background: "#0f0f0f",
                    color: "#eaeaea",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                  <button
                    onClick={() => navigator.clipboard?.writeText(url)}
                    style={miniBtn}
                    title="Copy public URL"
                  >
                    Copy URL
                  </button>
                  <button
                    onClick={() => useAsLogo(url)}
                    style={{ ...miniBtn, background: "#2d6cdf", border: "none", color: "#fff" }}
                    title="Set this image as your logo"
                  >
                    Set as logo
                  </button>
                  <button
                    onClick={() => deleteFile(f.name)}
                    style={{
                      ...miniBtn,
                      background: "#3a0f12",
                      border: "1px solid #5b1a1f",
                      color: "#ffd7db",
                    }}
                    title="Delete this image"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          {files.length === 0 ? <p>No assets yet.</p> : null}
        </div>
      )}
    </main>
  );
}

const miniBtn = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#222",
  color: "#eaeaea",
  cursor: "pointer",
  fontSize: 12,
};

const uploadCard = {
  background: "#151515",
  border: "1px solid #252525",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 8,
};

const uploadTitle = {
  color: "#eaeaea",
  fontSize: 16,
  fontWeight: 700,
};

const uploadHint = {
  color: "#9ca3af",
  fontSize: 13,
};

const uploadState = {
  color: "#94a3b8",
  fontSize: 12,
};
