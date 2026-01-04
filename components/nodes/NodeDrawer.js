// /components/nodes/NodeDrawer.js
import { useState } from "react";

export default function NodeDrawer({ node, onSave, onClose }) {
  const [params, setParams] = useState(node?.data?.params || {});

  const update = (key, val) => setParams({ ...params, [key]: val });

  if (!node) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        height: "100%",
        width: 300,
        background: "#0c121a",
        borderLeft: "1px solid #222",
        color: "#fff",
        padding: 20,
        zIndex: 9999,
      }}
    >
      <h3 style={{ marginBottom: 10 }}>{node.data.label}</h3>

      {node.type === "condition" && (
        <>
          <label>Event Type:</label>
          <input
            value={params.event_type || ""}
            onChange={(e) => update("event_type", e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <label>True Path Node ID:</label>
          <input
            value={params.true_path || ""}
            onChange={(e) => update("true_path", e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <label>False Path Node ID:</label>
          <input
            value={params.false_path || ""}
            onChange={(e) => update("false_path", e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />
        </>
      )}

      {node.type === "delay" && (
        <>
          <label>Amount:</label>
          <input
            type="number"
            value={params.amount || 1}
            onChange={(e) => update("amount", Number(e.target.value))}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <label>Unit:</label>
          <select
            value={params.unit || "days"}
            onChange={(e) => update("unit", e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          >
            <option value="hours">Hours</option>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
          </select>
        </>
      )}

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button
          onClick={() => onSave(params)}
          style={{
            background: "#22c55e",
            border: "none",
            padding: "8px 12px",
            color: "#fff",
            borderRadius: 4,
          }}
        >
          Save
        </button>
        <button
          onClick={onClose}
          style={{
            background: "#444",
            border: "none",
            padding: "8px 12px",
            color: "#fff",
            borderRadius: 4,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
