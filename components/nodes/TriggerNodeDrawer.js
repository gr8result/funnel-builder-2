// /components/nodes/TriggerNodeDrawer.js
// FULL REPLACEMENT — readable, coloured, sane layout

export default function TriggerNodeDrawer({ node, onSave, onClose }) {
  const [label, setLabel] = useState(node.data?.label || "Lead Added");
  const [type, setType] = useState(node.data?.triggerType || "lead_created");

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: 420,
        background: "linear-gradient(180deg,#020617,#020617,#020617)",
        borderLeft: "2px solid #22c55e",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          padding: 20,
          background: "#22c55e",
          color: "#052e16",
          fontSize: 22,
          fontWeight: 900,
        }}
      >
        ⚡ Edit Trigger
      </div>

      {/* CONTENT */}
      <div style={{ padding: 20, flex: 1, overflowY: "auto" }}>
        <label style={lbl}>Trigger Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={input}
        />

        <label style={lbl}>Trigger Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={input}
        >
          <option value="lead_created">Lead Created (Any Source)</option>
        </select>

        <div
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 12,
            background: "#052e16",
            color: "#dcfce7",
            fontSize: 16,
          }}
        >
          This trigger fires immediately when a lead is enrolled into this flow.
        </div>
      </div>

      {/* ACTIONS — MOVED UP */}
      <div
        style={{
          padding: 16,
          borderTop: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          justifyContent: "space-between",
          background: "#020617",
        }}
      >
        <button onClick={onClose} style={cancelBtn}>
          Cancel
        </button>

        <button
          onClick={() =>
            onSave({
              ...node.data,
              label,
              triggerType: type,
            })
          }
          style={saveBtn}
        >
          Save Trigger
        </button>
      </div>
    </div>
  );
}

const lbl = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 8,
  marginTop: 18,
  display: "block",
  color: "#e5e7eb",
};

const input = {
  width: "100%",
  padding: "14px",
  borderRadius: 10,
  fontSize: 16,
  background: "#020617",
  color: "#fff",
  border: "1px solid #334155",
};

const cancelBtn = {
  background: "#334155",
  color: "#fff",
  padding: "12px 20px",
  borderRadius: 999,
  border: "none",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};

const saveBtn = {
  background: "#22c55e",
  color: "#052e16",
  padding: "12px 24px",
  borderRadius: 999,
  border: "none",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
};
