// /components/email/editor/ImagePickerModal.js
// FULL REPLACEMENT — upload/select image -> returns public URL (uses /api/email/editor-images)

import { useEffect, useMemo, useRef, useState } from "react";

export default function ImagePickerModal({ open, onClose, userId, onPickUrl }) {
  const fileRef = useRef(null);
  const [tab, setTab] = useState("upload"); // upload | library
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [urls, setUrls] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const canShow = !!open;

  useEffect(() => {
    if (!canShow) return;
    setStatus("");
    setBusy(false);
    setTab("upload");
  }, [canShow]);

  useEffect(() => {
    if (!canShow) return;
    if (tab !== "library") return;

    let cancelled = false;
    async function load() {
      try {
        setBusy(true);
        setStatus("Loading library...");
        const q = new URLSearchParams();
        if (userId) q.set("userId", userId);

        const res = await fetch(`/api/email/editor-images?${q.toString()}`);
        const j = await res.json().catch(() => null);

        if (cancelled) return;
        const list = Array.isArray(j?.urls) ? j.urls : [];
        setUrls(list);
        setStatus(list.length ? "Select an image" : "No images yet");
      } catch (e) {
        if (!cancelled) setStatus("Failed to load library");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [canShow, tab, userId, refreshKey]);

  const dropText = useMemo(() => {
    if (!userId) return "Upload (userId missing)";
    return "Upload image";
  }, [userId]);

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function uploadFile(file) {
    if (!userId) {
      setStatus("Missing userId (login required)");
      return;
    }

    try {
      setBusy(true);
      setStatus("Uploading...");

      const dataUrl = await fileToDataUrl(file);
      const res = await fetch(`/api/email/editor-images?userId=${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          filename: file?.name || "image.png",
          base64: dataUrl,
        }),
      });

      const j = await res.json().catch(() => null);
      if (!j?.ok || !j?.url) {
        setStatus(j?.error || "Upload failed");
        return;
      }

      setStatus("Uploaded");
      onPickUrl?.(j.url);
      onClose?.();
    } catch (e) {
      setStatus("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    uploadFile(f);
  }

  function onPick(u) {
    if (!u) return;
    onPickUrl?.(u);
    onClose?.();
  }

  if (!canShow) return null;

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="top">
          <div className="t">Image</div>
          <button className="x" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === "upload" ? "on" : ""}`} onClick={() => setTab("upload")}>
            Upload
          </button>
          <button className={`tab ${tab === "library" ? "on" : ""}`} onClick={() => setTab("library")}>
            Library
          </button>
          <button className="ref" onClick={() => setRefreshKey((n) => n + 1)}>
            Refresh
          </button>
        </div>

        {tab === "upload" && (
          <div className="body">
            <div className="hint">Choose a file → it uploads to Supabase → inserts into your email.</div>

            <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: "none" }} />

            <button
              className="big"
              disabled={busy || !userId}
              onClick={() => fileRef.current && fileRef.current.click()}
            >
              {busy ? "Working..." : dropText}
            </button>

            <div className="status">{status}</div>
          </div>
        )}

        {tab === "library" && (
          <div className="body">
            <div className="hint">Click an image to insert it.</div>

            <div className="grid">
              {urls.map((u) => (
                <button key={u} className="imgBtn" onClick={() => onPick(u)} disabled={busy}>
                  <img src={u} alt="img" />
                </button>
              ))}
            </div>

            <div className="status">{status}</div>
          </div>
        )}
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: grid;
          place-items: center;
          z-index: 9999;
          padding: 18px;
        }
        .modal {
          width: min(860px, 96vw);
          background: #0b1120;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
        }
        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: rgba(2, 6, 23, 0.55);
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        }
        .t {
          font-size: 16px;
          font-weight: 900;
          color: #60a5fa;
        }
        .x {
          border: none;
          border-radius: 10px;
          padding: 8px 10px;
          cursor: pointer;
          background: rgba(148, 163, 184, 0.14);
          color: #fff;
          font-weight: 900;
        }
        .tabs {
          display: grid;
          grid-template-columns: 120px 120px 1fr;
          gap: 10px;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        }
        .tab,
        .ref {
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(2, 6, 23, 0.45);
          color: #fff;
          border-radius: 12px;
          padding: 10px 12px;
          cursor: pointer;
          font-weight: 900;
        }
        .tab.on {
          background: #22c55e;
          color: #0b1120;
          border-color: rgba(34, 197, 94, 0.45);
        }
        .ref {
          justify-self: end;
          width: 120px;
        }
        .body {
          padding: 14px;
        }
        .hint {
          font-size: 13px;
          opacity: 0.92;
          margin-bottom: 12px;
          line-height: 1.35;
        }
        .big {
          width: 100%;
          border: none;
          border-radius: 14px;
          padding: 14px 12px;
          font-weight: 900;
          cursor: pointer;
          background: #3b82f6;
          color: #fff;
          font-size: 16px;
        }
        .big:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .status {
          margin-top: 10px;
          font-size: 13px;
          opacity: 0.9;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
          margin-top: 10px;
          max-height: 420px;
          overflow: auto;
          padding-right: 6px;
        }
        .imgBtn {
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(2, 6, 23, 0.45);
          border-radius: 14px;
          padding: 8px;
          cursor: pointer;
        }
        .imgBtn img {
          width: 100%;
          height: 110px;
          object-fit: cover;
          border-radius: 10px;
          display: block;
        }
        @media (max-width: 860px) {
          .grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
