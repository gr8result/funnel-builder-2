export default function EstimateWorksheetSection({ section, rows, calculated, onUpdate }) {
  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Raw Inputs</div>
          <h3 style={titleStyle}>{section.label}</h3>
        </div>
        <div style={hintStyle}>Input + calculated value + builder override = final quantity used.</div>
      </div>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Item</th>
              <th style={thStyle}>Input Value</th>
              <th style={thStyle}>Calculated Value</th>
              <th style={thStyle}>Builder Override Quantity</th>
              <th style={thStyle}>Final Quantity Used</th>
              <th style={thStyle}>Unit</th>
              <th style={thStyle}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((schemaRow, index) => {
              const row = rows[schemaRow.key] || {};
              const calculatedValue = calculated.finalQuantities[schemaRow.key]?.calculatedValue ?? "";
              const finalQuantity = calculated.finalQuantities[schemaRow.key]?.finalQuantity ?? "";
              return (
                <tr key={schemaRow.key} style={index % 2 ? altRowStyle : baseRowStyle}>
                  <td style={labelCellStyle}>
                    <div style={labelStyle}>
                      {schemaRow.label}
                      {schemaRow.required && <span style={requiredStyle}>Required</span>}
                    </div>
                  </td>
                  <td style={tdStyle}>{renderInput(schemaRow, row.inputValue, (value) => onUpdate(schemaRow.key, "inputValue", value))}</td>
                  <td style={calcCellStyle}>{formatValue(calculatedValue)}</td>
                  <td style={tdStyle}>
                    <input
                      style={overrideInputStyle}
                      value={row.builderOverrideQuantity ?? ""}
                      placeholder="Optional"
                      onChange={(event) => onUpdate(schemaRow.key, "builderOverrideQuantity", event.target.value)}
                    />
                  </td>
                  <td style={finalCellStyle}>{formatValue(finalQuantity)}</td>
                  <td style={unitCellStyle}>{schemaRow.unit}</td>
                  <td style={tdStyle}>
                    <input
                      style={notesInputStyle}
                      value={row.notes ?? ""}
                      placeholder="Notes"
                      onChange={(event) => onUpdate(schemaRow.key, "notes", event.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderInput(schemaRow, value, onChange) {
  if (schemaRow.type === "calculated") return <span style={calcOnlyStyle}>Calculated</span>;
  if (schemaRow.type === "select") {
    return (
      <select style={inputStyle} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        {schemaRow.options.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }
  if (schemaRow.type === "checkbox") {
    return <input style={checkboxStyle} type="checkbox" checked={!!value} onChange={(event) => onChange(event.target.checked)} />;
  }
  return <input style={inputStyle} type={schemaRow.type === "number" ? "number" : "text"} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
}

function formatValue(value) {
  if (value === "" || value === null || value === undefined) return "-";
  return value;
}

const cardStyle = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" };
const eyebrowStyle = { color: "#4f46e5", fontSize: 11, fontWeight: 950, letterSpacing: "0.07em", textTransform: "uppercase" };
const titleStyle = { margin: "3px 0 0", color: "#0f172a", fontSize: 22, fontWeight: 950 };
const hintStyle = { maxWidth: 360, color: "#475569", fontSize: 12, fontWeight: 750, lineHeight: 1.4 };
const tableWrapStyle = { border: "1px solid #cbd5e1", borderRadius: 9, overflow: "auto", maxHeight: "calc(100vh - 330px)", minHeight: 420 };
const tableStyle = { width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 };
const thStyle = { position: "sticky", top: 0, zIndex: 1, background: "#e2e8f0", color: "#0f172a", textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #94a3b8", fontSize: 11, fontWeight: 950, textTransform: "uppercase" };
const baseRowStyle = { background: "#fff" };
const altRowStyle = { background: "#f8fafc" };
const tdStyle = { padding: "9px 10px", borderBottom: "1px solid #dbe3ec", verticalAlign: "middle" };
const labelCellStyle = { ...tdStyle, minWidth: 210 };
const labelStyle = { display: "flex", alignItems: "center", gap: 8, color: "#0f172a", fontSize: 13, fontWeight: 900 };
const requiredStyle = { background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: 999, padding: "2px 7px", fontSize: 10, fontWeight: 950 };
const inputStyle = { width: "100%", minWidth: 120, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 8, padding: "8px 9px", color: "#0f172a", fontSize: 13, fontWeight: 800, background: "#fff" };
const overrideInputStyle = { ...inputStyle, borderColor: "#7c3aed", background: "#faf5ff" };
const notesInputStyle = { ...inputStyle, minWidth: 160, fontWeight: 700 };
const calcCellStyle = { ...tdStyle, color: "#1e293b", fontWeight: 850, background: "#f1f5f9" };
const finalCellStyle = { ...tdStyle, color: "#166534", fontWeight: 950, background: "#f0fdf4" };
const unitCellStyle = { ...tdStyle, color: "#475569", fontWeight: 850 };
const calcOnlyStyle = { color: "#475569", fontSize: 12, fontWeight: 850, fontStyle: "italic" };
const checkboxStyle = { width: 18, height: 18, accentColor: "#4f46e5" };
