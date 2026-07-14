// components/email/editor2/ImageLibraryModal.jsx
// Image library picker — combines the shared media library with legacy email-only images.
import { useState, useEffect, useRef } from "react";
import { emailEditorFetch } from "./emailEditorApi";

export default function ImageLibraryModal({ userId, onPick, onClose }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [permissions, setPermissions] = useState({ canManageTemplateImages: false });
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
      const [sharedResponse, legacyResponse] = await Promise.all([
        emailEditorFetch("/api/assets/list-library", {}, {
          authErrorMessage: "Sign in required to view the image library.",
        }),
        emailEditorFetch(`/api/email/editor-images?userId=${encodeURIComponent(userId)}`, {}, {
          authErrorMessage: "Sign in required to view the image library.",
        }),
      ]);

      const sharedPayload = await sharedResponse.json().catch(() => ({}));
      const legacyPayload = await legacyResponse.json().catch(() => ({}));

      if (!sharedResponse.ok || !sharedPayload?.ok) {
        throw new Error(sharedPayload?.error || "Failed to load shared media library");
      }

      const sharedImages = Array.isArray(sharedPayload?.images)
        ? sharedPayload.images.map((image) => ({
            ...image,
            source: "shared",
          }))
        : [];
      const sharedUrls = new Set(sharedImages.map((image) => String(image?.url || "")).filter(Boolean));

      const legacyImages = Array.isArray(legacyPayload?.urls)
        ? legacyPayload.urls
            .filter(Boolean)
            .filter((url) => !sharedUrls.has(String(url || "").replace(/\?v=\d+$/, "")))
            .map((url, index) => ({
              id: `legacy-email:${index}:${url}`,
              url,
              name: `Legacy email image ${index + 1}`,
              description: "Legacy email-only image",
              owner_scope: "legacy-email",
              is_template: false,
              source: "legacy-email",
            }))
        : [];

      setImages([...sharedImages, ...legacyImages]);
      setPermissions(sharedPayload?.permissions || { canManageTemplateImages: false });
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

      const resp = await emailEditorFetch("/api/social/save-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: base64, description: file.name || "Uploaded image" }),
      }, {
        authErrorMessage: "Sign in required to upload images.",
      });
      const out = await resp.json();
      if (!resp.ok || !out?.ok) throw new Error(out?.error || "Upload failed");
      await loadImages();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(image) {
    if (!window.confirm("Delete this image from your library?")) return;
    try {
      let resp;

      if (image?.source === "legacy-email") {
        resp = await emailEditorFetch(`/api/email/editor-images?userId=${encodeURIComponent(userId)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, url: image.url }),
        }, {
          authErrorMessage: "Sign in required to delete images.",
        });
      } else {
        resp = await emailEditorFetch(`/api/social/delete-image?id=${encodeURIComponent(image.id)}`, {
          method: "DELETE",
        }, {
          authErrorMessage: "Sign in required to delete images.",
        });
      }

      const out = await resp.json();
      if (!out.ok) throw new Error(out.error || "Delete failed");
      setImages((prev) => prev.filter((entry) => entry.id !== image.id));
    } catch (e) {
      setError(e.message);
    }
  }

  const userImages = images.filter((image) => image?.owner_scope !== "generic");
  const genericImages = images.filter((image) => image?.owner_scope === "generic");

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
          <span style={{ fontWeight: 600, fontSize: 16, color: "#f1f5f9" }}>🖼️ Image Library</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                padding: "7px 16px", background: "#2563eb", color: "#fff",
                border: "none", borderRadius: 7, fontSize: 16, fontWeight: 600,
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
            <div style={{ background: "#7f1d1d", color: "#fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 16 }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{ color: "#64748b", textAlign: "center", padding: 60, fontSize: 16 }}>Loading…</div>
          )}

          {!loading && images.length === 0 && (
            <div style={{ color: "#475569", textAlign: "center", padding: 60, fontSize: 16 }}>
              No saved images yet. Upload one above to use it now.
            </div>
          )}

          {!loading && images.length > 0 ? (
            <div style={{ display: "grid", gap: 24 }}>
              <LibrarySection
                title="Your Images"
                subtitle="Your shared uploads, saved edits, and any legacy email-only images."
                items={userImages}
                onPick={onPick}
                onDelete={handleDelete}
                canDelete={(image) => !image?.is_template || permissions.canManageTemplateImages || image?.source === "legacy-email"}
              />
              <LibrarySection
                title="Generic Site Images"
                subtitle="Shared starter images available across websites, funnels, social, and email."
                items={genericImages}
                onPick={onPick}
                onDelete={handleDelete}
                canDelete={() => permissions.canManageTemplateImages}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LibrarySection({ title, subtitle, items, onPick, onDelete, canDelete }) {
  if (!items.length) return null;

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ fontSize: 18, color: "#f8fafc" }}>{title}</strong>
        <span style={{ fontSize: 16, lineHeight: 1.5, color: "#94a3b8" }}>{subtitle}</span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 12,
      }}>
        {items.map((image) => (
          <ImgTile
            key={image.id}
            image={image}
            onPick={() => onPick(image.url)}
            onDelete={() => onDelete(image)}
            canDelete={!!canDelete?.(image)}
          />
        ))}
      </div>
    </section>
  );
}

function ImgTile({ image, onPick, onDelete, canDelete = false }) {
  const [hov, setHov] = useState(false);
  const url = String(image?.url || "");
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
              fontSize: 28, color: "#fff", fontWeight: 600,
              pointerEvents: "none",
            }}
          >
            ＋
          </div>
          {canDelete ? (
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              title="Delete image"
              style={{
                position: "absolute", top: 6, right: 6,
                background: "rgba(220,38,38,0.9)",
                border: "none", borderRadius: 6,
                color: "#fff", fontSize: 16, fontWeight: 600,
                width: 28, height: 28, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                lineHeight: 1,
              }}
            >
              🗑
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
