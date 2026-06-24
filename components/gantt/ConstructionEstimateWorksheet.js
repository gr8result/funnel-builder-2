import { useConstructionEstimateWorksheet } from "../../hooks/gantt/useConstructionEstimateWorksheet";

export default function ConstructionEstimateWorksheet({ S, plannerAnswers, fullScreen = false, onBack, onClose }) {
  const worksheet = useConstructionEstimateWorksheet(plannerAnswers);
  const active = worksheet.sections.find((section) => section.key === worksheet.activeSection) || worksheet.sections[0];
  const activeInput = worksheet.worksheetInput[active.key];

  return (
    <div style={fullScreen ? worksheetShellFullStyle : worksheetShellStyle}>
      <aside style={panelStyle}>
        <div style={sectionTitleStyle}>Estimate Worksheet</div>
        <div style={navHelpStyle}>Work through each trade section. Required fields are marked in red.</div>
        <div style={navListStyle}>
        {worksheet.sections.map((section, index) => (
          <button
            key={section.key}
            type="button"
            style={{
              ...navBtnStyle,
              ...(worksheet.activeSection === section.key ? navBtnActiveStyle : {}),
            }}
            onClick={() => worksheet.setActiveSection(section.key)}
          >
            <span style={navNumberStyle}>{index + 1}</span>
            <span>{section.label}</span>
          </button>
        ))}
        </div>
      </aside>

      <main style={panelStyle}>
        <div style={headerRowStyle}>
          <div>
            <div style={sectionEyebrowStyle}>Worksheet Section</div>
            <h3 style={sectionHeaderStyle}>{active.label}</h3>
            <div style={helpTextStyle}>Enter known quantities, use overrides where the calculated/input value needs to be forced, and keep pricing placeholders only.</div>
          </div>
          <div style={toggleGroupStyle}>
            <label style={toggleStyle}>
              <input
                type="checkbox"
                checked={!!activeInput.included}
                onChange={(event) => worksheet.updateSectionMeta(active.key, "included", event.target.checked)}
              />
              Included
            </label>
            {active.allowanceCapable && (
              <>
                <label style={toggleStyle}>
                  <input
                    type="checkbox"
                    checked={!!activeInput.allowance}
                    onChange={(event) => worksheet.updateSectionMeta(active.key, "allowance", event.target.checked)}
                  />
                  Allowance
                </label>
                <label style={toggleStyle}>
                  <input
                    type="checkbox"
                    checked={!!activeInput.provisionalSum}
                    onChange={(event) => worksheet.updateSectionMeta(active.key, "provisionalSum", event.target.checked)}
                />
                PS
              </label>
            </>
            )}
          </div>
        </div>

        <div style={fullScreen ? tableWrapFullStyle : tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Input Value</th>
                <th style={thStyle}>Manual Override</th>
              </tr>
            </thead>
            <tbody>
              {active.fields.map((field, index) => (
                <tr key={field.key} style={index % 2 ? rowAltStyle : rowBaseStyle}>
                  <td style={labelTdStyle}>
                    <div style={fieldLabelStyle}>
                      {field.label}
                      {field.required && <span style={requiredBadgeStyle}>Required</span>}
                    </div>
                    <div style={fieldKeyStyle}>{pretty(field.key)}</div>
                  </td>
                  <td style={tdStyle}>{renderInput(field, active.key, activeInput.values[field.key], worksheet.updateValue)}</td>
                  <td style={tdStyle}>
                    {field.type === "checkbox" ? (
                      <span style={emptyHintStyle}>Use the input toggle</span>
                    ) : (
                      <input
                        style={overrideInputStyle}
                        type={field.type === "number" ? "number" : "text"}
                        value={activeInput.overrides[field.key] ?? ""}
                        placeholder="Optional"
                        onChange={(event) => worksheet.updateOverride(active.key, field.key, event.target.value)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label style={notesCardStyle}>
          <span style={notesLabelStyle}>Section Notes</span>
          <textarea
            style={notesInputStyle}
            value={activeInput.notes}
            placeholder="Notes, exclusions, supplier comments, selection assumptions..."
            onChange={(event) => worksheet.updateSectionMeta(active.key, "notes", event.target.value)}
          />
        </label>

        <div style={{ ...S.modalActions, marginTop: 16 }}>
          <button style={S.cancelBtn} onClick={onBack}>Back to Planner</button>
          <button style={S.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </main>

      <aside style={panelStyle}>
        <div style={sectionEyebrowStyle}>Live Preview</div>
        <h3 style={summaryHeaderStyle}>Worksheet Summary</h3>
        <div style={summaryHelpStyle}>Updates from the current worksheet inputs. No values are saved or priced.</div>
        <SummaryBlock title="Missing Required Fields">
          {worksheet.summary.missingRequired.length ? worksheet.summary.missingRequired.map((item) => (
            <span key={`${item.section}-${item.key}`} style={warnPillStyle}>{pretty(item.section)}: {pretty(item.key)}</span>
          )) : <span style={okTextStyle}>Required fields complete.</span>}
        </SummaryBlock>

        <SummaryBlock title="Calculated Quantities">
          {worksheet.summary.quantitySummary.map(([label, value, unit]) => (
            <div key={label} style={rowStyle}><span>{label}</span><strong>{value} {unit}</strong></div>
          ))}
        </SummaryBlock>

        <SummaryBlock title="Long-Lead Procurement">
          {worksheet.summary.longLeadItems.length ? worksheet.summary.longLeadItems.slice(0, 6).map((item) => (
            <div key={item.materialId} style={rowStyle}><span>{item.name}</span><strong>{item.leadTimeDays}d</strong></div>
          )) : <span style={emptyHintStyle}>No long-lead warnings yet.</span>}
        </SummaryBlock>

        <SummaryBlock title="Duration Impact">
          <div style={rowStyle}><span>Estimated contract</span><strong>{worksheet.contractDuration.estimatedContractDays}d</strong></div>
          {worksheet.summary.durationImpact.length ? worksheet.summary.durationImpact.map((item) => (
            <div key={item.reason} style={rowStyle}><span>{item.reason}</span><strong>+{item.days}d</strong></div>
          )) : <span style={emptyHintStyle}>No complexity adjustments applied.</span>}
        </SummaryBlock>

        <SummaryBlock title="PC / PS Placeholders">
          <div style={rowStyle}><span>PC items</span><strong>{worksheet.summary.allowancePlaceholders.pcItems}</strong></div>
          <div style={rowStyle}><span>Provisional sums</span><strong>{worksheet.summary.allowancePlaceholders.provisionalSums}</strong></div>
          <span style={mutedStyle}>Pricing is intentionally disabled for Stage 3.</span>
        </SummaryBlock>
      </aside>

      <section style={{ ...panelStyle, gridColumn: "1 / -1" }}>
        <div style={sectionEyebrowStyle}>Generated Output</div>
        <h3 style={summaryHeaderStyle}>Preview Output</h3>
        <div style={summaryHelpStyle}>This is what the worksheet currently feeds into the quantity, takeoff, procurement, and duration engines.</div>
        <div style={previewGridStyle}>
          <PreviewList title="Selected Assemblies" items={worksheet.assemblies.map((item) => `${item.name} - ${item.trade}`)} />
          <PreviewList title="Material Takeoff Groups" items={worksheet.takeoffGroups.map((group) => `${group.category}: ${group.items.length} item${group.items.length !== 1 ? "s" : ""}`)} />
          <PreviewList title="Procurement" items={worksheet.procurementItems.slice(0, 8).map((item) => `${item.name}: order by day ${item.orderByDay}`)} />
          <PreviewList title="Detailed Quantities" items={Object.entries(worksheet.quantities.detailed || {}).map(([key, value]) => `${pretty(key)}: ${value}`)} />
        </div>
      </section>
    </div>
  );
}

function renderInput(field, sectionKey, value, updateValue) {
  if (field.type === "select") {
    return <select style={inputStyle} value={value ?? ""} onChange={(event) => updateValue(sectionKey, field.key, event.target.value)}>{field.options.map((option) => <option key={option}>{option}</option>)}</select>;
  }
  if (field.type === "checkbox") {
    return <input style={checkboxStyle} type="checkbox" checked={!!value} onChange={(event) => updateValue(sectionKey, field.key, event.target.checked)} />;
  }
  return <input style={inputStyle} type={field.type} value={value ?? ""} onChange={(event) => updateValue(sectionKey, field.key, event.target.value)} />;
}

function SummaryBlock({ title, children }) {
  return <div style={summaryBlockStyle}><div style={summaryTitleStyle}>{title}</div><div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{children}</div></div>;
}

function PreviewList({ title, items }) {
  return <div style={miniPanelStyle}><div style={summaryTitleStyle}>{title}</div>{items.length ? items.map((item) => <div key={item} style={mutedLineStyle}>{item}</div>) : <div style={mutedStyle}>No items.</div>}</div>;
}

function pretty(value) {
  return String(value).replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

const worksheetShellStyle = { display: "grid", gridTemplateColumns: "250px minmax(0, 1fr) 330px", gap: 18, alignItems: "start" };
const worksheetShellFullStyle = { display: "grid", gridTemplateColumns: "280px minmax(720px, 1fr) 360px", gap: 22, alignItems: "start" };
const panelStyle = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, minWidth: 0, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" };
const sectionTitleStyle = { color: "#0f172a", fontSize: 14, fontWeight: 950, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" };
const navHelpStyle = { color: "#475569", fontSize: 12, fontWeight: 750, lineHeight: 1.35, marginBottom: 12 };
const navListStyle = { display: "flex", flexDirection: "column", gap: 5 };
const navBtnStyle = { width: "100%", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#1e293b", borderRadius: 8, padding: "9px 10px", textAlign: "left", fontSize: 13, fontWeight: 850, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 };
const navBtnActiveStyle = { background: "#312e81", borderColor: "#312e81", color: "#fff", boxShadow: "0 2px 8px rgba(49,46,129,0.22)" };
const navNumberStyle = { width: 22, height: 22, borderRadius: 999, background: "rgba(255,255,255,0.28)", border: "1px solid rgba(148,163,184,0.35)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 950, flexShrink: 0 };
const headerRowStyle = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #e2e8f0" };
const sectionEyebrowStyle = { color: "#4f46e5", fontSize: 11, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 };
const sectionHeaderStyle = { margin: 0, color: "#0f172a", fontSize: 22, fontWeight: 950, lineHeight: 1.15 };
const helpTextStyle = { color: "#475569", fontSize: 13, fontWeight: 750, lineHeight: 1.45, marginTop: 6, maxWidth: 650 };
const mutedStyle = { color: "#475569", fontSize: 12, fontWeight: 750 };
const tableWrapStyle = { border: "1px solid #cbd5e1", borderRadius: 10, overflow: "auto", maxHeight: 460, background: "#fff" };
const tableWrapFullStyle = { ...tableWrapStyle, maxHeight: "calc(100vh - 360px)", minHeight: 420 };
const tableStyle = { width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 };
const thStyle = { position: "sticky", top: 0, background: "#e2e8f0", color: "#0f172a", textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #94a3b8", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.04em", zIndex: 1 };
const rowBaseStyle = { background: "#fff" };
const rowAltStyle = { background: "#f8fafc" };
const tdStyle = { padding: "10px 12px", borderBottom: "1px solid #dbe3ec", verticalAlign: "middle", color: "#0f172a" };
const labelTdStyle = { ...tdStyle, minWidth: 210 };
const fieldLabelStyle = { display: "flex", alignItems: "center", gap: 8, color: "#0f172a", fontSize: 14, fontWeight: 900 };
const fieldKeyStyle = { color: "#64748b", fontSize: 11, fontWeight: 750, marginTop: 3 };
const requiredBadgeStyle = { background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: 999, padding: "2px 7px", fontSize: 10, fontWeight: 950, textTransform: "uppercase" };
const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 8, padding: "9px 10px", fontSize: 14, fontWeight: 800, color: "#0f172a", background: "#fff", outline: "none", boxShadow: "inset 0 1px 2px rgba(15,23,42,0.05)" };
const overrideInputStyle = { ...inputStyle, borderColor: "#7c3aed", background: "#faf5ff" };
const checkboxStyle = { width: 18, height: 18, accentColor: "#4f46e5" };
const toggleGroupStyle = { display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" };
const toggleStyle = { display: "inline-flex", alignItems: "center", gap: 6, color: "#0f172a", fontSize: 12, fontWeight: 900, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 999, padding: "7px 10px" };
const notesCardStyle = { marginTop: 14, display: "flex", flexDirection: "column", gap: 7, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10, padding: 12 };
const notesLabelStyle = { color: "#0f172a", fontSize: 13, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.04em" };
const notesInputStyle = { width: "100%", boxSizing: "border-box", minHeight: 84, resize: "vertical", border: "1px solid #64748b", borderRadius: 8, padding: "10px 12px", color: "#0f172a", fontSize: 14, fontWeight: 750, background: "#fff" };
const summaryHeaderStyle = { color: "#0f172a", fontSize: 20, fontWeight: 950, margin: 0 };
const summaryHelpStyle = { color: "#475569", fontSize: 12, fontWeight: 750, lineHeight: 1.4, margin: "5px 0 14px" };
const summaryBlockStyle = { marginBottom: 14, background: "#f8fafc", border: "1px solid #dbe3ec", borderRadius: 9, padding: 11 };
const summaryTitleStyle = { color: "#0f172a", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 };
const rowStyle = { display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px solid #dbe3ec", paddingBottom: 5, color: "#1e293b", fontSize: 12, fontWeight: 750 };
const warnPillStyle = { background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 900 };
const okTextStyle = { color: "#166534", fontSize: 12, fontWeight: 900, background: "#dcfce7", border: "1px solid #86efac", borderRadius: 999, padding: "5px 9px" };
const emptyHintStyle = { color: "#64748b", fontSize: 12, fontWeight: 800, fontStyle: "italic" };
const previewGridStyle = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 };
const miniPanelStyle = { background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 9, padding: 12, minWidth: 0 };
const mutedLineStyle = { color: "#1e293b", fontSize: 12, fontWeight: 750, lineHeight: 1.5, marginBottom: 4 };
