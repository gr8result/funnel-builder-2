import { useState } from "react";
import styles from "./pipelineStyles";
import { buildDefaultTeams } from "./pipelineSharedHelpers";

export default function TeamManagerModal({ teams, onClose, onSave }) {
  const [localTeams, setLocalTeams] = useState(
    Array.isArray(teams) && teams.length ? [...teams] : buildDefaultTeams()
  );

  function updateTeam(index, field, value) {
    const next = [...localTeams];
    next[index] = { ...next[index], [field]: value };
    setLocalTeams(next);
  }

  function addTeam() {
    setLocalTeams((prev) => [
      ...prev,
      {
        id: `team_${Date.now()}`,
        name: "New Team",
        manager: "",
        members: "",
        target: 0,
        color: "#22c55e",
      },
    ]);
  }

  function deleteTeam(index) {
    setLocalTeams((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <h2 style={styles.modalTitle}>Sales Teams</h2>
        <p style={styles.modalText}>
          Manage teams, managers, members, and revenue targets without changing the board layout.
        </p>

        {localTeams.map((team, index) => (
          <div key={team.id} style={{ ...styles.stageRow, gridTemplateColumns: "1.3fr 1fr 1fr 120px 64px 52px", alignItems: "center" }}>
            <input
              type="text"
              value={team.name}
              onChange={(e) => updateTeam(index, "name", e.target.value)}
              style={styles.stageInput}
              placeholder="Team name"
            />
            <input
              type="text"
              value={team.manager || ""}
              onChange={(e) => updateTeam(index, "manager", e.target.value)}
              style={styles.stageInput}
              placeholder="Manager"
            />
            <input
              type="text"
              value={team.members || ""}
              onChange={(e) => updateTeam(index, "members", e.target.value)}
              style={styles.stageInput}
              placeholder="Members (comma-separated)"
            />
            <input
              type="number"
              min="0"
              value={team.target || 0}
              onChange={(e) => updateTeam(index, "target", e.target.value)}
              style={styles.stageInput}
              placeholder="Target"
            />
            <input
              type="color"
              value={team.color || "#22c55e"}
              onChange={(e) => updateTeam(index, "color", e.target.value)}
              style={styles.colorPicker}
            />
            <button onClick={() => deleteTeam(index)} style={styles.deleteBtn}>🗑</button>
          </div>
        ))}

        <button onClick={addTeam} style={styles.addBtn}>+ Add Team</button>

        <div style={styles.modalActionsRight}>
          <button onClick={onClose} style={styles.backBtn2}>Cancel</button>
          <button onClick={() => onSave(localTeams)} style={styles.saveBtn}>Save Teams</button>
        </div>
      </div>
    </div>
  );
}
