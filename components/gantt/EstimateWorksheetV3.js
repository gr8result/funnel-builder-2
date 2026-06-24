import { useEstimateWorksheetV3 } from "../../hooks/gantt/useEstimateWorksheetV3";

export default function EstimateWorksheetV3({ plannerAnswers, onBack, onClose }) {
  const sheet = useEstimateWorksheetV3(plannerAnswers);

  return (
    <div style={shellStyle}>
      <aside style={navStyle}>
        <div style={eyebrowStyle}>Estimate Worksheet V3</div>
        <h3 style={navTitleStyle}>Excel Layout</h3>
        {sheet.pages.map((page) => (
          <button key={page.key} style={{ ...pageBtnStyle, ...(sheet.worksheet.page === page.key ? activeBtnStyle : {}) }} onClick={() => sheet.setPage(page.key)}>
            {page.label}
          </button>
        ))}
        {sheet.worksheet.page === "dataInput" && (
          <div style={sectionJumpStyle}>
            {sheet.dataSections.map((section) => (
              <button key={section.key} style={jumpBtnStyle} onClick={() => sheet.setActiveSection(section.key)}>{section.label}</button>
            ))}
          </div>
        )}
        <div style={actionsStyle}>
          <button style={secondaryBtnStyle} onClick={onBack}>Back</button>
          <button style={secondaryBtnStyle} onClick={onClose}>Close</button>
        </div>
      </aside>

      <main style={mainStyle}>
        <div style={topBarStyle}>
          <div><strong>{currentTitle(sheet)}</strong><span>Preview-only. Rates and costs are placeholders.</span></div>
          <div style={pillStyle}>{sheet.preview.missingRequired.length} missing required</div>
        </div>
        {sheet.worksheet.page === "dataInput" && <DataInputPage sheet={sheet} />}
        {sheet.worksheet.page === "windowsDoors" && <WindowsDoorsPage sheet={sheet} />}
        {sheet.worksheet.page === "quotation" && <QuotationPage sheet={sheet} />}
        {sheet.worksheet.page === "summary" && <SummaryPage sheet={sheet} />}
      </main>

      <aside style={summaryStyle}>
        <div style={eyebrowStyle}>Live Preview</div>
        <h3 style={summaryTitleStyle}>Key Outputs</h3>
        <SummaryBlock title="Calculated Areas">
          {Object.entries(sheet.preview.calculated).slice(0, 10).map(([key, value]) => <Row key={key} label={pretty(key)} value={value} />)}
        </SummaryBlock>
        <SummaryBlock title="Windows & Doors">
          <Row label="Total area" value={`${sheet.preview.windowDoors.totals.totalArea} M2`} />
          <Row label="Architrave" value={`${sheet.preview.windowDoors.totals.architraveLength} LM`} />
          <Row label="Reveal" value={`${sheet.preview.windowDoors.totals.revealLength} LM`} />
          <Row label="Sill" value={`${sheet.preview.windowDoors.totals.sillLength} LM`} />
        </SummaryBlock>
        <SummaryBlock title="Missing Required Inputs">
          {sheet.preview.missingRequired.length ? sheet.preview.missingRequired.map((item) => (
            <span key={`${item.section}-${item.key}`} style={warnStyle}>{pretty(item.section)}: {pretty(item.key)}</span>
          )) : <span style={okStyle}>Complete</span>}
        </SummaryBlock>
      </aside>
    </div>
  );
}

function DataInputPage({ sheet }) {
  return (
    <div style={spreadsheetStyle}>
      {sheet.dataSections.map((section) => {
        const rows = sheet.worksheet.sections[section.key].rows;
        const collapsed = sheet.worksheet.sections[section.key].collapsed;
        return (
          <section key={section.key} style={sheetSectionStyle}>
            <button style={sectionHeaderStyle} onClick={() => sheet.toggleDataSection(section.key)}>
              <span>{collapsed ? "+" : "-"}</span>{section.label}
            </button>
            {!collapsed && (
              <GridTable headers={["Item", "Input Value", "Calculated", "Builder Override Quantity", "Final Quantity Used", "Unit", "Notes"]}>
                {section.rows.map((row) => (
                  <tr key={row.key}>
                    <Cell strong>{row.label}{row.required ? " *" : ""}</Cell>
                    <Cell>{renderDataInput(row, rows[row.key]?.inputValue, (value) => sheet.updateDataRow(section.key, row.key, "inputValue", value))}</Cell>
                    <Cell calc>{row.calculated ? valueOrDash(sheet.preview.calculated[row.key]) : "-"}</Cell>
                    <Cell>{!row.calculated && <input style={inputStyle} value={rows[row.key]?.builderOverrideQuantity ?? ""} onChange={(e) => sheet.updateDataRow(section.key, row.key, "builderOverrideQuantity", e.target.value)} />}</Cell>
                    <Cell final>{valueOrDash(sheet.preview.finalQuantities[row.key])}</Cell>
                    <Cell>{row.unit}</Cell>
                    <Cell><input style={inputStyle} value={rows[row.key]?.notes ?? ""} onChange={(e) => sheet.updateDataRow(section.key, row.key, "notes", e.target.value)} /></Cell>
                  </tr>
                ))}
              </GridTable>
            )}
          </section>
        );
      })}
    </div>
  );
}

