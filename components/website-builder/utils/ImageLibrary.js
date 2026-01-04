// /components/website-builder/utils/ImageLibrary.js
// FULL REPLACEMENT — NOT empty anymore
// ✅ Standard library (Office/Nature/Cars/Fitness/Home/Travel/etc) using reliable picsum seed URLs (no API key)
// ✅ "Your images" supports local upload (stored in localStorage) + drag into canvas
// ✅ Click thumbnail to insert Image block (sidebar handles onPickImage)

import { useEffect, useMemo, useState } from "react";

const LS_KEY = "gr8_builder_user_images_v1";

export default function ImageLibrary({ onDragImage, onPickImage }) {
  const categories = useMemo(
    () => [
      { key: "office", label: "Office" },
      { key: "nature", label: "Nature" },
      { key: "cars", label: "Cars" },
      { key: "fitness", label: "Fitness" },
      { key: "home", label: "Home" },
      { key: "travel", label: "Travel" },
      { key: "food", label: "Food" },
      { key: "tech", label: "Tech" },
      { key: "fashion", label: "Fashion" },
    ],
    []
  );

  const [tab, setTab] = useState("standard"); // standard | yours
  const [cat, setCat] = useState("office");
  const [yours, setYours] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setYours(Array.isArray(arr) ? arr : []);
    } catch {
      setYours([]);
    }
  }, []);

  function saveYours(next) {
    setYours(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next.slice(0, 60)));
    } catch {}
  }

  const thumbs = useMemo(() => {
    // Picsum is consistent + fast. We use category-key in seed so it feels “categorised”.
    // (You can swap to your own CDN later.)
    const make = (i) => `https://picsum.photos/seed/gr8_${cat}_${i + 1}/900/600`;
    return new Array(14).fill(0).map((_, i) => make(i));
  }, [cat]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const dataUrl = await fileToDataUrl(file);
    const next = [dataUrl, ...yours].slice(0, 60);
    saveYours(next);
    e.target.value = "";
  }

  function removeUserImg(idx) {
    const next = yours.filter((_, i) => i !== idx);
    saveYours(next);
  }

  return (
    <div>
      <div style={styles.headerRow}>
        <div style={styles.panelTitle}>Image Library</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...styles.tabBtn, ...(tab === "standard" ? styles.tabOn : {}) }} onClick={() => setTab("standard")}>
            Standard
          </button>
          <button style={{ ...styles.tabBtn, ...(tab === "yours" ? styles.tabOn : {}) }} onClick={() => setTab("yours")}>
            Your images
          </button>
        </div>
      </div>

      {tab === "standard" ? (
        <>
          <div style={styles.catsRow}>
            {categories.map((c) => (
              <button
                key={c.key}
                style={{ ...styles.catBtn, ...(cat === c.key ? styles.catOn : {}) }}
                onClick={() => setCat(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div style={styles.grid}>
            {thumbs.map((url, i) => (
              <Thumb
                key={i}
                url={url}
                onPick={onPickImage}
                onDrag={onDragImage}
              />
            ))}
          </div>

          <div style={styles.hint}>Drag into canvas to place exactly where you want.</div>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={styles.upload}>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} />
              + Upload image
            </label>

            {yours.length === 0 ? (
              <div style={styles.hint}>Upload images here — they’ll appear instantly and be draggable.</div>
            ) : (
              <div style={styles.grid}>
                {yours.map((url, i) => (
                  <div key={i} style={styles.userWrap}>
                    <Thumb url={url} onPick={onPickImage} onDrag={onDragImage} />
                    <button style={styles.remove} onClick={() => removeUserImg(i)} title="Remove">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Thumb({ url, onPick, onDrag }) {
  return (
    <div
      style={styles.thumb}
      draggable
      onDragStart={(e) => {
        // set multiple types for browser compatibility
        try {
          e.dataTransfer.setData("text/plain", url);
        } catch {}
        onDrag?.(url, e);
      }}
      onClick={() => onPick?.(url)}
      title="Drag into canvas or click to add"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
    </div>
  );
}

function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || ""));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

const styles = {
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 },
  panelTitle: { color: "white", fontWeight: 950 },

  tabBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.85)",
    padding: "8px 10px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
  },
  tabOn: { background: "rgba(34,151,197,0.22)", border: "1px solid rgba(34,151,197,0.55)", color: "white" },

  catsRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 },
  catBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.85)",
    padding: "8px 10px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
  },
  catOn: { background: "rgba(34,151,197,0.22)", border: "1px solid rgba(34,151,197,0.55)", color: "white" },

  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  thumb: {
    width: "100%",
    height: 110,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
    cursor: "grab",
  },

  hint: { marginTop: 10, color: "rgba(255,255,255,0.65)", fontWeight: 800, fontSize: 13 },

  upload: {
    width: "100%",
    textAlign: "center",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "white",
    padding: "10px 12px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 950,
  },

  userWrap: { position: "relative" },
  remove: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 10,
    background: "rgba(244,63,94,0.20)",
    border: "1px solid rgba(244,63,94,0.35)",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  },
};
