import { useState } from "react";
import styles from "./pipelineStyles";

export default function StageEditor({ stages, onClose, onSave }) {
  const [localStages, setLocalStages] = useState([...stages]);

  function updateStage(index, field, value) {
    const newStages = [...localStages];
    newStages[index][field] = value;
    setLocalStages(newStages);
  }

  function deleteStage(index) {
    const newStages = localStages.filter((_, i) => i !== index);
    setLocalStages(newStages);
  }

  function addStage() {
    setLocalStages([
      ...localStages,
      {
        id: "stage_" + Date.now(),
        title: "New Stage",
        color: "#ffffff",
      },
    ]);
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <h2 style={styles.modalTitle}>Edit Pipeline Stages</h2>

        {localStages.map((stage, index) => (
          <div key={stage.id} style={styles.stageRow}>
            <input
              type="text"
              value={stage.title}
              onChange={(e) => updateStage(index, "title", e.target.value)}
              style={styles.stageInput}
            />
            <input
              type="color"
              value={stage.color}
              onChange={(e) => updateStage(index, "color", e.target.value)}
              style={styles.colorPicker}
            />
            <button onClick={() => deleteStage(index)} style={styles.deleteBtn}>
              🗑
            </button>
          </div>
        ))}

        <button onClick={addStage} style={styles.addBtn}>
          + Add Stage
        </button>

        <div style={styles.modalActionsRight}>
          <button onClick={onClose} style={styles.backBtn2}>
            Cancel
          </button>
          <button onClick={() => onSave(localStages)} style={styles.saveBtn}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
