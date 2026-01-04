// pages/assets.js
// File uploader + file list under /assets bucket at /<userId>/.
// Content-only: Layout (with SideNav + TopNav) is applied globally in _app.js.

import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase-client";

export default function Assets() {
  const [session, setSession] = useState(null);
  const [prefix, setPrefix] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
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

  async function onUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setUploading(true);
    const path = `${session.user.id}/${file.name}`;
    const { error } = await supabase.storage.from("assets").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) return alert(error.message);
    await listFiles(prefix);
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
    <main style={{ padding: "20px 16px", maxWidth: 1000, width: "100%", margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>Assets</h2>
      <p style={{ color: "#aaa" }}>
        Uploads go to <code>/{prefix}filename.ext</code>. Public read is enabled.
      </p>

      <input type="file" onChange={onUpload} disabled={uploading} />
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
