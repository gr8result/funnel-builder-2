import { useState } from "react";

export function ToolBtn({ onClick, children, title, danger = false }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (danger ? "#ef4444" : "#334155") : "transparent",
        border: "none", cursor: "pointer", padding: "3px 8px", borderRadius: 4,
        fontSize: 16, fontWeight: 600,
        color: danger ? (hov ? "#fff" : "#fca5a5") : (hov ? "#fff" : "#cbd5e1"),
        transition: "background 0.1s",
      }}
    >
      {children}
    </button>
  );
}

export function DropZone({ active = false, onDragOver, onDrop }) {
  return (
    <div
      onDragOver={e => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={e => {
        e.preventDefault();
        onDrop?.(e);
      }}
      style={{
        height: active ? 28 : 12,
        margin: "2px 0",
        borderRadius: 10,
        background: active ? "rgba(37,99,235,0.12)" : "transparent",
        border: active ? "2px dashed #2563eb" : "2px dashed transparent",
        transition: "all 0.12s ease",
      }}
    />
  );
}

export function CatalogBtn({ icon, label, onClick, onDragStart, onDragEnd }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = "copy";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Click to add or drag onto the email"
      style={{
        display: "flex", alignItems: "center", gap: 9,
        width: "100%", padding: "10px 16px",
        background: hov ? "#1e40af" : "transparent",
        border: "none", color: hov ? "#fff" : "#cbd5e1",
        cursor: "grab", fontSize: 16, fontWeight: 600, textAlign: "left", borderRadius: 0,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <span style={{ fontSize: 17 }}>{icon}</span>
      {label}
    </button>
  );
}

export function SavedBtn({ label, onInsert, onDelete, onDragStart, onDragEnd }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center",
        background: hov ? "#1e293b" : "transparent",
        transition: "background 0.1s",
      }}
    >
      <button
        draggable
        onDragStart={e => {
          e.dataTransfer.effectAllowed = "copy";
          onDragStart?.();
        }}
        onDragEnd={() => onDragEnd?.()}
        onClick={onInsert}
        style={{
          flex: 1, padding: "8px 14px", background: "none", border: "none",
          color: hov ? "#fbbf24" : "#78716c", cursor: "grab",
          fontSize: 16, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
        title={`Insert or drag: ${label}`}
      >
        ⭐ {label}
      </button>
      <button
        onClick={onDelete}
        title="Remove saved block"
        style={{
          background: "none", border: "none", color: "#9ca3af", cursor: "pointer",
          fontSize: 16, fontWeight: 600, padding: "0 10px 0 0", flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

export function FileMenuItem({ onClick, disabled = false, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%",
        border: "none",
        borderBottom: "1px solid #f1f5f9",
        background: hov && !disabled ? "#f8fafc" : "#ffffff",
        padding: "10px 12px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        fontSize: 16,
        fontWeight: 600,
        color: "#0f172a",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function TopBtn({ onClick, disabled = false, color = "#2563eb", children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 36, padding: "0 14px",
        background: hov ? color : color + "dd",
        color: "#fff", border: "none", borderRadius: 7,
        fontSize: 16, fontWeight: 600, cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.65 : 1, whiteSpace: "nowrap",
        transition: "opacity 0.1s",
      }}
    >
      {children}
    </button>
  );
}
