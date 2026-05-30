import React, { useState, useMemo } from "react";
import { GRID_ICON_LIBRARY } from "../../components/website-builder/gridIconLibrary";
import { renderGridLibraryIcon } from "../../components/website-builder/gridIconLibrary";

export default function IconLibraryPage() {
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState("All");
  const [copied, setCopied] = useState(null);

  const groups = useMemo(() => {
    const seen = new Set();
    const list = ["All"];
    for (const icon of GRID_ICON_LIBRARY) {
      if (!seen.has(icon.group)) {
        seen.add(icon.group);
        list.push(icon.group);
      }
    }
    return list;
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return GRID_ICON_LIBRARY.filter((icon) => {
      const matchGroup = activeGroup === "All" || icon.group === activeGroup;
      const matchSearch =
        !q ||
        icon.key.toLowerCase().includes(q) ||
        icon.label.toLowerCase().includes(q) ||
        icon.group.toLowerCase().includes(q);
      return matchGroup && matchSearch;
    });
  }, [search, activeGroup]);

  function copyKey(key) {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f13", color: "#e5e7eb", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 0", borderBottom: "1px solid #1f2937" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: "#f9fafb" }}>
          Icon Library
        </h1>
        <p style={{ margin: "4px 0 16px", fontSize: 16, color: "#9ca3af" }}>
          {GRID_ICON_LIBRARY.length} icons · Click any icon to copy its key
        </p>

        {/* Search */}
        <input
          type="search"
          placeholder="Search icons…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 360,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #374151",
            background: "#1f2937",
            color: "#f9fafb",
            fontSize: 16,
            outline: "none",
            marginBottom: 16,
          }}
        />

        {/* Group tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 16 }}>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 500,
                background: activeGroup === g ? "#6366f1" : "#1f2937",
                color: activeGroup === g ? "#fff" : "#9ca3af",
                transition: "background 0.15s",
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div style={{ padding: "10px 32px", fontSize: 16, color: "#9ca3af" }}>
        {filtered.length} result{filtered.length !== 1 ? "s" : ""}
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
          gap: 8,
          padding: "0 32px 48px",
        }}
      >
        {filtered.map((icon) => (
          <button
            key={icon.key}
            title={`${icon.key}\n${icon.group}`}
            onClick={() => copyKey(icon.key)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 8px",
              borderRadius: 10,
              border: copied === icon.key ? "1px solid #6366f1" : "1px solid transparent",
              background: copied === icon.key ? "#1e1b4b" : "#1f2937",
              cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s",
              color: "#e5e7eb",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              if (copied !== icon.key) e.currentTarget.style.background = "#374151";
            }}
            onMouseLeave={(e) => {
              if (copied !== icon.key) e.currentTarget.style.background = "#1f2937";
            }}
          >
            <span style={{ fontSize: 28, lineHeight: 1, display: "flex", alignItems: "center" }}>
              {renderGridLibraryIcon(icon.key, { size: 28 })}
            </span>
            <span
              style={{
                fontSize: 16,
                color: "#9ca3af",
                textAlign: "center",
                wordBreak: "break-word",
                lineHeight: 1.3,
                maxWidth: "100%",
              }}
            >
              {copied === icon.key ? "✓ copied" : icon.label}
            </span>
            <span
              style={{
                fontSize: 16,
                color: "#9ca3af",
                textAlign: "center",
                wordBreak: "break-all",
                maxWidth: "100%",
              }}
            >
              {icon.key}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 32px", color: "#9ca3af" }}>
          No icons match &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  );
}
