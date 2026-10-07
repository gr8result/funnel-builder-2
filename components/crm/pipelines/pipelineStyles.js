const styles = {
  main: {
    background: "#020617",
    color: "#fff",
    minHeight: "100vh",
    fontFamily:
      'Arial, "Helvetica Neue", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  // wrapper so banner + controls line up with board
  bannerRow: {
    width: "1320px",
    margin: "0 auto 18px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  // main green banner (title + back)
  bannerMain: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderRadius: "16px",
    background: "linear-gradient(175deg,#22c55e 0%,#15803d 100%)",
    boxShadow: "0 14px 35px rgba(0,0,0,0.6)",
  },

  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
  },

  iconCircle: {
    width: "54px",
    height: "54px",
    borderRadius: "10px",
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.25)",
    fontSize: 40,
  },

  // control strip – same shape + gradient as bannerMain
  bannerControls: {
    borderRadius: 16,
    padding: "10px 14px",
    background: "linear-gradient(175deg,#22c55e 0%,#15803d 100%)",
    border: "1px solid rgba(34,197,94,0.85)",
    boxShadow: "0 10px 26px rgba(0,0,0,0.7)",
  },

  bannerControlsInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  },

  compactBtn: {
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: "10px",
    padding: "8px 14px",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
  },

  compactActiveBtn: {
    background: "#f59e0b",
    border: "none",
    borderRadius: "10px",
    padding: "8px 14px",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
  },

  greenBtn: {
    background: "#22c55e",
    border: "none",
    borderRadius: "10px",
    padding: "8px 14px",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
  },

  listPicker: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.32)",
  },

  listLabel: {
    fontSize: 16,
    opacity: 0.9,
  },

  listSelect: {
    fontSize: 16,
    padding: "4px 8px",
    borderRadius: 999,
    border: "none",
    background: "#020617",
    color: "#fff",
  },

  cardStylePicker: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.32)",
  },

  cardStyleLabel: {
    fontSize: 16,
    opacity: 0.9,
    marginRight: 4,
  },

  cardStyleButton: {
    border: "none",
    borderRadius: 999,
    padding: "4px 9px",
    fontSize: 16,
    cursor: "pointer",
    background: "transparent",
    color: "#f9fafb",
  },

  cardStyleButtonActive: {
    border: "none",
    borderRadius: 999,
    padding: "4px 11px",
    fontSize: 16,
    cursor: "pointer",
    background: "#0ea5e9",
    color: "#fff",
    fontWeight: 600,
  },

  pipelineSelector: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.32)",
  },

  pipelineLabel: {
    fontSize: 16,
  },

  pipelineSelect: {
    fontSize: 16,
    padding: "4px 10px",
    borderRadius: 999,
    border: "none",
    background: "#020617",
    color: "#fff",
    minWidth: 220,
  },

  pipelineSmallBtn: {
    background: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    border: "none",
    padding: "4px 8px",
    cursor: "pointer",
    color: "#fff",
    fontSize: 16,
  },

  fileMenuWrapper: {
    position: "relative",
    marginLeft: "auto",
  },

  fileBtn: {
    background: "rgba(0,0,0,0.4)",
    borderRadius: "10px",
    padding: "9px 18px",
    color: "#fff",
    fontWeight: 600,
    border: "1px solid rgba(255,255,255,0.35)",
    cursor: "pointer",
    fontSize: 18,
  },

  fileMenu: {
    position: "absolute",
    top: "110%",
    right: 0,
    background: "#020617",
    borderRadius: "10px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
    padding: "8px 0",
    minWidth: "220px",
    zIndex: 20,
    border: "1px solid rgba(255,255,255,0.15)",
  },

  fileMenuItem: {
    width: "100%",
    padding: "8px 14px",
    textAlign: "left",
    background: "transparent",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
  },

  fileMenuDivider: {
    height: "1px",
    margin: "4px 0",
    background: "rgba(255,255,255,0.15)",
  },

  backBtn: {
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: "10px",
    padding: "8px 14px",
    color: "#fff",
    fontWeight: 500,
    cursor: "pointer",
    fontSize: 18,
  },

  scrollWrap: {
    width: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    padding: "0 12px 8px",
    boxSizing: "border-box",
    scrollbarGutter: "stable both-edges",
  },

  board: {
    display: "inline-flex",
    gap: "22px",
    padding: "0 8px 24px",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    minWidth: "max-content",
    width: "max-content",
  },

  column: {
    flex: "0 0 auto",
    minWidth: "280px",
    maxWidth: "340px",
    borderRadius: "16px",
    padding: "12px",
    minHeight: "calc(100vh - 260px)",
    background: "rgba(15,23,42,0.9)",
  },

  columnCollapsed: {
    flex: "0 0 40px",
    width: "40px",
    borderRadius: "12px",
    minHeight: "calc(100vh - 260px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    background: "rgba(15,23,42,0.9)",
  },

  collapsedText: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%) rotate(-90deg)",
    transformOrigin: "center",
    fontWeight: 600,
    fontSize: 16,
    textAlign: "center",
    width: "160px",
  },

  columnHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "6px",
    marginBottom: "10px",
  },

  collapseBtn: {
    background: "rgba(255,255,255,0.15)",
    border: "none",
    borderRadius: "8px",
    width: "28px",
    height: "28px",
    cursor: "pointer",
    color: "#fff",
    fontWeight: "bold",
  },

  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  card: {
    padding: "10px 12px",
    borderRadius: "14px",
    userSelect: "none",
  },

  cardInner: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    cursor: "pointer",
  },

  dragHandle: {
    fontSize: 16,
    padding: "2px 6px",
    background: "rgba(0,0,0,0.25)",
    borderRadius: "999px",
    marginTop: 2,
  },

  textWrap: {
    margin: 0,
    wordBreak: "break-word",
    fontSize: 16,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  modal: {
    background: "#020617",
    padding: "24px 26px",
    borderRadius: "16px",
    width: "520px",
    maxWidth: "90vw",
    maxHeight: "80vh",
    overflowY: "auto",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 22px 60px rgba(0,0,0,0.8)",
  },

  pipelineModal: {
    background: "#020617",
    padding: "26px 28px",
    borderRadius: "18px",
    width: "560px",
    maxWidth: "92vw",
    maxHeight: "82vh",
    overflowY: "auto",
    border: "1px solid rgba(34,197,94,0.5)",
    boxShadow: "0 26px 70px rgba(0,0,0,0.9)",
  },

  modalTitle: {
    marginTop: 0,
    marginBottom: 10,
    fontSize: 24,
    fontWeight: 600,
  },

  modalText: {
    fontSize: 16,
    lineHeight: 1.5,
    marginBottom: 18,
    opacity: 0.9,
  },

  modalLabel: {
    display: "block",
    marginBottom: 14,
    fontSize: 16,
  },

  modalActionsRight: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 20,
    gap: 10,
  },

  stageRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },

  stageInput: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #444",
    background: "#020617",
    color: "#fff",
    fontSize: 16,
  },

  colorPicker: {
    width: "48px",
    height: "34px",
    borderRadius: "6px",
    border: "1px solid #333",
    cursor: "pointer",
  },

  deleteBtn: {
    background: "#ef4444",
    border: "none",
    borderRadius: "6px",
    padding: "6px 10px",
    cursor: "pointer",
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },

  addBtn: {
    background: "#22c55e",
    border: "none",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "10px",
    fontSize: 16,
  },

  backBtn2: {
    background: "rgba(255,255,255,0.2)",
    borderRadius: "8px",
    padding: "8px 16px",
    color: "#fff",
    cursor: "pointer",
    border: "none",
    fontSize: 16,
  },

  saveBtn: {
    background: "#3b82f6",
    border: "none",
    borderRadius: "8px",
    padding: "8px 18px",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: 16,
  },

  pipelineInput: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.9)",
    background: "#020617",
    color: "#fff",
    fontSize: 16,
  },

  pipelineSelectLarge: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.9)",
    background: "#020617",
    color: "#fff",
    fontSize: 16,
  },
};

export default styles;
