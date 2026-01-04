// ============================================
// /components/email/ImageLibrary.js
// Builder image library UI
// FULL REPLACEMENT
// ============================================

import { useEffect, useState } from "react";

export default function ImageLibrary({ userId, selectedBlockId, onPickImage }) {
  const [loading, setLoading] = useState(false);
  const [urls, setUrls] = useState([]);
  const [err, setErr] = useState("");

  async function refresh() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`/api/email/editor-images?userId=${encodeURIComponent(userId || "public")}`);
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.detail || j?.error || "Failed to load images");
      setUrls(Array.isArray(j.urls) ? j.urls : []);
    } catch (e) {
      setErr(e?.message || "Failed to load images");
      setUrls([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function upload(file) {
    setLoading(true);
    setErr("");
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const r = await fetch("/api/email/editor-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId || "public", filename: file.name, base64 }),
      });

      const j = await r.json();
      if (!j?.ok) throw new Error(j?.detail || j?.error || "Upload failed");
      await refresh();
    } catch (e) {
      setErr(e?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  const styles = {
    title: { fontWeight: 900, marginTop: 14, marginBottom: 8, color: "#22c55e" },
    note: { fontSize: 12, opacity: 0.85, marginBottom: 10 },
    btn: {
      width: "100%",
      border: "1px solid rgba(255,255,255,.12)",
      background: "rgba(0,0,0,.25)",
      color: "#e5e7eb",
      padding: "10px 12px",
      borderRadius: 10,
      cursor: "pointer",
      fontWeight: 900,
      marginBottom: 10,
    },
    grid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 },
    tile: {
      border: "1px solid rgba(255,255,255,.10)",
      borderRadius: 12,
      overflow: "hidden",
      background: "rgba(0,0,0,.25)",
      cursor: "pointer",
    },
    img: { width: "100%", height: 90, objectFit: "cover", display: "block" },
    err: { color: "#f87171", fontSize: 12, marginTop: 8, whiteSpace: "pre-wrap" },
  };

  return (
    <div>
      <div style={styles.title}>Image Library</div>
      <div style={styles.note}>Upload → click image to insert.</div>

      <label style={styles.btn}>
        + Upload images
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </label>

      <button style={styles.btn} onClick={refresh} disabled={loading}>
        {loading ? "Loading..." : "Refresh"}
      </button>

      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>{urls.length} images</div>
      {err ? <div style={styles.err}>{err}</div> : null}

      <div style={styles.grid}>
        {urls.map((u) => (
          <div
            key={u}
            style={styles.tile}
            onClick={() => {
              if (!selectedBlockId) return alert("Select a HERO or IMAGE block first.");
              onPickImage(u);
            }}
            title="Click to insert"
          >
            <img src={u} alt="" style={styles.img} />
          </div>
        ))}
      </div>
    </div>
  );
}
