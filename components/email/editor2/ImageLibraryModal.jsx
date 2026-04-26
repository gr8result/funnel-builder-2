// components/email/editor2/ImageLibraryModal.jsx
// Image library picker — lists all email-user-assets images for the user
import { useState, useEffect, useRef } from "react";

export default function ImageLibraryModal({ userId, onPick, onClose }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  async function loadImages() {
    if (!userId) {
      setImages([]);
      setError("No saved library is available yet for this session. Upload an image to use it now.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/email/editor-images?userId=${encodeURIComponent(userId)}`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed to load");
      setImages((j.urls || []).slice().reverse()); // newest first
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadImages(); }, [userId]);

  async function handleUpload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      if (!userId) {
        onPick?.(base64);
        onClose?.();
        return;
      }

      const resp = await fetch(
        `/api/email/editor-images?userId=${encodeURIComponent(userId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, filename: file.name, base64 }),
        }
      );
      const out = await resp.json();
      if (!out.ok) throw new Error(out.error || "Upload failed");
      await loadImages();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(url) {
    if (!window.confirm("Delete this image from your library?")) return;
    try {
      const resp = await fetch(
        `/api/email/editor-images?userId=${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, url }),
        }
      );
      const out = await resp.json();
      if (!out.ok) throw new Error(out.error || "Delete failed");
      setImages(prev => prev.filter(u => u !== url));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.82)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Inter,system-ui,Arial,sans-serif",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#0f172a", borderRadius: 14,
        boxShadow: "0 24px 70px rgba(0,0,0,0.65)",
        display: "flex", flexDirection: "column",
        width: "min(860px, 94vw)", maxHeight: "88vh",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid #1e293b", flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>🖼️ Image Library</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                padding: "7px 16px", background: "#2563eb", color: "#fff",
                border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700,
                cursor: "pointer", opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? "Uploading…" : "⬆ Upload Image"}
            </button>
            <input
              ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handleUpload(f); }}
            />
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 0 }}
            >✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {error && (
            <div style={{ background: "#7f1d1d", color: "#fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{ color: "#64748b", textAlign: "center", padding: 60, fontSize: 15 }}>Loading…</div>
          )}

          {!loading && images.length === 0 && (
            <div style={{ color: "#475569", textAlign: "center", padding: 60, fontSize: 15 }}>
              No saved images yet. Upload one above to use it now.
            </div>
          )}

          {!loading && images.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
            }}>
              {images.map((url, i) => (
                <ImgTile key={i} url={url} onPick={() => onPick(url)} onDelete={() => handleDelete(url)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImgTile({ url, onPick, onDelete }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative", borderRadius: 8, overflow: "hidden",
        border: hov ? "2px solid #2563eb" : "2px solid #1e293b",
        cursor: "pointer", aspectRatio: "1",
        background: "#1e293b",
        transition: "border-color 0.15s",
      }}
    >
      <img
        src={url}
        alt=""
        onClick={onPick}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {hov && (
        <>
          <div
            onClick={onPick}
            style={{
              position: "absolute", inset: 0,
              background: "rgba(37,99,235,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, color: "#fff", fontWeight: 700,
              pointerEvents: "none",
            }}
          >
            ＋
          </div>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            title="Delete image"
            style={{
              position: "absolute", top: 6, right: 6,
              background: "rgba(220,38,38,0.9)",
              border: "none", borderRadius: 6,
              color: "#fff", fontSize: 14, fontWeight: 700,
              width: 28, height: 28, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
          >
            🗑
          </button>
        </>
      )}
    </div>
  );
}
