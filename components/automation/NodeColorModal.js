// components/automation/NodeColorModal.js
// OLD-STYLE EDIT NODE COLOURS MODAL – FIXED SWATCHES PER ROW

import { useState, useEffect } from "react";

const DEFAULTS = {
  trigger_color: "#22c55e",
  email_color: "#eab308",
  delay_color: "#f97316",
  condition_color: "#a855f7",
};

// Shared palette for each row – matches the old modal:
// green, blue, red, yellow, orange, purple, black, white
const PALETTE = [
  "#22c55e", // green
  "#2563eb", // blue
  "#ef4444", // red
  "#eab308", // yellow
  "#f97316", // orange
  "#a855f7", // purple
  "#000000", // black
  "#ffffff", // white
];

export default function NodeColorModal({ initialColors, onClose, onSave }) {
  const [values, setValues] = useState({
    ...DEFAULTS,
    ...(initialColors || {}),
  });

  useEffect(() => {
    if (initialColors) {
      setValues((prev) => ({
        ...prev,
        ...initialColors,
      }));
    }
  }, [initialColors]);

  const handleSelect = (field, color) => {
    setValues((prev) => ({ ...prev, [field]: color }));
  };

  const handleSaveClick = () => {
    if (onSave) onSave(values);
  };

  return (
    <div style={backdrop}>
      <div style={modal}>
        {/* HEADER */}
        <div style={headerRow}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Edit Node Colours</div>
          <button onClick={onClose} style={closeBtn}>
            ✕
          </button>
        </div>

        {/* ROWS */}
        <div style={rowsContainer}>
          <ColorRow
            label="Trigger"
            field="trigger_color"
            value={values.trigger_color}
            onSelect={handleSelect}
          />
          <ColorRow
            label="Email"
            field="email_color"
            value={values.email_color}
            onSelect={handleSelect}
          />
          <ColorRow
            label="Delay"
            field="delay_color"
            value={values.delay_color}
            onSelect={handleSelect}
          />
          <ColorRow
            label="Condition"
            field="condition_color"
            value={values.condition_color}
            onSelect={handleSelect}
          />
        </div>

        {/* FOOTER BUTTONS */}
        <div style={footerRow}>
          <button onClick={handleSaveClick} style={saveBtn}>
            Save
          </button>
          <button onClick={onClose} style={cancelBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorRow({ label, field, value, onSelect }) {
  return (
    <div style={row}>
      <div style={rowLabel}>{label}</div>
      <div style={swatchRow}>
        {PALETTE.map((color) => {
          const selected = color.toLowerCase() === value?.toLowerCase();
          const isWhite = color.toLowerCase() === "#ffffff";

          return (
            <button
              key={`${field}-${color}`}
              onClick={() => onSelect(field, color)}
              style={{
                ...swatch,
                background: color,
                border: selected ? "3px solid #ffffff" : "2px solid #0f172a",
                // add a dark outline when white so you can see it
                boxShadow: isWhite
                  ? "0 0 0 1px #0f172a, 0 0 6px rgba(0,0,0,0.6)"
                  : "0 0 6px rgba(0,0,0,0.6)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ----- styles -----

const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const modal = {
  width: 420,
  maxWidth: "95vw",
  background: "#0f172a",
  borderRadius: 8,
  padding: 20,
  boxShadow: "0 24px 60px rgba(0,0,0,0.85)",
  border: "1px solid #1f2937",
  color: "#f9fafb",
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
};

const closeBtn = {
  background: "transparent",
  border: "none",
  color: "#9ca3af",
  cursor: "pointer",
  fontSize: 18,
};

const rowsContainer = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const row = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const rowLabel = {
  width: 80,
  fontSize: 13,
  fontWeight: 600,
};

const swatchRow = {
  display: "flex",
  gap: 8,
};

const swatch = {
  width: 24,
  height: 24,
  borderRadius: 4,
  padding: 0,
  cursor: "pointer",
};

const footerRow = {
  marginTop: 22,
  display: "flex",
  gap: 8,
};

const saveBtn = {
  background: "#22c55e",
  borderRadius: 4,
  border: "none",
  padding: "6px 14px",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const cancelBtn = {
  background: "#ef4444",
  borderRadius: 4,
  border: "none",
  padding: "6px 14px",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};