function WindowsDoorsPage({ sheet }) {
  return (
    <div style={spreadsheetStyle}>
      <button style={addBtnStyle} onClick={sheet.addWindowDoor}>+ Add Window/Door</button>
      <GridTable headers={["Code", "Type", "Qty", "Width", "Height", "Area", "Total Area", "Head", "Sill", "Jamb", "Architrave", "Reveal", "Notes", ""]}>
        {sheet.preview.windowDoors.rows.map((row) => (
          <tr key={row.id}>
            <Cell><input style={codeInputStyle} value={row.code || ""} onChange={(e) => sheet.updateWindowDoor(row.id, "code", e.target.value)} /></Cell>
            <Cell><select style={inputStyle} value={row.type} onChange={(e) => sheet.updateWindowDoor(row.id, "type", e.target.value)}>{sheet.windowDoorTypes.map((type) => <option key={type}>{type}</option>)}</select></Cell>
            {["quantity", "width", "height"].map((key) => <Cell key={key}><input style={numberInputStyle} type="number" value={row[key]} onChange={(e) => sheet.updateWindowDoor(row.id, key, e.target.value)} /></Cell>)}
            {["area", "totalArea", "headLength", "sillLength", "jambLength", "architraveLength", "revealLength"].map((key) => <Cell key={key} calc>{row[key]}</Cell>)}
            <Cell><input style={inputStyle} value={row.notes || ""} onChange={(e) => sheet.updateWindowDoor(row.id, "notes", e.target.value)} /></Cell>
            <Cell><button style={deleteBtnStyle} onClick={() => sheet.deleteWindowDoor(row.id)}>Delete</button></Cell>
          </tr>
        ))}
      </GridTable>
    </div>
  );
}

function QuotationPage({ sheet }) {
  return (
    <div style={spreadsheetStyle}>
      {sheet.quotationSections.map((section) => {
        const group = sheet.preview.quotation[section];
        return (
          <section key={section} style={sheetSectionStyle}>
            <button style={sectionHeaderStyle} onClick={() => sheet.toggleQuotationSection(section)}>
              <span>{group.collapsed ? "+" : "-"}</span>{section}<strong>Subtotal: placeholder</strong>
            </button>
            {!group.collapsed && (
              <GridTable headers={["Item", "Quantity", "Type / Unit", "Rate", "Cost", "Notes"]}>
                {group.rows.map((row) => (
                  <tr key={row.id}>
                    <Cell><input style={inputStyle} value={row.item} onChange={(e) => sheet.updateQuotationRow(section, row.id, "item", e.target.value)} /></Cell>
                    <Cell calc>{valueOrDash(row.quantity)}</Cell>
                    <Cell><select style={inputStyle} value={row.unit} onChange={(e) => sheet.updateQuotationRow(section, row.id, "unit", e.target.value)}>{["LM", "M2", "M3", "EACH", "ITEM", "DAY", "HOUR"].map((unit) => <option key={unit}>{unit}</option>)}</select></Cell>
                    <Cell><input style={inputStyle} value={row.rate} placeholder="Placeholder" onChange={(e) => sheet.updateQuotationRow(section, row.id, "rate", e.target.value)} /></Cell>
                    <Cell calc>Placeholder</Cell>
                    <Cell><input style={inputStyle} value={row.notes} onChange={(e) => sheet.updateQuotationRow(section, row.id, "notes", e.target.value)} /></Cell>
                  </tr>
                ))}
                <tr><Cell strong>Subtotal</Cell><Cell /><Cell /><Cell /><Cell final>Placeholder</Cell><Cell /></tr>
              </GridTable>
            )}
          </section>
        );
      })}
    </div>
  );
}

function SummaryPage({ sheet }) {
  return (
    <div style={spreadsheetStyle}>
      <GridTable headers={["Section", "Total"]}>
        {sheet.quotationSections.map((section) => <tr key={section}><Cell strong>{section}</Cell><Cell final>Placeholder</Cell></tr>)}
        <tr><Cell strong>Grand Total</Cell><Cell final>Placeholder</Cell></tr>
      </GridTable>
    </div>
  );
}

