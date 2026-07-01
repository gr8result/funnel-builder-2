import { useEstimateWorksheetV4 } from "../../hooks/gantt/useEstimateWorksheetV4";

export default function EstimateWorksheetV4({ plannerAnswers, onBack, onClose }) {
  const sheet = useEstimateWorksheetV4(plannerAnswers);
  return (
    <div style={shell}>
      <aside style={nav}>
        <div style={eyebrow}>Estimate Worksheet V4</div>
        <h3 style={title}>Workbook Rebuild</h3>
        {sheet.pages.map((page) => <button key={page.key} style={{ ...navBtn, ...(sheet.workbook.page === page.key ? active : {}) }} onClick={() => sheet.setPage(page.key)}>{page.label}</button>)}
        <div style={actions}><button style={smallBtn} onClick={onBack}>Back</button><button style={smallBtn} onClick={onClose}>Close</button></div>
      </aside>
      <main style={main}>
        <div style={topbar}>
          <strong>{sheet.pages.find((page) => page.key === sheet.workbook.page)?.label}</strong>
          <span>Excel-style workflow. Change input cells directly. Pricing writes are disabled.</span>
          {sheet.workbook.page === "quotation" && <input style={searchInput} placeholder="Search line item" value={sheet.lineSearch} onChange={(e) => sheet.setLineSearch(e.target.value)} />}
        </div>
        {sheet.workbook.page === "dataInput" && <DataInput sheet={sheet} />}
        {sheet.workbook.page === "windowsDoors" && <Windows sheet={sheet} />}
        {sheet.workbook.page === "quotation" && <Quotation sheet={sheet} />}
        {sheet.workbook.page === "summary" && <Summary sheet={sheet} />}
      </main>
      <aside style={summary}>
        <div style={eyebrow}>Live Totals</div>
        <h3 style={title}>Quote Summary</h3>
        <Block title="Totals"><Row label="Subtotal" value={money(sheet.preview.summary.subtotalBeforeMargin)} /><Row label={`Margin ${sheet.preview.summary.marginPercent}%`} value={money(sheet.preview.summary.marginAmount)} /><Row label="GST" value={money(sheet.preview.summary.gst)} /><Row label="Final quote total" value={money(sheet.preview.summary.finalQuoteTotal)} /></Block>
        <Block title="Required Inputs">{sheet.preview.missingRequired.length ? sheet.preview.missingRequired.map((item) => <span key={`${item.section}-${item.key}`} style={warn}>{pretty(item.section)}: {pretty(item.key)}</span>) : <span style={ok}>Complete</span>}</Block>
        <Block title="Quote Required">{quoteRequiredRows(sheet).slice(0, 8).map((row) => <Row key={row.item} label={row.item} value={row.sourceOfRate} />)}</Block>
      </aside>
    </div>
  );
}

function DataInput({ sheet }) {
  return <div style={page}>{sheet.dataSections.map((section) => {
    const state = sheet.workbook.data[section.key];
    return <section key={section.key} style={sectionBox}><button style={sectionHead} onClick={() => sheet.toggleDataSection(section.key)}>{state.collapsed ? "+" : "-"} {section.label}</button>{!state.collapsed && <Table headers={["Item", "Input", "Calculated", "Unit", "Notes"]}>{section.rows.map((row) => <tr key={row.key}><Td strong>{row.label}{row.required ? " *" : ""}</Td><Td>{row.calculated ? <span style={muted}>read-only</span> : inputFor(row, state.rows[row.key]?.value, (value) => sheet.updateData(section.key, row.key, value))}</Td><Td calc>{row.calculated ? val(sheet.preview.quantities[row.key]) : "-"}</Td><Td>{row.unit}</Td><Td><input style={input} value={state.rows[row.key]?.notes || ""} onChange={(e) => sheet.updateData(section.key, row.key, e.target.value)} /></Td></tr>)}</Table>}</section>;
  })}</div>;
}

