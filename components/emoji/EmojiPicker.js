// /components/emoji/EmojiPicker.js
// Unified emoji picker — uses the full EMOJI_GROUPS library, supports both
// inline mode (no open/onClose props) and overlay mode (open + onClose props).

import { useMemo, useState, useRef, useEffect } from "react";
import { EMOJI_GROUPS } from "./emojiLibrary";

const ALL_EMOJIS = EMOJI_GROUPS.flatMap((g) => g.emojis);

export default function EmojiPicker({ onPick, open, onClose }) {
  const [q, setQ] = useState("");
  const [activeGroup, setActiveGroup] = useState("all");
  const containerRef = useRef(null);

  // Overlay mode: close on outside click / Escape
  const isOverlay = open !== undefined;
  useEffect(() => {
    if (!isOverlay || !open) return;
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    function onDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) onClose?.();
    }
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("touchstart", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("touchstart", onDown, true);
    };
  }, [isOverlay, open, onClose]);

  if (isOverlay && !open) return null;

  const sourceEmojis = activeGroup === "all"
    ? ALL_EMOJIS
    : (EMOJI_GROUPS.find((g) => g.id === activeGroup)?.emojis || []);

  const list = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    if (!query) return sourceEmojis;
    return ALL_EMOJIS.filter((e) => String(e).includes(query));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, activeGroup]);

  return (
    <div ref={containerRef} style={{ marginTop: isOverlay ? 0 : 10 }}>
      {/* Group tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {[{ id: "all", name: "All" }, ...EMOJI_GROUPS.filter((g) => g.id !== "recent")].map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => { setActiveGroup(g.id); setQ(""); }}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: activeGroup === g.id ? "1px solid rgba(148,163,184,.6)" : "1px solid rgba(148,163,184,.2)",
              background: activeGroup === g.id ? "rgba(148,163,184,.2)" : "transparent",
              color: "#e5e7eb",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {g.name}
          </button>
        ))}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search…"
        style={{
          width: "100%",
          background: "#020617",
          border: "1px solid rgba(148,163,184,.25)",
          borderRadius: 10,
          padding: "10px 12px",
          color: "#e5e7eb",
          fontWeight: 600,
          fontSize: 16,
          marginBottom: 10,
          boxSizing: "border-box",
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, 1fr)",
          gap: 8,
          padding: 10,
          borderRadius: 12,
          border: "1px solid rgba(148,163,184,.18)",
          background: "rgba(2,6,23,.35)",
          maxHeight: 280,
          overflowY: "auto",
        }}
      >
        {(Array.isArray(list) ? list : []).map((emo, i) => (
          <button
            key={`${emo}-${i}`}
            type="button"
            onClick={() => onPick && onPick(emo)}
            style={{
              border: "1px solid rgba(148,163,184,.18)",
              background: "rgba(15,23,42,.85)",
              borderRadius: 10,
              padding: "8px 0",
              cursor: "pointer",
              fontSize: 22,
              lineHeight: 1,
            }}
            title={emo}
          >
            {emo}
          </button>
        ))}
      </div>
    </div>
  );
}
