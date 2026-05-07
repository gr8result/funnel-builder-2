// components/email/editor2/ImageEditModal.jsx
// Crop + Remove Background modal for the email editor
import { useState, useRef } from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { supabase } from "../../../utils/supabase-client";

function buildCanvasFromImage(image) {
  if (!image) throw new Error("Image not ready");
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(image, 0, 0);
  return canvas;
}

function removeBackgroundLocallyFromCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const px = imageData.data;
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 60));
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let samples = 0;

  const samplePixel = (x, y) => {
    const idx = ((y * width) + x) * 4;
    if ((px[idx + 3] || 0) < 8) return;
    totalR += px[idx];
    totalG += px[idx + 1];
    totalB += px[idx + 2];
    samples += 1;
  };

  for (let x = 0; x < width; x += sampleStep) {
    samplePixel(x, 0);
    samplePixel(x, height - 1);
  }
  for (let y = 0; y < height; y += sampleStep) {
    samplePixel(0, y);
    samplePixel(width - 1, y);
  }

  const bgR = samples ? totalR / samples : 255;
  const bgG = samples ? totalG / samples : 255;
  const bgB = samples ? totalB / samples : 255;
  const hardThreshold = 54;
  const softThreshold = 96;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const colorDistance = (idx) => {
    const dr = px[idx] - bgR;
    const dg = px[idx + 1] - bgG;
    const db = px[idx + 2] - bgB;
    return Math.sqrt((dr * dr) + (dg * dg) + (db * db));
  };

  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixelIndex = (y * width) + x;
    if (visited[pixelIndex]) return;
    const idx = pixelIndex * 4;
    if ((px[idx + 3] || 0) < 8) {
      visited[pixelIndex] = 1;
      return;
    }
    if (colorDistance(idx) > hardThreshold) return;
    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queue.length) {
    const pixelIndex = queue.shift();
    const idx = pixelIndex * 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    px[idx + 3] = 0;
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width) + x;
      const idx = pixelIndex * 4;
      const alpha = px[idx + 3] || 0;
      if (!alpha) continue;
      const distance = colorDistance(idx);
      if (distance > softThreshold) continue;

      const touchesTransparent =
        (x > 0 && px[idx - 1] === 0) ||
        (x + 1 < width && px[idx + 7] === 0) ||
        (y > 0 && px[idx - (width * 4) + 3] === 0) ||
        (y + 1 < height && px[idx + (width * 4) + 3] === 0);

      if (!touchesTransparent) continue;

      const fade = Math.max(0, Math.min(1, (distance - hardThreshold) / (softThreshold - hardThreshold)));
      px[idx + 3] = Math.max(0, Math.min(alpha, Math.round(alpha * fade)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export default function ImageEditModal({ src, userId, onDone, onCancel }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [crop, setCrop] = useState(undefined);
  const [completedCrop, setCompletedCrop] = useState(null);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState(null);
  const imgRef = useRef(null);

  function showStatus(msg, type = "ok") {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 4000);
  }

  function finishEdit(nextSrc = currentSrc) {
    const clean = String(nextSrc || "").replace(/\?t=\d+$/, "");
    if (clean) onDone(clean);
  }

  async function persistBase64Image(base64, filename = "edited.png") {
    if (!userId || !String(base64 || "").startsWith("data:")) return base64;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || "";
    if (!token) return base64;
    const resp = await fetch("/api/social/save-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ imageUrl: base64, description: filename }),
    });
    const out = await resp.json().catch(() => ({}));
    return out?.image?.url || base64;
  }

  function handleImageLoad(e) {
    const width = e.currentTarget.width || e.currentTarget.naturalWidth || 0;
    const height = e.currentTarget.height || e.currentTarget.naturalHeight || 0;
    if (!width || !height) return;

    const nextCrop = {
      unit: "px",
      x: Math.max(0, Math.round(width * 0.05)),
      y: Math.max(0, Math.round(height * 0.05)),
      width: Math.max(40, Math.round(width * 0.9)),
      height: Math.max(40, Math.round(height * 0.9)),
    };

    setCrop((prev) => prev || nextCrop);
    setCompletedCrop((prev) => prev || nextCrop);
  }

  async function handleRemoveBg() {
    if (!currentSrc || working) return;
    setWorking(true);
    showStatus("Removing background...", "ok");
    try {
      let data = null;
      let lastError = "";

      try {
        const byUrl = await fetch("/api/assets/remove-bg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: currentSrc, userId: userId || undefined }),
        });
        const byUrlData = await byUrl.json().catch(() => ({}));
        if (byUrl.ok && byUrlData?.publicUrl) {
          data = byUrlData;
        } else {
          lastError = byUrlData?.error || "Remove BG failed";
        }
      } catch (networkErr) {
        lastError = networkErr?.message || "Could not reach the Remove BG API";
      }

      if (!data) {
        try {
          const img = imgRef.current;
          if (!img) throw new Error("Image not ready");
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas not available");
          ctx.drawImage(img, 0, 0);
          const base64 = canvas.toDataURL("image/png");

          const byBase64 = await fetch("/api/assets/remove-bg", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64, userId: userId || undefined }),
          });
          const byBase64Data = await byBase64.json().catch(() => ({}));
          if (byBase64.ok && byBase64Data?.publicUrl) {
            data = byBase64Data;
          } else {
            lastError = byBase64Data?.error || lastError;
          }
        } catch (innerErr) {
          lastError = innerErr?.message || lastError;
        }
      }

      if (data?.publicUrl) {
        const nextSrc = data.publicUrl + "?t=" + Date.now();
        setCurrentSrc(nextSrc);
        setCrop(undefined);
        setCompletedCrop(null);
        showStatus("Background removed!", "ok");
        finishEdit(nextSrc);
        return;
      }

      const localCleaned = removeBackgroundLocallyFromCanvas(buildCanvasFromImage(imgRef.current));
      const persistedLocalCleaned = await persistBase64Image(localCleaned, "removed-bg-local.png");
      setCurrentSrc(persistedLocalCleaned);
      setCrop(undefined);
      setCompletedCrop(null);
      showStatus(lastError && lastError.includes("REMOVEBG_API_KEY") ? "Remove BG API key is not configured. Used local edge cleanup instead." : "Background cleaned up locally.", "ok");
      finishEdit(persistedLocalCleaned);
    } catch (err) {
      showStatus(err?.message || "Background removal is unavailable for this image right now.", "err");
    } finally {
      setWorking(false);
    }
  }

  async function handleApplyCrop() {
    if (!imgRef.current || working) return;
    const activeCrop = completedCrop || crop;
    if (!activeCrop || activeCrop.width < 2 || activeCrop.height < 2) {
      showStatus("Draw a crop area on the image first", "err");
      return;
    }
    setWorking(true);
    showStatus("Applying crop...", "ok");
    try {
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;
      const cw = Math.round(activeCrop.width * scaleX);
      const ch = Math.round(activeCrop.height * scaleY);
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not available");
      ctx.drawImage(
        img,
        Math.round(activeCrop.x * scaleX),
        Math.round(activeCrop.y * scaleY),
        cw, ch,
        0, 0, cw, ch
      );
      const base64 = canvas.toDataURL("image/png");

      const nextSrc = await persistBase64Image(base64, "cropped.png");

      setCurrentSrc(nextSrc);
      setCrop(undefined);
      setCompletedCrop(null);
      showStatus("Crop applied!", "ok");
      finishEdit(nextSrc);
    } catch (err) {
      showStatus(err?.message || "Crop failed", "err");
    } finally {
      setWorking(false);
    }
  }

  function handleDone() {
    finishEdit(currentSrc);
  }

  return (
    <div
      data-image-edit-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Inter,system-ui,Arial,sans-serif",
        color: "#ffffff",
        fontSize: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <style>{`
        [data-image-edit-modal="true"] * {
          color: #ffffff;
        }

        [data-image-edit-modal="true"] div,
        [data-image-edit-modal="true"] span,
        [data-image-edit-modal="true"] p,
        [data-image-edit-modal="true"] label,
        [data-image-edit-modal="true"] button,
        [data-image-edit-modal="true"] input,
        [data-image-edit-modal="true"] strong {
          font-size: max(16px, 1rem);
        }

        [data-image-edit-modal="true"] button {
          font-weight: 800;
        }

        [data-image-edit-modal="true"] .ReactCrop,
        [data-image-edit-modal="true"] .ReactCrop * {
          color: #ffffff;
          font-size: 16px;
        }
      `}</style>
      <div style={{
        background: "#0f172a", borderRadius: 14,
        border: "2px solid rgba(125,211,252,0.32)",
        boxShadow: "0 24px 70px rgba(0,0,0,0.65)",
        display: "flex", flexDirection: "column",
        maxWidth: "92vw", maxHeight: "92vh",
        minWidth: 560, overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid #1e293b", flexShrink: 0,
        }}>
          <span style={{ fontWeight: 800, fontSize: 20, color: "#ffffff", letterSpacing: "0.01em" }}>Edit Image</span>
          <button
            onClick={onCancel}
            style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer", fontSize: 26, fontWeight: 700, lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <div style={{
            flex: 1, overflow: "auto", padding: 20,
            background: "#1e293b",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {currentSrc ? (
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={c => setCompletedCrop(c && c.width > 1 && c.height > 1 ? c : null)}
                style={{ maxWidth: "100%" }}
              >
                <img
                  ref={imgRef}
                  src={currentSrc}
                  crossOrigin="anonymous"
                  alt="Edit"
                  onLoad={handleImageLoad}
                  style={{ maxWidth: "100%", maxHeight: "65vh", display: "block", borderRadius: 4 }}
                />
              </ReactCrop>
            ) : (
              <div style={{ color: "#ffffff", fontSize: 16, fontWeight: 600 }}>No image</div>
            )}
          </div>

          <div style={{
            width: 300, flexShrink: 0, padding: 22,
            display: "flex", flexDirection: "column", gap: 10,
            background: "#0f172a", borderLeft: "1px solid #1e293b",
          }}>
            {status && (
              <div style={{
                padding: "12px 14px", borderRadius: 10, fontSize: 16, fontWeight: 700,
                background: status.type === "err" ? "#7f1d1d" : "#14532d",
                color: "#ffffff",
                lineHeight: 1.4,
              }}>
                {status.msg}
              </div>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", lineHeight: 1.2 }}>
                Crop
              </div>
              <div style={{ fontSize: 16, color: "#ffffff", lineHeight: 1.5 }}>
                A crop area is already selected. Drag the handles if you want, then click <strong style={{ color: "#ffffff", fontWeight: 800 }}>Apply Crop</strong>.
              </div>
            </div>

            <ABtn
              onClick={handleApplyCrop}
              disabled={working || !completedCrop}
              color="#6d28d9"
            >
              Apply Crop
            </ABtn>

            <div style={{ borderTop: "1px solid #1e293b", margin: "4px 0" }} />

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", lineHeight: 1.2 }}>
                Background Removal
              </div>
              <div style={{ fontSize: 16, color: "#ffffff", lineHeight: 1.5 }}>
                Automatically remove the image background using the configured API. If the key is missing, the editor will fall back to a very basic local cleanup.
              </div>
            </div>

            <ABtn
              onClick={handleRemoveBg}
              disabled={working || !currentSrc}
              color="#0e7490"
            >
              {working ? "Working..." : "Remove BG"}
            </ABtn>

            <div style={{ flex: 1 }} />

            <ABtn onClick={handleDone} disabled={working} color="#16a34a">
              Done
            </ABtn>

            <ABtn onClick={onCancel} disabled={working} color="#334155">
              Cancel
            </ABtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function ABtn({ onClick, children, color = "#334155", disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        minHeight: 48,
        border: "none",
        borderRadius: 8,
        background: disabled ? "#1e293b" : color,
        color: "#ffffff",
        fontSize: 16,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "12px 14px",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  );
}
