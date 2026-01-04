// ============================================
// /components/email/editor/ImageToolsPanel.js
// FULL REPLACEMENT — Canva-style Image Tools + 2-column Image Library grid
// NOTE: This panel expects a GrapesJS-like `editor` instance.
// ============================================

import { useEffect, useState } from "react";

const CUSTOM_COLOURS_KEY = "gr8:editor:customColours:v1";

export default function ImageToolsPanel({ editor, images }) {
  const [selectedImage, setSelectedImage] = useState(null);

  const [fadeSide, setFadeSide] = useState("right");
  const [fadeStrength, setFadeStrength] = useState(40);

  const [bgRemoved, setBgRemoved] = useState(false);

  const [overlayMode, setOverlayMode] = useState("normal");
  const [zIndex, setZIndex] = useState(0);

  const [crop, setCrop] = useState({ top: 0, right: 0, bottom: 0, left: 0 });

  const [opacity, setOpacity] = useState(100);
  const [radius, setRadius] = useState(6);

  const [open, setOpen] = useState(false);

  const [customColourInput, setCustomColourInput] = useState("#000000");
  const [customColours, setCustomColours] = useState([]);

  // Load custom colours
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CUSTOM_COLOURS_KEY);
      if (raw) setCustomColours(JSON.parse(raw));
    } catch (e) {
      console.warn("Could not load custom colours", e);
    }
  }, []);

  const persistCustomColours = (cols) => {
    setCustomColours(cols);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CUSTOM_COLOURS_KEY, JSON.stringify(cols));
    } catch (e) {
      console.warn("Could not persist custom colours", e);
    }
  };

  const addCustomColour = () => {
    const v = (customColourInput || "").trim();
    if (!v) return;
    if (customColours.includes(v)) return;
    const next = [...customColours, v];
    persistCustomColours(next);
  };

  const extractZ = (styles) => {
    const raw = styles.zIndex ?? styles["z-index"] ?? 0;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : n;
  };

  const extractOpacity = (styles) => {
    if (styles.opacity == null) return 1;
    const v = parseFloat(styles.opacity);
    return Number.isNaN(v) ? 1 : v;
  };

  const extractRadius = (styles) => {
    const v = styles.borderRadius || styles["border-radius"] || 0;
    if (typeof v === "number") return v;
    if (typeof v !== "string") return 0;
    const m = v.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  };

  const parseClipPath = (styles) => {
    const cp = styles.clipPath || styles["clip-path"] || "";
    const m =
      cp &&
      cp.match(
        /inset\(\s*([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s*\)/
      );
    if (!m) return { top: 0, right: 0, bottom: 0, left: 0 };
    return {
      top: parseFloat(m[1]) || 0,
      right: parseFloat(m[2]) || 0,
      bottom: parseFloat(m[3]) || 0,
      left: parseFloat(m[4]) || 0,
    };
  };

  const buildClipPath = (c) =>
    `inset(${c.top}% ${c.right}% ${c.bottom}% ${c.left}%)`;

  useEffect(() => {
    if (!editor) return;

    const onSelected = (cmpRaw) => {
      const cmp = cmpRaw && cmpRaw.get ? cmpRaw : null;
      if (!cmp) {
        setSelectedImage(null);
        setOpen(false);
        return;
      }

      const tag = (cmp.get("tagName") || "").toString().toLowerCase();

      if (tag === "img") {
        setSelectedImage(cmp);
        setOpen(true);

        const style = cmp.getStyle ? cmp.getStyle() || {} : {};

        const mask = style.WebkitMaskImage || style.maskImage || "";
        const fadeMatch = mask.match(/(\d+)%\)/);
        if (fadeMatch) setFadeStrength(Number(fadeMatch[1]));
        const sideMatch = mask.match(/to\s+(left|right)/);
        if (sideMatch) setFadeSide(sideMatch[1]);

        setBgRemoved((style.mixBlendMode || "") === "multiply");

        const z = extractZ(style);
        setZIndex(z);

        if (style.position === "absolute") setOverlayMode("overlay");
        else setOverlayMode("normal");

        const cp = parseClipPath(style);
        setCrop(cp);

        const op = extractOpacity(style);
        setOpacity(Math.round(op * 100));
        setRadius(extractRadius(style));
      } else {
        setSelectedImage(null);
        setOpen(false);
      }
    };

    const onCanvasClick = (data) => {
      const cmp =
        data && data.component ? data.component : data && data.get ? data : null;
      if (!cmp) {
        setSelectedImage(null);
        setOpen(false);
      }
    };

    editor.on("component:selected", onSelected);
    editor.on("canvas:click", onCanvasClick);

    return () => {
      editor.off("component:selected", onSelected);
      editor.off("canvas:click", onCanvasClick);
    };
  }, [editor]);

  const updateImageStyle = (partial) => {
    if (!selectedImage) return;
    const current = selectedImage.getStyle ? selectedImage.getStyle() || {} : {};
    if (selectedImage.setStyle) selectedImage.setStyle({ ...current, ...partial });
    editor?.trigger?.("change:canvas");
  };

  const handleAlign = (align) => {
    if (!selectedImage) return;
    if (align === "left") {
      updateImageStyle({ display: "block", marginLeft: "0", marginRight: "auto" });
    }
    if (align === "center") {
      updateImageStyle({
        display: "block",
        marginLeft: "auto",
        marginRight: "auto",
      });
    }
    if (align === "right") {
      updateImageStyle({ display: "block", marginLeft: "auto", marginRight: "0" });
    }
  };

  const handleToggleBgRemove = () => {
    if (!selectedImage) return;
    const next = !bgRemoved;
    setBgRemoved(next);
    updateImageStyle({
      mixBlendMode: next ? "multiply" : "normal",
      backgroundColor: "transparent",
    });
  };

  const handleFadeChange = (side, strength) => {
    if (!selectedImage) {
      setFadeSide(side);
      setFadeStrength(strength);
      return;
    }

    const dir = side === "left" ? "to right" : "to left";
    const pct = Math.max(0, Math.min(100, strength));

    const mask = `linear-gradient(${dir}, transparent 0%, black ${pct}%)`;

    setFadeSide(side);
    setFadeStrength(pct);

    updateImageStyle({
      WebkitMaskImage: mask,
      maskImage: mask,
    });
  };

  const handleOpacityChange = (v) => {
    const pct = Math.max(0, Math.min(100, Number(v) || 0));
    setOpacity(pct);
    updateImageStyle({ opacity: pct / 100 });
  };

  const handleRadiusChange = (v) => {
    const r = Math.max(0, Math.min(60, Number(v) || 0));
    setRadius(r);
    updateImageStyle({ borderRadius: `${r}px` });
  };

  const handleCropChange = (edge, value) => {
    const v = Math.max(0, Math.min(60, Number(value) || 0));
    const next = { ...crop, [edge]: v };
    setCrop(next);
    const cp = buildClipPath(next);
    updateImageStyle({ clipPath: cp, WebkitClipPath: cp });
  };

  const handleOverlayToggle = (mode) => {
    if (!selectedImage) {
      setOverlayMode(mode);
      return;
    }

    const parent =
      selectedImage.parent && typeof selectedImage.parent === "function"
        ? selectedImage.parent()
        : null;

    if (mode === "overlay") {
      if (parent && parent.addStyle) parent.addStyle({ position: "relative" });
      updateImageStyle({
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      });
      setOverlayMode("overlay");
    } else {
      updateImageStyle({
        position: "static",
        left: "auto",
        top: "auto",
        transform: "none",
      });
      setOverlayMode("normal");
    }
  };

  const adjustZ = (delta) => {
    const next = Math.max(0, zIndex + delta);
    setZIndex(next);
    updateImageStyle({ zIndex: next });
  };

  const applyFrameColour = (col) => {
    if (!selectedImage) return;
    updateImageStyle({
      boxShadow: `0 0 0 4px ${col}`,
      borderRadius: `${radius || 6}px`,
    });
  };

  const handleInsertImage = (url) => {
    if (!editor || !url) return;
    const sel = editor.getSelected && editor.getSelected();

    if (sel && sel.get && sel.get("tagName") === "img") {
      sel.addAttributes({ src: url });
    } else {
      const wrapper = editor.getWrapper();
      wrapper.append(
        `<img src="${url}" style="display:block;margin:0 auto;max-width:100%;border-radius:6px;" />`
      );
    }
  };

  const sectionTitleStyle = {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#9ca3af",
    marginBottom: 8,
  };

  const pillBase = {
    fontSize: 18,
    borderRadius: 999,
    padding: "6px 12px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(27, 64, 151, 0.9)",
    color: "#f9fafb",
    cursor: "pointer",
    marginRight: 8,
    marginBottom: 6,
    whiteSpace: "nowrap",
  };

  const pillActive = {
    ...pillBase,
    background: "linear-gradient(135deg, #22c55e 0%, #3b82f6 50%, #a855f7 100%)",
    border: "none",
    color: "#0b1020",
    fontWeight: 600,
  };

  const smallLabel = {
    fontSize: 18,
    color: "#9ca3af",
    marginTop: 8,
    marginBottom: 4,
    fontWeight: 400,
  };

  const rootStyle = {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: "#1e3392ff",
    color: "#f9fafb",
    borderLeft: "1px solid #1f2933",
    transform: open ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.25s ease-out",
    boxShadow: open ? "-4px 0 16px rgba(0,0,0,0.7)" : "none",
  };

  return (
    <div style={rootStyle}>
      {/* HEADER BAR */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid rgba(28, 64, 180, 0.43)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#60a5fa" }}>
            Image Tools
          </div>
          <div style={{ fontSize: 18, color: "#9ca3af" }}>
            Click an image in your email to open.
          </div>
        </div>

        {open && (
          <button
            type="button"
            onClick={() => {
              setSelectedImage(null);
              setOpen(false);
              editor?.select?.(null);
            }}
            style={{
              border: "none",
              background: "transparent",
              color: "#9ca3af",
              cursor: "pointer",
              fontSize: 22,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* IMAGE CONTROLS */}
      <div
        style={{
          padding: "10px 14px 12px",
          borderBottom: "1px solid rgba(56, 48, 167, 0.53)",
          maxHeight: 330,
          overflowY: "auto",
        }}
      >
        {!selectedImage && (
          <div style={{ fontSize: 18, color: "#6b7280" }}>
            Select an image to adjust fade, crop, overlays & colours.
          </div>
        )}

        {selectedImage && (
          <>
            {/* Alignment */}
            <div style={{ marginBottom: 10 }}>
              <div style={smallLabel}>Alignment</div>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                <button type="button" style={pillBase} onClick={() => handleAlign("left")}>
                  ⬅ Left
                </button>
                <button type="button" style={pillActive} onClick={() => handleAlign("center")}>
                  ⬌ Center
                </button>
                <button type="button" style={pillBase} onClick={() => handleAlign("right")}>
                  ➡ Right
                </button>
              </div>
            </div>

            {/* Opacity */}
            <div style={{ marginBottom: 10 }}>
              <div style={smallLabel}>Overall fade (opacity)</div>
              <input
                type="range"
                min="0"
                max="100"
                value={opacity}
                onChange={(e) => handleOpacityChange(e.target.value)}
                style={{ width: "100%" }}
              />
              <div style={{ fontSize: 18, color: "#9ca3af" }}>{opacity}% visible</div>
            </div>

            {/* Background */}
            <div style={{ marginBottom: 10 }}>
              <div style={smallLabel}>Background</div>
              <button
                type="button"
                style={bgRemoved ? pillActive : pillBase}
                onClick={handleToggleBgRemove}
              >
                ✂ Remove background
              </button>
              <div style={{ fontSize: 18, color: "#6b7280", marginTop: 4 }}>
                Works best on white or light backgrounds.
              </div>
            </div>

            {/* Directional fade */}
            <div style={{ marginBottom: 10 }}>
              <div style={smallLabel}>Directional fade-out</div>
              <div style={{ display: "flex", marginBottom: 4 }}>
                <button
                  type="button"
                  style={fadeSide === "left" ? pillActive : pillBase}
                  onClick={() => handleFadeChange("left", fadeStrength)}
                >
                  Fade left
                </button>
                <button
                  type="button"
                  style={fadeSide === "right" ? pillActive : pillBase}
                  onClick={() => handleFadeChange("right", fadeStrength)}
                >
                  Fade right
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={fadeStrength}
                onChange={(e) => handleFadeChange(fadeSide, Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ fontSize: 18, color: "#9ca3af" }}>Strength: {fadeStrength}%</div>
            </div>

            {/* Radius */}
            <div style={{ marginBottom: 14 }}>
              <div style={smallLabel}>Corner roundness ({radius}px)</div>
              <input
                type="range"
                min="0"
                max="60"
                value={radius}
                onChange={(e) => handleRadiusChange(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {/* Crop */}
            <div style={{ marginBottom: 10 }}>
              <div style={smallLabel}>Crop edges</div>

              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 18 }}>Top: {crop.top}%</div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={crop.top}
                  onChange={(e) => handleCropChange("top", Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 18 }}>Right: {crop.right}%</div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={crop.right}
                  onChange={(e) => handleCropChange("right", Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 18 }}>Bottom: {crop.bottom}%</div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={crop.bottom}
                  onChange={(e) => handleCropChange("bottom", Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 18 }}>Left: {crop.left}%</div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={crop.left}
                  onChange={(e) => handleCropChange("left", Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Overlay */}
            <div style={{ marginBottom: 10 }}>
              <div style={smallLabel}>Overlay mode & stacking</div>
              <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 4 }}>
                <button
                  type="button"
                  style={overlayMode === "normal" ? pillActive : pillBase}
                  onClick={() => handleOverlayToggle("normal")}
                >
                  Normal
                </button>
                <button
                  type="button"
                  style={overlayMode === "overlay" ? pillActive : pillBase}
                  onClick={() => handleOverlayToggle("overlay")}
                >
                  Overlay
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <button type="button" style={pillBase} onClick={() => adjustZ(+1)}>
                  ⬆ Bring forward
                </button>
                <button type="button" style={pillBase} onClick={() => adjustZ(-1)}>
                  ⬇ Send backward
                </button>
                <span style={{ fontSize: 18, color: "#9ca3af" }}>z-index: {zIndex}</span>
              </div>
            </div>

            {/* Colours */}
            <div style={{ marginBottom: 10 }}>
              <div style={smallLabel}>Frame colours</div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {[
                  "#000000",
                  "#ffffff",
                  "#6b7280",
                  "#111827",
                  "#2297c5",
                  "#22c55e",
                  "#eab308",
                  "#f97316",
                  "#a855f7",
                  "#1607dbff",
                  "#eb1616ff",
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => applyFrameColour(c)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "999px",
                      border: "1px solid #020617",
                      background: c,
                      cursor: "pointer",
                    }}
                    title={c}
                  />
                ))}
              </div>

              <div style={{ fontSize: 18, color: "#9ca3af" }}>Custom colour</div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <input
                  type="color"
                  value={customColourInput}
                  onChange={(e) => setCustomColourInput(e.target.value)}
                  style={{ width: 36, height: 30, border: "none", background: "transparent" }}
                />
                <button type="button" onClick={addCustomColour} style={{ ...pillBase, fontSize: 18 }}>
                  + Save
                </button>
              </div>

              {customColours.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {customColours.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => applyFrameColour(c)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "999px",
                        border: "1px solid #020617",
                        background: c,
                        cursor: "pointer",
                      }}
                      title={c}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* IMAGE LIBRARY */}
      <div
        style={{
          padding: "12px 14px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div style={sectionTitleStyle}>Image Library</div>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
          {!images?.length && (
            <div style={{ fontSize: 18, color: "#6b7280" }}>
              Your uploaded images will appear here.
            </div>
          )}

          {images?.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {images.map((img) => (
                <button
                  key={img.id || img.url || img.name}
                  type="button"
                  onClick={() => handleInsertImage(img.url || img.src)}
                  style={{
                    border: "1px solid rgba(148,163,184,0.55)",
                    background: "#1e3497ff",
                    borderRadius: 12,
                    padding: 6,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={img.url || img.src}
                    alt={img.name || ""}
                    style={{
                      width: "100%",
                      height: 80,
                      objectFit: "cover",
                      borderRadius: 10,
                      display: "block",
                    }}
                  />
                  {img.name && (
                    <span
                      style={{
                        marginTop: 4,
                        fontSize: 18,
                        color: "#e5e7eb",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        width: "100%",
                        textAlign: "center",
                      }}
                    >
                      {img.name}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
