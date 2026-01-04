// /components/emoji/EmojiPicker.js
// FULL REPLACEMENT — prevents "Cannot read properties of undefined (reading 'map')"

import { useMemo, useState } from "react";

// If you previously imported a big emoji list, keep it.
// If it fails or is missing, we fallback to a small built-in set.
const FALLBACK = ["😀","😁","😂","🤣","😊","😍","😎","👍","🔥","💬","✅","🎉","📞","💡","🚀","💰","❤️","🙏","😅","🤝","📩","📲","⭐"];

export default function EmojiPicker({ onPick }) {
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const base = Array.isArray(FALLBACK) ? FALLBACK : [];
    const query = String(q || "").trim().toLowerCase();
    if (!query) return base;
    // simple filter (works with unicode)
    return base.filter((e) => String(e).includes(query));
  }, [q]);

  return (
    <div style={{ marginTop: 10 }}>
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
