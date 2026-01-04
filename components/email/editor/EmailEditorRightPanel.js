// ============================================
// /components/email/editor/EmailEditorRightPanel.js
// FULL REPLACEMENT — Image tools + gallery + reusable blocks
// NOTE: This panel expects a GrapesJS-like `editor` instance.
// ============================================

import { useEffect, useMemo, useState } from "react";

const LS_BLOCKS_KEY = "gr8:email:savedBlocks:v1";

export default function EmailEditorRightPanel({ editor, images }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [fadeSide, setFadeSide] = useState("right");
  const [fadeStrength, setFadeStrength] = useState(40);
  const [bgRemoved, setBgRemoved] = useState(false);

  const [savedBlocks, setSavedBlocks] = useState([]);
  const [blockName, setBlockName] = useState("");

  // load saved blocks
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LS_BLOCKS_KEY);
      if (raw) setSavedBlocks(JSON.parse(raw));
    } catch (e) {
      console.warn("Could not load saved blocks", e);
    }
  }, []);

  const persistBlocks = (blocks) => {
    setSavedBlocks(blocks);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LS_BLOCKS_KEY, JSON.stringify(blocks));
    } catch (e) {
      console.warn("Could not persist", e);
    }
  };

  // detect selected component
  useEffect(() => {
    if (!editor) return;

    const onSelected = (cmpRaw) => {
      const cmp = cmpRaw && cmpRaw.get ? cmpRaw : null;
      if (!cmp) {
        setSelectedImage(null);
        return;
      }

      const tag = (cmp.get("tagName") || "").toString().toLowerCase();

      if (tag === "img") {
        setSelectedImage(cmp);

        const style = cmp.getStyle ? cmp.getStyle() || {} : {};
        const mask = style.WebkitMaskImage || style.maskImage || "";

        const fadeMatch = mask && mask.match(/(\d+)%\)/);
        setFadeStrength(fadeMatch ? Number(fadeMatch[1]) : 40);

        const sideMatch = mask && mask.match(/to\s+(left|right)/);
        setFadeSide(sideMatch ? sideMatch[1] : "right");

        const blendMode = style.mixBlendMode || "";
        setBgRemoved(blendMode === "multiply");
      } else {
        setSelectedImage(null);
      }
    };

    editor.on("component:selected", onSelected);
    return () => editor.off("component:selected", onSelected);
  }, [editor]);

  // helpers
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
      updateImageStyle({ display: "block", marginLeft: "auto", marginRight: "auto" });
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
    setFadeSide(side);
    setFadeStrength(strength);
    if (!selectedImage) return;

    const dir = side === "left" ? "to right" : "to left";
    const pct = Math.max(0, Math.min(100, strength));
    const mask = `linear-gradient(${dir}, transparent 0%, black ${pct}%)`;

    updateImageStyle({
      WebkitMaskImage: mask,
      maskImage: mask,
    });
  };

  const handleInsertImage = (url) => {
    if (!editor || !url) return;
    const sel = editor.getSelected && editor.getSelected();

    if (sel && sel.get && sel.get("tagName") === "img") {
      sel.addAttributes({ src: url });
    } else {
      editor
        .getWrapper()
        .append(
          `<img src="${url}" style="display:block;margin:0 auto;max-width:100%;border-radius:6px;" />`
        );
    }
  };

  // Save whole SECTION (header/footer/row), not just tiny element
  const handleSaveBlock = () => {
    if (!editor || !blockName.trim()) return;

    const selected = editor.getSelected && editor.getSelected();
    if (!selected) {
      alert("Click inside the header/footer/section first.");
      return;
    }

    const wrapper = editor.getWrapper();
    let base = selected;
    let parent =
      base.parent && typeof base.parent === "function" ? base.parent() : null;

    // climb up until just under wrapper so we grab the full section container
    let safety = 0;
    while (parent && parent !== wrapper && safety < 20) {
      base = parent;
      parent = base.parent && typeof base.parent === "function" ? base.parent() : null;
      safety += 1;
    }

    if (!base || base === wrapper) {
      alert("Could not find a section to save. Try selecting inside the header/footer again.");
      return;
    }

    const html = base.toHTML ? base.toHTML() : "";
    if (!html) {
      alert("This element has no HTML to save.");
      return;
    }

    const id = `saved-block-${Date.now()}`;
    const name = blockName.trim();

    // Add as a block (drag-in later)
    if (editor.BlockManager && editor.BlockManager.add) {
      editor.BlockManager.add(id, {
        id,
        label: name,
        category: "Saved blocks",
        media:
          '<div style="font-size:18px;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);">Saved</div>',
        content: html,
      });
    }

    const next = [...savedBlocks, { id, name, html }];
    persistBlocks(next);
    setBlockName("");
  };

  const handleInsertBlock = (block) => {
    if (!editor || !block) return;
    editor.getWrapper().append(block.html);
  };

  const imageList = useMemo(() => images || [], [images]);

  // UI styles
  const panelStyle = {
    width: 350,
    minWidth: 350,
    background: "#2c3b80ff",
    borderLeft: "1px solid #2c3b80ff",
    display: "flex",
    flexDirection: "column",
    color: "#f9fafb",
  };

  const sectionStyle = {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(66, 48, 228, 0.64)",
  };

  const titleStyle = {
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#9ca3af",
    marginBottom: 10,
  };

  const smallLabelStyle = {
    fontSize: 18,
    color: "#9ca3af",
    fontWeight: 400,
    marginBottom: 6,
  };

  const pill = {
    fontSize: 18,
    borderRadius: 999,
    padding: "8px 14px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(15,23,42,0.9)",
    color: "#f9fafb",
    cursor: "pointer",
    marginRight: 8,
    marginBottom: 6,
  };

  const pillActive = {
    ...pill,
    background: "linear-gradient(135deg, #22c55e 0%, #3b82f6 50%, #a855f7 100%)",
    border: "none",
    color: "#020617",
    fontWeight: 700,
  };

  return (
    <aside style={panelStyle}>
      {/* IMAGE TOOLS */}
      <div style={sectionStyle}>
        <div style={titleStyle}>Image Tools</div>

        {!selectedImage && (
          <div style={{ fontSize: 18, color: "#6b7280" }}>
            Click an image in your email to open tools.
          </div>
        )}

        {selectedImage && (
          <>
            {/* Alignment */}
            <div style={{ marginBottom: 14 }}>
              <div style={smallLabelStyle}>Alignment</div>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                <button type="button" style={pill} onClick={() => handleAlign("left")}>
                  ⬅ Left
                </button>
                <button type="button" style={pillActive} onClick={() => handleAlign("center")}>
                  ⬌ Center
                </button>
                <button type="button" style={pill} onClick={() => handleAlign("right")}>
                  ➡ Right
                </button>
              </div>
            </div>

            {/* BG remover */}
            <div style={{ marginBottom: 14 }}>
              <div style={smallLabelStyle}>Background</div>
              <button
                type="button"
                style={bgRemoved ? pillActive : pill}
                onClick={handleToggleBgRemove}
              >
                ✂ Background remover
              </button>
              <div style={{ fontSize: 18, color: "#6b7280", marginTop: 4 }}>
                Works best on white / bright backgrounds.
              </div>
            </div>

            {/* Fade */}
            <div style={{ marginBottom: 14 }}>
              <div style={smallLabelStyle}>Directional fade</div>
              <div style={{ display: "flex", marginBottom: 6 }}>
                <button
                  type="button"
                  style={fadeSide === "left" ? pillActive : pill}
                  onClick={() => handleFadeChange("left", fadeStrength)}
                >
                  Fade left
                </button>
                <button
                  type="button"
                  style={fadeSide === "right" ? pillActive : pill}
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

              <div style={{ fontSize: 18, color: "#9ca3af" }}>
                Strength: {fadeStrength}%
              </div>
            </div>
          </>
        )}
      </div>

      {/* IMAGE LIBRARY */}
      <div style={sectionStyle}>
        <div style={titleStyle}>Image Library</div>

        <div style={{ maxHeight: 300, overflowY: "auto", paddingRight: 6 }}>
          {imageList.length === 0 && (
            <div style={{ fontSize: 18, color: "#6b7280" }}>No images uploaded yet.</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {imageList.map((img) => (
              <button
                key={img.id || img.url || img.src || img.name}
                type="button"
                onClick={() => handleInsertImage(img.url || img.src)}
                style={{
                  border: "1px solid rgba(148,163,184,0.55)",
                  background: "#203491ff",
                  borderRadius: 12,
                  padding: 6,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
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
                  }}
                />
                {img.name && (
                  <span
                    style={{
                      marginTop: 4,
                      fontSize: 18,
                      color: "#e5e7eb",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
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
        </div>
      </div>

      {/* REUSABLE BLOCKS */}
      <div
        style={{
          ...sectionStyle,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div style={titleStyle}>Reusable Blocks</div>

        <div style={{ fontSize: 16, color: "#d1d5db", marginBottom: 8 }}>
          Click inside a header / footer / section, name it, then save.
        </div>

        <input
          type="text"
          placeholder="Header, footer, testimonial..."
          value={blockName}
          onChange={(e) => setBlockName(e.target.value)}
          style={{
            width: "100%",
            fontSize: 18,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.7)",
            background: "#223899ff",
            color: "#e5e7eb",
            marginBottom: 10,
          }}
        />

        <button
          type="button"
          onClick={handleSaveBlock}
          style={{
            width: "100%",
            fontSize: 18,
            borderRadius: 999,
            padding: "12px 14px",
            border: "none",
            background: "linear-gradient(135deg,#22c55e,#3b82f6,#a855f7)",
            color: "#020617",
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          + Save block
        </button>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
          {savedBlocks.length === 0 && (
            <div style={{ fontSize: 18, color: "#6b7280" }}>No saved blocks yet.</div>
          )}

          {savedBlocks.map((block) => (
            <div
              key={block.id}
              style={{
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.55)",
                padding: 12,
                marginBottom: 10,
                background: "radial-gradient(circle at top left,#1d4ed8 0,#020617 55%)",
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#f9fafb",
                  marginBottom: 8,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {block.name}
              </div>

              <button
                type="button"
                onClick={() => handleInsertBlock(block)}
                style={{
                  ...pillActive,
                  width: "100%",
                  marginRight: 0,
                  textAlign: "center",
                  padding: "12px 14px",
                  fontSize: 18,
                }}
              >
                ↳ Insert
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