function Windows({ sheet }) {
  return <div style={page}><button style={blueBtn} onClick={sheet.addWindow}>+ Add Opening</button><Table headers={["SIZE", "QTY", "LEVEL", "HEIGHT", "WIDTH", "AREA", "SILL", "ARCH", "Notes", ""]}>{sheet.preview.windowsDoors.rows.map((row) => <tr key={row.id}><Td><input style={input} value={row.code || ""} onChange={(e) => sheet.updateWindow(row.id, "code", e.target.value)} /></Td><Td><input style={numInput} value={row.quantity || ""} onChange={(e) => sheet.updateWindow(row.id, "quantity", e.target.value)} /></Td><Td><select style={input} value={row.level || ""} onChange={(e) => sheet.updateWindow(row.id, "level", e.target.value)}>{["", "Ground Floor", "Second Level", "Third Level"].map((level) => <option key={level}>{level}</option>)}</select></Td>{["height", "width"].map((key) => <Td key={key}><input style={numInput} inputMode="decimal" value={row[key] || ""} onChange={(e) => sheet.updateWindow(row.id, key, e.target.value)} /></Td>)}{["totalArea", "sillLength", "architraveLength"].map((key) => <Td key={key} calc>{row[key]}</Td>)}<Td><input style={input} value={row.notes || ""} onChange={(e) => sheet.updateWindow(row.id, "notes", e.target.value)} /></Td><Td><button style={dangerBtn} onClick={() => sheet.deleteWindow(row.id)}>Delete</button></Td></tr>)}</Table><Table headers={["Level", "Opening Area"]}><tr><Td strong>Ground floor openings</Td><Td calc>{sheet.preview.windowsDoors.totals.groundFloorArea}</Td></tr><tr><Td strong>Second level openings</Td><Td calc>{sheet.preview.windowsDoors.totals.secondLevelArea}</Td></tr><tr><Td strong>Third level openings</Td><Td calc>{sheet.preview.windowsDoors.totals.thirdLevelArea}</Td></tr><tr><Td strong>Total openings</Td><Td calc>{sheet.preview.windowsDoors.totals.totalArea}</Td></tr></Table></div>;
}

function Quotation({ sheet }) {
  const q = sheet.preview.quotation;
  const search = sheet.lineSearch.trim().toLowerCase();
  return <div style={page}>{sheet.quoteSections.map((section) => {
    const group = q[section];
    const rows = group.rows.filter((row) => !search || row.item.toLowerCase().includes(search));
    return <section key={section} style={sectionBox}><button style={sectionHead} onClick={() => sheet.toggleQuoteSection(section)}>{group.collapsed ? "+" : "-"} {section}<strong>{money(group.subtotal)}</strong></button>{!group.collapsed && <Table headers={["Item", "Qty", "Unit", "Rate", "Cost", "Notes"]}>{rows.map((row) => <tr key={row.id}><Td><input style={itemInput} value={row.item} onChange={(e) => sheet.updateQuote(section, row.id, "item", e.target.value)} /></Td><Td calc>{row.qty || ""}</Td><Td><select style={input} value={row.unit} onChange={(e) => sheet.updateQuote(section, row.id, "unit", e.target.value)}>{["LM", "M2", "M3", "EACH", "ITEM", "DAY", "HOUR"].map((unit) => <option key={unit}>{unit}</option>)}</select></Td><Td><input style={rateInput(row)} value={row.manualRate || row.finalRateUsed || ""} onChange={(e) => sheet.updateQuote(section, row.id, "manualRate", e.target.value)} /></Td><Td final>{money(row.cost)}</Td><Td><input style={input} value={row.notes || rateNote(row)} onChange={(e) => sheet.updateQuote(section, row.id, "notes", e.target.value)} /></Td></tr>)}<tr><Td strong>Subtotal</Td><Td /><Td /><Td /><Td final>{money(group.subtotal)}</Td><Td /></tr></Table>}</section>;
  })}</div>;
}

function Summary({ sheet }) {
  return <div style={page}><Table headers={["Section", "Total"]}>{sheet.quoteSections.map((section) => <tr key={section}><Td strong>{section}</Td><Td final>{money(sheet.preview.quotation[section].subtotal)}</Td></tr>)}<tr><Td strong>Subtotal before margin</Td><Td final>{money(sheet.preview.summary.subtotalBeforeMargin)}</Td></tr><tr><Td strong>Margin</Td><Td final>{money(sheet.preview.summary.marginAmount)}</Td></tr><tr><Td strong>GST</Td><Td final>{money(sheet.preview.summary.gst)}</Td></tr><tr><Td strong>Final quote total</Td><Td final>{money(sheet.preview.summary.finalQuoteTotal)}</Td></tr></Table></div>;
}

