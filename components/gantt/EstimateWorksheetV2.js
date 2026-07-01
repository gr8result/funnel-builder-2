import EstimateWorksheetSection from "./EstimateWorksheetSection";
import WindowDoorSchedule from "./WindowDoorSchedule";
import { useEstimateWorksheetV2 } from "../../hooks/gantt/useEstimateWorksheetV2";

export default function EstimateWorksheetV2({ plannerAnswers, onBack, onClose }) {
  const worksheet = useEstimateWorksheetV2(plannerAnswers);
  const activeSection = worksheet.sections.find((section) => section.key === worksheet.worksheet.activeSection) || worksheet.sections[0];
  const isWindowsPage = worksheet.worksheet.activePage === "windowsDoors";

  return (
    <div style={shellStyle}>
      <aside style={navPanelStyle}>
        <div style={eyebrowStyle}>Estimate Worksheet V2</div>
        <h3 style={navTitleStyle}>Excel-style Takeoff</h3>
        <p style={navHelpStyle}>Data Input Sheet structure rebuilt as clean preview-only pages.</p>

        <button
          style={{ ...pageBtnStyle, ...(!isWindowsPage ? pageBtnActiveStyle : {}) }}
          onClick={() => worksheet.setActivePage("rawInputs")}
        >
          Page 1: Raw Inputs
        </button>
        {!isWindowsPage && (
          <div style={sectionListStyle}>
            {worksheet.sections.map((section, index) => (
              <button
                key={section.key}
                style={{ ...sectionBtnStyle, ...(section.key === worksheet.worksheet.activeSection ? sectionBtnActiveStyle : {}) }}
                onClick={() => worksheet.setActiveSection(section.key)}
              >
                <span style={sectionNumberStyle}>{index + 1}</span>
                {section.label}
              </button>
            ))}
          </div>
        )}
        <button
          style={{ ...pageBtnStyle, ...(isWindowsPage ? pageBtnActiveStyle : {}) }}
          onClick={() => worksheet.setActivePage("windowsDoors")}
        >
          Page 2: Windows & Doors
        </button>
      </aside>

      <main style={mainStyle}>
        {isWindowsPage ? (
          <WindowDoorSchedule
            schedule={worksheet.preview.areas.windowDoor}
            onUpdate={worksheet.updateWindowDoor}
            onAdd={worksheet.addWindowDoorRow}
            onDelete={worksheet.deleteWindowDoorRow}
          />
        ) : (
          <EstimateWorksheetSection
            section={activeSection}
            rows={worksheet.worksheet.sections[activeSection.key].rows}
            calculated={worksheet.preview}
            onUpdate={(rowKey, fieldKey, value) => worksheet.updateRow(activeSection.key, rowKey, fieldKey, value)}
          />
        )}

        <div style={outputPanelStyle}>
          <div>
            <div style={eyebrowStyle}>Generated Preview</div>
            <h3 style={outputTitleStyle}>Final Quantities Used</h3>
          </div>
          <div style={quantityGridStyle}>
            {Object.entries(worksheet.preview.summaryQuantities).map(([key, value]) => (
              <div key={key} style={quantityCardStyle}>
                <span>{pretty(key)}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </main>

      <aside style={summaryPanelStyle}>
        <div style={eyebrowStyle}>Preview Panel</div>
        <h3 style={summaryTitleStyle}>Worksheet Output</h3>
        <p style={summaryHelpStyle}>No pricing, saves, database writes, or Gantt task creation.</p>

        <SummaryBlock title="Missing Required Inputs">
          {worksheet.preview.missingRequired.length ? worksheet.preview.missingRequired.map((item) => (
            <span key={`${item.section}-${item.key}`} style={warnPillStyle}>{pretty(item.section)}: {pretty(item.key)}</span>
          )) : <span style={okPillStyle}>Required fields complete</span>}
        </SummaryBlock>

        <SummaryBlock title="Calculated Areas">
          {["totalFloorAreaM2", "netExternalWallM2", "windowDoorAreaM2", "slabAreaM2", "roofAreaM2"].map((key) => (
            <div key={key} style={summaryRowStyle}><span>{pretty(key)}</span><strong>{worksheet.preview.summaryQuantities[key]}</strong></div>
          ))}
        </SummaryBlock>

        <SummaryBlock title="Long-Lead Procurement">
          {worksheet.procurementItems.filter((item) => item.critical).slice(0, 7).map((item) => (
            <div key={item.materialId} style={summaryRowStyle}><span>{item.name}</span><strong>{item.leadTimeDays}d</strong></div>
          ))}
        </SummaryBlock>

        <SummaryBlock title="Duration Impact">
          <div style={summaryRowStyle}><span>Estimated contract</span><strong>{worksheet.contractDuration.estimatedContractDays}d</strong></div>
          {worksheet.contractDuration.complexityAdjustments.map((item) => (
            <div key={item.reason} style={summaryRowStyle}><span>{item.reason}</span><strong>+{item.days}d</strong></div>
          ))}
        </SummaryBlock>

        <SummaryBlock title="Takeoff Preview">
          <div style={summaryRowStyle}><span>Assemblies</span><strong>{worksheet.assemblies.length}</strong></div>
          <div style={summaryRowStyle}><span>Takeoff groups</span><strong>{worksheet.takeoffGroups.length}</strong></div>
          <div style={summaryRowStyle}><span>Procurement items</span><strong>{worksheet.procurementItems.length}</strong></div>
        </SummaryBlock>

        <div style={actionsStyle}>
          <button style={secondaryBtnStyle} onClick={onBack}>Back</button>
          <button style={secondaryBtnStyle} onClick={onClose}>Close</button>
        </div>
      </aside>
    </div>
  );
}

function SummaryBlock({ title, children }) {
  return <div style={summaryBlockStyle}><div style={blockTitleStyle}>{title}</div><div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{children}</div></div>;
}

function pretty(value) {
  return String(value)
    .replace(/M2/g, " m2")
    .replace(/Lm/g, " lm")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

const shellStyle = { display: "grid", gridTemplateColumns: "270px minmax(740px, 1fr) 340px", gap: 20, alignItems: "start" };
const navPanelStyle = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" };
const eyebrowStyle = { color: "#4f46e5", fontSize: 11, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.07em" };
const navTitleStyle = { color: "#0f172a", fontSize: 20, fontWeight: 950, margin: "4px 0" };
const navHelpStyle = { color: "#475569", fontSize: 12, fontWeight: 750, lineHeight: 1.4, margin: "0 0 14px" };
const pageBtnStyle = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 9, background: "#f8fafc", color: "#0f172a", padding: "10px 12px", fontSize: 13, fontWeight: 950, textAlign: "left", cursor: "pointer", marginBottom: 9 };
const pageBtnActiveStyle = { background: "#312e81", borderColor: "#312e81", color: "#fff" };
const sectionListStyle = { display: "flex", flexDirection: "column", gap: 5, margin: "0 0 12px 12px" };
const sectionBtnStyle = { border: "1px solid #e2e8f0", background: "#fff", color: "#1e293b", borderRadius: 8, padding: "8px 9px", textAlign: "left", fontSize: 12, fontWeight: 850, cursor: "pointer", display: "flex", gap: 8, alignItems: "center" };
const sectionBtnActiveStyle = { background: "#ede9fe", borderColor: "#a78bfa", color: "#4c1d95" };
const sectionNumberStyle = { width: 20, height: 20, borderRadius: 999, background: "#eef2ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 950, flexShrink: 0 };
const mainStyle = { display: "flex", flexDirection: "column", gap: 16, minWidth: 0 };
const outputPanelStyle = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16 };
const outputTitleStyle = { color: "#0f172a", fontSize: 20, fontWeight: 950, margin: "4px 0 12px" };
const quantityGridStyle = { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 };
const quantityCardStyle = { background: "#f8fafc", border: "1px solid #dbe3ec", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 4, color: "#475569", fontSize: 12, fontWeight: 800 };
const summaryPanelStyle = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" };
const summaryTitleStyle = { color: "#0f172a", fontSize: 20, fontWeight: 950, margin: "4px 0" };
const summaryHelpStyle = { color: "#475569", fontSize: 12, fontWeight: 750, lineHeight: 1.4, margin: "0 0 14px" };
const summaryBlockStyle = { background: "#f8fafc", border: "1px solid #dbe3ec", borderRadius: 9, padding: 11, marginBottom: 12 };
const blockTitleStyle = { color: "#0f172a", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 };
const summaryRowStyle = { display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px solid #dbe3ec", paddingBottom: 5, color: "#1e293b", fontSize: 12, fontWeight: 750 };
const warnPillStyle = { background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 900 };
const okPillStyle = { color: "#166534", fontSize: 12, fontWeight: 900, background: "#dcfce7", border: "1px solid #86efac", borderRadius: 999, padding: "5px 9px" };
const actionsStyle = { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 };
const secondaryBtnStyle = { background: "#fff", border: "1px solid #cbd5e1", color: "#334155", borderRadius: 8, padding: "9px 13px", fontSize: 13, fontWeight: 850, cursor: "pointer" };
