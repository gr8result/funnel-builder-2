// /components/website-builder/utils/BuilderSidebar.js
// FULL REPLACEMENT — NO “template blocks list” junk
// ✅ Big square draggable block tiles (proper drag/drop items)
// ✅ Click = quick add (adds to end)
// ✅ Drag = drop anywhere on canvas
// ✅ Templates kept ONLY as real site templates (top buttons)

import { useMemo, useState } from "react";
import ImageLibrary from "./ImageLibrary";

export default function BuilderSidebar({ templates, onApplyTemplate, onQuickAdd }) {
  const [tab, setTab] = useState("blocks"); // blocks | images

  const tiles = useMemo(() => {
    return [
      { type: "nav", label: "NAV", sub: "Menu", color: "#7c3aed", icon: "≡" },
      { type: "hero", label: "HERO", sub: "Headline", color: "#2297c5", icon: "★" },
      { type: "text", label: "TEXT", sub: "Paragraph", color: "#38bdf8", icon: "T" },
      { type: "two_col", label: "2 COL", sub: "Text+Image", color: "#10b981", icon: "▦" },
      { type: "three_col", label: "3 COL", sub: "Cards", color: "#f59e0b", icon: "▤" },
      { type: "features", label: "FEAT", sub: "List", color: "#60a5fa", icon: "✓" },
      { type: "gallery", label: "GALL", sub: "Grid", color: "#ec4899", icon: "▩" },
      { type: "image", label: "IMG", sub: "Single", color: "#94a3b8", icon: "🖼" },
      { type: "cta", label: "CTA", sub: "Button", color: "#22c55e", icon: "↗" },
      { type: "footer", label: "FOOT", sub: "Bottom", color: "#64748b", icon: "▁" },
    ];
  }, []);

  function setTransfer(payload, e) {
    try {
      e.dataTransfer.setData("application/gr8builder", JSON.stringify(payload));
      e.dataTransfer.setData("text/plain", JSON.stringify(payload)); // compat
      e.dataTransfer.effectAllowed = "copy";
    } catch (err) {}
  }

  function dragBlock(tile, e) {
    setTransfer({ kind: "new", type: tile.type }, e);
  }

  function dragImage(url, e) {
    setTransfer({ kind: "new_image", url }, e);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* REAL templates only */}
      <div style={styles.panel}>
        <div style={styles.panelTitle}>Templates</div>
        <div style={{ display: "grid", gap: 8 }}>
          {(templates || []).map((t) => (
            <button
              key={t.key}
              style={styles.templateBtn}
              onClick={() => onApplyTemplate?.(t.key)}
              title="Replace the whole page with this template"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.tabsRow}>
          <button
            style={{ ...styles.tabBtn, ...(tab === "blocks" ? styles.tabOn : {}) }}
            onClick={() => setTab("blocks")}
          >
            Blocks
          </button>
          <button
            style={{ ...styles.tabBtn, ...(tab === "images" ? styles.tabOn : {}) }}
            onClick={() => setTab("images")}
          >
            Images
          </button>
        </div>

        {tab === "blocks" ? (
          <>
            <div style={styles.panelTitle}>Block Library</div>

            <div style={styles.squareGrid}>
              {tiles.map((t) => (
                <div
                  key={t.type}
                  style={styles.square}
                  draggable
                  onDragStart={(e) => dragBlock(t, e)}
                  onClick={() => onQuickAdd?.(t.type, null)}
                  title="Drag into canvas • Click to add"
                >
                  <div style={{ ...styles.squareTop, borderColor: t.color }}>
                    <div style={{ ...styles.squareIcon, background: t.color }}>{t.icon}</div>
                    <div style={styles.squareText}>
                      <div style={styles.squareLabel}>{t.label}</div>
                      <div style={styles.squareSub}>{t.sub}</div>
                    </div>
                  </div>

                  <div style={styles.squareHint}>DRAG</div>
                </div>
              ))}
            </div>

            <div style={styles.hint}>Drag a square into the canvas drop zones to place it exactly where you want.</div>
          </>
        ) : (
          <ImageLibrary
            onDragImage={dragImage}
            onPickImage={(url) =>
              onQuickAdd?.("image", {
                type: "image",
                src: url,
                caption: "Image",
                fit: "cover",
                background: { mode: "transparent" },
              })
            }
          />
        )}
      </div>
    </div>
  );
}

const styles = {
  panel: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 12,
  },
  panelTitle: { color: "white", fontWeight: 950, marginBottom: 10 },

  templateBtn: {
    width: "100%",
    textAlign: "left",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "white",
    padding: "10px 12px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 900,
  },

  tabsRow: { display: "flex", gap: 8, marginBottom: 10 },
  tabBtn: {
    flex: 1,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.85)",
    padding: "10px 12px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 950,
  },
  tabOn: { background: "rgba(34,151,197,0.22)", border: "1px solid rgba(34,151,197,0.55)", color: "white" },

  squareGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },

  square: {
    height: 110,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.22)",
    cursor: "grab",
    userSelect: "none",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: 10,
  },

  squareTop: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    borderLeft: "5px solid",
    paddingLeft: 10,
  },
  squareIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
    color: "#06121d",
    fontSize: 18,
    boxShadow: "0 10px 22px rgba(0,0,0,0.28)",
  },
  squareText: { display: "grid", gap: 2 },
  squareLabel: { color: "white", fontWeight: 950, fontSize: 16, letterSpacing: 0.4 },
  squareSub: { color: "rgba(255,255,255,0.70)", fontWeight: 850, fontSize: 12 },

  squareHint: {
    alignSelf: "flex-end",
    color: "rgba(255,255,255,0.55)",
    fontWeight: 950,
    fontSize: 11,
    letterSpacing: 1.2,
  },

  hint: { marginTop: 10, color: "rgba(255,255,255,0.65)", fontWeight: 850, fontSize: 13 },
};
