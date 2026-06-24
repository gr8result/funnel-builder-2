export default function WindowDoorSchedule({ schedule, onUpdate, onAdd, onDelete }) {
  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Page 2</div>
          <h3 style={titleStyle}>Windows & Doors</h3>
          <div style={hintStyle}>Openings feed wall deductions, architraves, reveals, sill lengths, painting, and procurement.</div>
        </div>
        <button style={addBtnStyle} onClick={onAdd}>+ Opening</button>
      </div>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {["Item", "Type", "Qty", "Height", "Width", "Area", "Total Area", "Sill", "Head", "Jamb", "Architrave", "Notes", ""].map((label) => (
                <th key={label} style={thStyle}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.rows.map((row, index) => (
              <tr key={row.id} style={index % 2 ? altRowStyle : baseRowStyle}>
                <td style={tdStyle}><input style={inputStyle} value={row.itemName || ""} onChange={(e) => onUpdate(row.id, "itemName", e.target.value)} /></td>
                <td style={tdStyle}>
                  <select style={inputStyle} value={row.type || "Window"} onChange={(e) => onUpdate(row.id, "type", e.target.value)}>
                    {["Window", "Entry Door", "Sliding Door", "Stacker Door", "Garage Door", "Internal Door"].map((option) => <option key={option}>{option}</option>)}
                  </select>
                </td>
                {["quantity", "height", "width"].map((key) => (
                  <td key={key} style={tdStyle}><input style={numberInputStyle} type="number" value={row[key] ?? ""} onChange={(e) => onUpdate(row.id, key, e.target.value)} /></td>
                ))}
                <td style={calcCellStyle}>{row.area}</td>
                <td style={calcCellStyle}>{row.totalArea}</td>
                <td style={calcCellStyle}>{row.sillLength}</td>
                <td style={calcCellStyle}>{row.headLength}</td>
                <td style={calcCellStyle}>{row.jambLength}</td>
                <td style={calcCellStyle}>{row.architraveLength}</td>
                <td style={tdStyle}><input style={notesInputStyle} value={row.notes || ""} onChange={(e) => onUpdate(row.id, "notes", e.target.value)} /></td>
                <td style={tdStyle}><button style={deleteBtnStyle} onClick={() => onDelete(row.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={totalsStyle}>
        <span>Total opening area: <strong>{schedule.totals.windowDoorAreaM2} m2</strong></span>
        <span>Architrave: <strong>{schedule.totals.architraveLengthLm} lm</strong></span>
        <span>Sills: <strong>{schedule.totals.sillLengthLm} lm</strong></span>
        <span>Jambs: <strong>{schedule.totals.jambLengthLm} lm</strong></span>
      </div>
    </div>
  );
}

const cardStyle = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" };
const eyebrowStyle = { color: "#4f46e5", fontSize: 11, fontWeight: 950, letterSpacing: "0.07em", textTransform: "uppercase" };
const titleStyle = { margin: "3px 0 0", color: "#0f172a", fontSize: 22, fontWeight: 950 };
const hintStyle = { color: "#475569", fontSize: 12, fontWeight: 750, lineHeight: 1.4, marginTop: 4 };
const addBtnStyle = { background: "#312e81", color: "#fff", border: "1px solid #312e81", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontWeight: 900, cursor: "pointer" };
const tableWrapStyle = { border: "1px solid #cbd5e1", borderRadius: 9, overflow: "auto", maxHeight: "calc(100vh - 330px)", minHeight: 420 };
const tableStyle = { width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 };
const thStyle = { position: "sticky", top: 0, zIndex: 1, background: "#e2e8f0", color: "#0f172a", textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #94a3b8", fontSize: 11, fontWeight: 950, textTransform: "uppercase" };
const baseRowStyle = { background: "#fff" };
const altRowStyle = { background: "#f8fafc" };
const tdStyle = { padding: "9px 10px", borderBottom: "1px solid #dbe3ec", verticalAlign: "middle" };
const inputStyle = { width: "100%", minWidth: 140, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 8, padding: "8px 9px", color: "#0f172a", fontSize: 13, fontWeight: 800, background: "#fff" };
const numberInputStyle = { ...inputStyle, minWidth: 82 };
const notesInputStyle = { ...inputStyle, minWidth: 180, fontWeight: 700 };
const calcCellStyle = { padding: "9px 10px", borderBottom: "1px solid #dbe3ec", color: "#166534", fontWeight: 950, background: "#f0fdf4", whiteSpace: "nowrap" };
const deleteBtnStyle = { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 7, padding: "7px 9px", fontSize: 12, fontWeight: 850, cursor: "pointer" };
const totalsStyle = { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, color: "#1e293b", fontSize: 13, fontWeight: 800 };
