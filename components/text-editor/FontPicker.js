// FontPicker — searchable font selector with category tabs and live preview.
// Renders each option in its own font so the user can see what it looks like.
//
// Props:
//   value       string           — selected font family display name
//   onChange    (family) => void
//   compact     boolean          — collapsed dropdown style vs. full panel
//   recentFonts string[]         — recently-used fonts shown at top

import { useState, useEffect, useRef, useCallback } from "react";
import { FONT_REGISTRY, FONT_CATEGORIES, getFontStack, searchFonts, getFontsByCategory } from "../../lib/text-editor/fontRegistry";
import { loadFont } from "../../hooks/useFontLoader";
import { getRecentFonts, addRecentFont } from "../../hooks/useSavedTextStyles";

const PANEL_STYLE = {
  position: "absolute",
  top: "100%",
  left: 0,
  zIndex: 9999,
  background: "#1e293b",
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: 12,
  boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
  width: 280,
  maxHeight: 420,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  marginTop: 4,
};

const INPUT_STYLE = {
  padding: "8px 12px",
  background: "rgba(255,255,255,0.06)",
  border: "none",
  borderBottom: "1px solid rgba(148,163,184,0.15)",
  color: "#e2e8f0",
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const TABS_STYLE = {
  display: "flex",
  gap: 2,
  padding: "6px 8px",
  overflowX: "auto",
  borderBottom: "1px solid rgba(148,163,184,0.1)",
  scrollbarWidth: "none",
};

const LIST_STYLE = {
  overflowY: "auto",
  flex: 1,
};

const ITEM_STYLE = (selected, hovered) => ({
  display: "flex",
  alignItems: "center",
  padding: "7px 12px",
  cursor: "pointer",
  background: selected ? "rgba(99,102,241,0.25)" : hovered ? "rgba(255,255,255,0.06)" : "transparent",
  color: selected ? "#a5b4fc" : "#e2e8f0",
  fontSize: 14,
  gap: 10,
  transition: "background 0.1s",
});

const SECTION_LABEL_STYLE = {
  padding: "6px 12px 2px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#64748b",
};

export default function FontPicker({ value, onChange, compact = false, showRecent = true }) {
  const [open,     setOpen]     = useState(false);
  const [query,    setQuery]    = useState("");
  const [category, setCategory] = useState("all");
  const [hovered,  setHovered]  = useState(null);
  const [recentFonts, setRecentFonts] = useState([]);
  const containerRef = useRef(null);
  const inputRef     = useRef(null);

  useEffect(() => {
    setRecentFonts(getRecentFonts());
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleOpen = () => {
    setQuery("");
    setCategory("all");
    setOpen(o => !o);
  };

  const handleSelect = useCallback((family) => {
    loadFont(family);
    addRecentFont(family);
    setRecentFonts(getRecentFonts());
    onChange?.(family);
    setOpen(false);
  }, [onChange]);

  // Determine visible fonts
  const visibleFonts = query
    ? searchFonts(query)
    : getFontsByCategory(category === "all" ? null : category);

  // Section "recent" appears only when no query and category is "all"
  const showRecentsSection = showRecent && !query && category === "all" && recentFonts.length > 0;
  const recentEntries = recentFonts
    .map(f => FONT_REGISTRY.find(e => e.family === f))
    .filter(Boolean);

  const currentStack = getFontStack(value) || "inherit";

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block", width: "100%" }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "7px 10px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(148,163,184,0.2)",
          borderRadius: 8,
          color: "#e2e8f0",
          cursor: "pointer",
          gap: 8,
          fontSize: 13,
        }}
      >
        <span style={{ fontFamily: currentStack, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || "Select font"}
        </span>
        <span style={{ color: "#64748b", fontSize: 11, flexShrink: 0 }}>▾</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={PANEL_STYLE}>
          {/* Search */}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search fonts…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={INPUT_STYLE}
          />

          {/* Category tabs */}
          {!query && (
            <div style={TABS_STYLE}>
              {FONT_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    background:  category === cat.id ? "rgba(99,102,241,0.35)" : "transparent",
                    color:       category === cat.id ? "#a5b4fc" : "#94a3b8",
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Font list */}
          <div style={LIST_STYLE}>
            {/* Recent section */}
            {showRecentsSection && recentEntries.length > 0 && (
              <>
                <div style={SECTION_LABEL_STYLE}>Recently used</div>
                {recentEntries.map(entry => (
                  <FontRow
                    key={`recent-${entry.family}`}
                    entry={entry}
                    selected={value === entry.family}
                    hovered={hovered === `recent-${entry.family}`}
                    onMouseEnter={() => setHovered(`recent-${entry.family}`)}
                    onMouseLeave={() => setHovered(null)}
                    onSelect={handleSelect}
                  />
                ))}
                <div style={{ height: 1, background: "rgba(148,163,184,0.1)", margin: "4px 0" }} />
                <div style={SECTION_LABEL_STYLE}>All fonts</div>
              </>
            )}

            {visibleFonts.length === 0 && (
              <div style={{ padding: "16px 12px", color: "#64748b", fontSize: 13, textAlign: "center" }}>
                No fonts match "{query}"
              </div>
            )}

            {visibleFonts.map(entry => (
              <FontRow
                key={entry.family}
                entry={entry}
                selected={value === entry.family}
                hovered={hovered === entry.family}
                onMouseEnter={() => setHovered(entry.family)}
                onMouseLeave={() => setHovered(null)}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single font row ───────────────────────────────────────────────────────────

function FontRow({ entry, selected, hovered, onMouseEnter, onMouseLeave, onSelect }) {
  // Load the font so the preview renders correctly
  useEffect(() => { loadFont(entry.family); }, [entry.family]);

  return (
    <div
      style={ITEM_STYLE(selected, hovered)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={() => onSelect(entry.family)}
    >
      {/* Category dot */}
      <span style={{
        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
        background: CATEGORY_COLORS[entry.category] || "#64748b",
      }} />

      {/* Font name rendered in its own font */}
      <span style={{ fontFamily: entry.stack, fontSize: 15, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {entry.family}
      </span>

      {/* System / Google badge */}
      {!entry.system && (
        <span style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.05em" }}>G</span>
      )}

      {/* Selected checkmark */}
      {selected && <span style={{ color: "#818cf8", fontSize: 12 }}>✓</span>}
    </div>
  );
}

const CATEGORY_COLORS = {
  "sans-serif":  "#0ea5e9",
  "serif":       "#a78bfa",
  "display":     "#f59e0b",
  "monospace":   "#34d399",
  "handwriting": "#f472b6",
};