function Table({ headers, children }) { return <div style={tableWrap}><table style={table}><thead><tr>{headers.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Td({ children, strong, calc, final }) { return <td style={{ ...td, ...(strong ? strongTd : {}), ...(calc ? calcTd : {}), ...(final ? finalTd : {}) }}>{children}</td>; }
function Block({ title, children }) { return <div style={block}><div style={blockTitle}>{title}</div><div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div></div>; }
function Row({ label, value }) { return <div style={sumRow}><span>{label}</span><strong>{value}</strong></div>; }
function inputFor(row, value, onChange) { return row.options ? <select style={input} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>{row.options.map((o) => <option key={o}>{o}</option>)}</select> : <input style={input} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />; }
function quoteRequiredRows(sheet) { return Object.values(sheet.preview.quotation).flatMap((g) => g.rows).filter((r) => r.quoteRequired || r.sourceOfRate === "rate missing" || r.discontinuedWarning); }
function rateNote(row) { if (row.discontinuedWarning) return "discontinued/supplier warning"; if (row.sourceOfRate === "rate missing") return "rate missing"; if (row.quoteRequired) return "quote required"; return row.sourceOfRate; }
function rateInput(row) { return { ...input, background: row.sourceOfRate === "rate missing" ? "#fff7ed" : "#fff" }; }
function val(v) { return v === "" || v === undefined ? "-" : v; }
function money(v) { return v ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"; }
function pretty(v) { return String(v).replace(/M2/g, " m2").replace(/Lm/g, " lm").replace(/([A-Z])/g, " $1").replace(/^./, (l) => l.toUpperCase()); }

const shell = { display: "grid", gridTemplateColumns: "250px minmax(820px, 1fr) 320px", gap: 16, alignItems: "start" };
const nav = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 };
const main = { minWidth: 0 };
const summary = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 };
const eyebrow = { color: "#2563eb", fontSize: 11, fontWeight: 950, textTransform: "uppercase" };
const title = { margin: "3px 0 10px", color: "#0f172a", fontSize: 18, fontWeight: 950 };
const navBtn = { width: "100%", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 7, padding: "9px 10px", marginBottom: 7, textAlign: "left", color: "#0f172a", fontWeight: 900, cursor: "pointer" };
const active = { background: "#166534", borderColor: "#166534", color: "#fff" };
const actions = { display: "flex", gap: 8, marginTop: 12 };
const smallBtn = { background: "#fff", border: "1px solid #cbd5e1", color: "#334155", borderRadius: 7, padding: "8px 10px", fontWeight: 850, cursor: "pointer" };
const topbar = { position: "sticky", top: 0, zIndex: 5, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 10px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12, color: "#0f172a" };
const searchInput = { marginLeft: "auto", border: "1px solid #64748b", borderRadius: 6, padding: "7px 9px", color: "#0f172a", fontWeight: 800 };
const page = { display: "flex", flexDirection: "column", gap: 8 };
const sectionBox = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden" };
const sectionHead = { width: "100%", display: "flex", justifyContent: "space-between", background: "#dcfce7", border: "none", borderBottom: "1px solid #86efac", color: "#0f172a", padding: "8px 10px", fontWeight: 950, cursor: "pointer" };
const tableWrap = { overflow: "auto", maxHeight: "calc(100vh - 270px)" };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const th = { position: "sticky", top: 0, background: "#e2e8f0", color: "#0f172a", padding: "7px 8px", border: "1px solid #cbd5e1", textAlign: "left", fontWeight: 950, whiteSpace: "nowrap" };
const td = { padding: "5px 6px", border: "1px solid #e2e8f0", color: "#0f172a", verticalAlign: "middle" };
const strongTd = { fontWeight: 900, background: "#f8fafc" };
const calcTd = { background: "#f1f5f9", fontWeight: 850 };
const finalTd = { background: "#dcfce7", fontWeight: 950, color: "#166534" };
const input = { width: "100%", minWidth: 90, boxSizing: "border-box", border: "1px solid #64748b", borderRadius: 4, padding: "5px 6px", color: "#0f172a", fontSize: 12, fontWeight: 800, background: "#fff" };
const numInput = { ...input, minWidth: 72 };
const itemInput = { ...input, minWidth: 230 };
const blueBtn = { alignSelf: "flex-start", background: "#166534", color: "#fff", border: "1px solid #166534", borderRadius: 7, padding: "8px 11px", fontWeight: 900, cursor: "pointer" };
const dangerBtn = { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 7px", fontWeight: 850, cursor: "pointer" };
const muted = { color: "#64748b", fontWeight: 800 };
const block = { background: "#f8fafc", border: "1px solid #dbe3ec", borderRadius: 8, padding: 10, marginBottom: 10 };
const blockTitle = { color: "#0f172a", fontSize: 12, fontWeight: 950, textTransform: "uppercase", marginBottom: 7 };
const sumRow = { display: "flex", justifyContent: "space-between", gap: 8, color: "#1e293b", fontSize: 12, borderBottom: "1px solid #dbe3ec", paddingBottom: 4 };
const warn = { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderRadius: 999, padding: "5px 8px", fontSize: 12, fontWeight: 900 };
const ok = { background: "#dcfce7", border: "1px solid #86efac", color: "#166534", borderRadius: 999, padding: "5px 8px", fontSize: 12, fontWeight: 900 };
