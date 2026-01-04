// ============================================
// /pages/modules/email/editor/styles.js
// FULL REPLACEMENT
// ✅ Min readable font sizes (16px+)
// ============================================

export const BRAND_TEXT_COLOURS = [
  { name: "White", value: "#ffffff" },
  { name: "Pale Grey", value: "#a5aab3" },
  { name: "Grey", value: "#6b7280" },
  { name: "Black", value: "#000000" },
  { name: "Yellow", value: "#facc15" },
  { name: "Gold", value: "#eab308" },
  { name: "Orange", value: "#f97318" },
  { name: "Pink", value: "#ec4899" },
  { name: "Red", value: "#ef4444" },
  { name: "Purple", value: "#a855f7" },
  { name: "Ocean", value: "#2297c5" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Navy", value: "#0b1120" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Green", value: "#22c55e" },
  { name: "Bright Green", value: "#32da11" },
];

export const BRAND_BG_COLOURS = [
  { name: "White", value: "#ffffff" },
  { name: "Pale Grey", value: "#f3f4f6" },
  { name: "Dark Grey", value: "#1f2937" },
  { name: "Brand Blue", value: "#3b82f6" },
  { name: "Deep Navy", value: "#0b1120" },
  { name: "Gold", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Red", value: "#ef4444" },
  { name: "Purple", value: "#a855f7" },
];

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const px = (n) => `${parseInt(n || 0, 10)}px`;

export function safeId() {
  return (
    "blk_" +
    Math.random().toString(16).slice(2) +
    "_" +
    Date.now().toString(16)
  );
}

export const UI = {
  topBar: {
    height: 90,
    background: "#3b82f6",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 22px",
  },
  topTitle: { fontSize: 34, fontWeight: 900, lineHeight: 1.1 },
  topSub: { fontSize: 16, opacity: 0.95 },

  topBtn: {
    background: "#111827",
    color: "#fff",
    border: "none",
    padding: "12px 18px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 18,
  },
  topBtnDark: {
    background: "#0b1120",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.25)",
    padding: "12px 18px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 18,
  },

  layout: {
    display: "flex",
    height: "calc(100vh - 90px)",
    background: "#020617",
  },

  left: {
    width: 330,
    padding: 14,
    borderRight: "1px solid rgba(148,163,184,0.15)",
    overflowY: "auto",
  },
  center: { flex: 1, padding: 14, overflowY: "auto" },
  right: {
    width: 380,
    padding: 14,
    borderLeft: "1px solid rgba(148,163,184,0.15)",
    overflowY: "auto",
  },

  panelTitle: { fontSize: 20, fontWeight: 900, color: "#22c55e", marginBottom: 10 },
  panelTitlePurple: { fontSize: 20, fontWeight: 900, color: "#a855f7", marginBottom: 8 },
  help: { fontSize: 16, color: "#e5e7eb", marginBottom: 10, lineHeight: 1.4 },

  blockBtn: {
    width: "100%",
    textAlign: "left",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "#0b1120",
    color: "#fff",
    cursor: "pointer",
    fontSize: 18,
    fontWeight: 800,
  },

  hr: { height: 1, background: "rgba(148,163,184,0.18)", margin: "14px 0" },

  reuseBtn: {
    flex: 1,
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "#0b1120",
    color: "#fff",
    padding: "10px 12px",
    fontSize: 16,
    cursor: "pointer",
    textAlign: "left",
    fontWeight: 800,
  },

  deleteSmall: {
    borderRadius: 999,
    border: "none",
    background: "#7f1d1d",
    color: "#fee2e2",
    padding: "10px 12px",
    fontSize: 14,
    cursor: "pointer",
    fontWeight: 900,
  },

  canvasWrap: {
    background: "#0b1120",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.18)",
    padding: 12,
  },
  canvasTitle: { fontSize: 18, fontWeight: 900, color: "#e5e7eb", marginBottom: 10 },

  dropZone: {
    border: "1px dashed rgba(148,163,184,0.35)",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    background: "rgba(2,6,23,0.4)",
  },
  dropAddBtn: {
    border: "1px solid rgba(148,163,184,0.25)",
    background: "#111827",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 800,
  },

  blockCard: {
    border: "2px solid rgba(148,163,184,0.25)",
    borderRadius: 16,
    background: "#020617",
    overflow: "hidden",
    marginBottom: 10,
    cursor: "pointer",
  },
  blockHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    background: "#111827",
    borderBottom: "1px solid rgba(148,163,184,0.18)",
  },
  blockType: { fontSize: 16, fontWeight: 900, color: "#e5e7eb" },
  dragHandle: {
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    background: "#0b1120",
    border: "1px solid rgba(148,163,184,0.25)",
    color: "#e5e7eb",
    fontSize: 18,
    fontWeight: 900,
  },

  smallBtn: {
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "#0b1120",
    color: "#fff",
    padding: "10px 12px",
    fontSize: 16,
    cursor: "pointer",
    fontWeight: 900,
  },
  smallBtnDanger: {
    borderRadius: 999,
    border: "none",
    background: "#ef4444",
    color: "#0b1120",
    padding: "10px 12px",
    fontSize: 16,
    cursor: "pointer",
    fontWeight: 900,
  },

  card: {
    background: "#0b1120",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 16,
    padding: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: 900, color: "#60a5fa", marginBottom: 10 },

  row: {
    display: "grid",
    gridTemplateColumns: "120px 1fr 70px",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  label: { fontSize: 16, color: "#e5e7eb", fontWeight: 800, marginBottom: 6 },
  value: { fontSize: 16, color: "#e5e7eb", textAlign: "right", fontWeight: 900 },

  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "#111827",
    color: "#fff",
    fontSize: 16,
    outline: "none",
  },
  textarea: {
    width: "100%",
    minHeight: 90,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "#111827",
    color: "#fff",
    fontSize: 16,
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "#111827",
    color: "#fff",
    fontSize: 16,
    outline: "none",
  },
  range: { width: "100%" },

  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  iconBtn: {
    border: "1px solid rgba(148,163,184,0.25)",
    background: "#111827",
    color: "#fff",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 900,
  },
  toolbarSep: { width: 1, height: 26, background: "rgba(148,163,184,0.25)" },

  editorBox: {
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    background: "#ffffff",
    color: "#0b1120",
    fontSize: 16,
    lineHeight: 1.6,
    outline: "none",
  },

  uploadBtn: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 999,
    border: "none",
    background: "linear-gradient(185deg,#22c55e 0%,#3b82f6 50%,#a855f7 100%)",
    color: "#020617",
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
    marginBottom: 10,
  },

  assetGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  assetBtn: {
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: 14,
    background: "#111827",
    padding: 10,
    cursor: "pointer",
    textAlign: "left",
  },

  previewBox: {
    height: 360,
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#ffffff",
  },

  // modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.85)",
    display: "grid",
    placeItems: "center",
    zIndex: 9999,
    padding: 18,
  },
  modal: {
    width: "min(1200px, 100%)",
    background: "#0b1120",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.18)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottom: "1px solid rgba(148,163,184,0.18)",
    color: "#fff",
  },
  closeX: {
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: 22,
    cursor: "pointer",
    fontWeight: 900,
  },
  modalBody: {
    display: "grid",
    gridTemplateColumns: "420px 1fr",
    gap: 14,
    padding: 14,
  },
  modalPreview: {
    height: 520,
    background: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
  },

  existingBox: {
    maxHeight: 200,
    overflowY: "auto",
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: 12,
    padding: 10,
    background: "#111827",
    color: "#fff",
    fontSize: 16,
  },
  existingItem: {
    padding: "8px 8px",
    borderBottom: "1px solid rgba(148,163,184,0.15)",
    cursor: "pointer",
  },

  saveBtn: {
    flex: 1,
    background: "#22c55e",
    border: "none",
    padding: "12px 14px",
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
    color: "#0b1120",
  },
  cancelBtn: {
    flex: 1,
    background: "#64748b",
    border: "none",
    padding: "12px 14px",
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
    color: "#0b1120",
  },

  saveReuseBtn: {
    width: "100%",
    background: "linear-gradient(185deg,#a855f7 0%,#3b82f6 50%,#22c55e 100%)",
    border: "none",
    padding: "12px 14px",
    borderRadius: 999,
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
    color: "#020617",
  },
};