function GridTable({ headers, children }) {
  return <div style={tableWrapStyle}><table style={tableStyle}><thead><tr>{headers.map((header) => <th key={header} style={thStyle}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function Cell({ children, strong, calc, final }) {
  return <td style={{ ...tdStyle, ...(strong ? strongCellStyle : {}), ...(calc ? calcCellStyle : {}), ...(final ? finalCellStyle : {}) }}>{children}</td>;
}

function Row({ label, value }) {
  return <div style={summaryRowStyle}><span>{label}</span><strong>{value}</strong></div>;
}

function SummaryBlock({ title, children }) {
  return <div style={summaryBlockStyle}><div style={blockTitleStyle}>{title}</div><div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{children}</div></div>;
}

function renderDataInput(row, value, onChange) {
  if (row.calculated) return <span style={mutedStyle}>Read-only calculated</span>;
  if (row.options) return <select style={inputStyle} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>{row.options.map((option) => <option key={option}>{option}</option>)}</select>;
  return <input style={inputStyle} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

function currentTitle(sheet) {
  return sheet.pages.find((page) => page.key === sheet.worksheet.page)?.label || "Estimate Worksheet V3";
}

function valueOrDash(value) { return value === "" || value === undefined || value === null ? "-" : value; }
function pretty(value) { return String(value).replace(/M2/g, " m2").replace(/Lm/g, " lm").replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()); }

const shellStyle = { display: "grid", gridTemplateColumns: "260px minmax(780px, 1fr) 330px", gap: 16, alignItems: "start" };
const navStyle = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 };
const mainStyle = { minWidth: 0 };
const summaryStyle = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 };
const eyebrowStyle = { color: "#2563eb", fontSize: 11, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.06em" };
const navTitleStyle = { margin: "3px 0 10px", color: "#0f172a", fontSize: 18, fontWeight: 950 };
const pageBtnStyle = { width: "100%", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 7, padding: "9px 10px", marginBottom: 7, textAlign: "left", color: "#0f172a", fontWeight: 900, cursor: "pointer" };
const activeBtnStyle = { background: "#1e3a8a", borderColor: "#1e3a8a", color: "#fff" };
const sectionJumpStyle = { display: "flex", flexDirection: "column", gap: 4, margin: "4px 0 10px 12px" };
const jumpBtnStyle = { background: "#fff", border: "1px solid #e2e8f0", color: "#334155", borderRadius: 6, padding: "6px 8px", textAlign: "left", fontSize: 12, fontWeight: 800, cursor: "pointer" };
const actionsStyle = { display: "flex", gap: 8, marginTop: 12 };
const secondaryBtnStyle = { background: "#fff", border: "1px solid #cbd5e1", color: "#334155", borderRadius: 7, padding: "8px 10px", fontWeight: 850, cursor: "pointer" };
const topBarStyle = { position: "sticky", top: 0, zIndex: 5, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 12, color: "#0f172a" };
const pillStyle = { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 900 };
const spreadsheetStyle = { display: "flex", flexDirection: "column", gap: 8 };
const sheetSectionStyle = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden" };
const sectionHeaderStyle = { width: "100%", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", background: "#dbeafe", border: "none", borderBottom: "1px solid #bfdbfe", color: "#0f172a", padding: "8px 10px", fontWeight: 950, cursor: "pointer", textAlign: "left" };
const tableWrapStyle = { overflow: "auto", maxHeight: "calc(100vh - 275px)" };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const thStyle = { position: "sticky", top: 0, background: "#e2e8f0", color: "#0f172a", padding: "7px 8px", border: "1px solid #cbd5e1", textAlign: "left", fontWeight: 950, whiteSpace: "nowrap" };
const tdStyle = { padding: "5px 6px", border: "1px solid #e2e8f0", color: "#0f172a", verticalAlign: "middle" };
const strongCellStyle = { fontWeight: 900, background: "#f8fafc" };
const calcCellStyle = { background: "#f1f5f9", fontWeight: 850, color: "#1e293b" };
const finalCellStyle = { background: "#dcfce7", fontWeight: 950, color: "#166534" };
const inputStyle = { width: "100%", minWidth: 90, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 4, padding: "5px 6px", color: "#0f172a", fontSize: 12, fontWeight: 800, background: "#fff" };
const numberInputStyle = { ...inputStyle, minWidth: 72 };
const codeInputStyle = { ...inputStyle, minWidth: 76 };
const mutedStyle = { color: "#64748b", fontWeight: 800 };
const addBtnStyle = { alignSelf: "flex-start", background: "#1e3a8a", color: "#fff", border: "1px solid #1e3a8a", borderRadius: 7, padding: "8px 11px", fontWeight: 900, cursor: "pointer" };
const deleteBtnStyle = { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 7px", fontWeight: 850, cursor: "pointer" };
const summaryTitleStyle = { margin: "3px 0 10px", color: "#0f172a", fontSize: 18, fontWeight: 950 };
const summaryBlockStyle = { background: "#f8fafc", border: "1px solid #dbe3ec", borderRadius: 8, padding: 10, marginBottom: 10 };
const blockTitleStyle = { color: "#0f172a", fontSize: 12, fontWeight: 950, textTransform: "uppercase", marginBottom: 7 };
const summaryRowStyle = { display: "flex", justifyContent: "space-between", gap: 8, color: "#1e293b", fontSize: 12, borderBottom: "1px solid #dbe3ec", paddingBottom: 4 };
const warnStyle = { background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: 999, padding: "5px 8px", fontSize: 12, fontWeight: 900 };
const okStyle = { background: "#dcfce7", border: "1px solid #86efac", color: "#166534", borderRadius: 999, padding: "5px 8px", fontSize: 12, fontWeight: 900 };
