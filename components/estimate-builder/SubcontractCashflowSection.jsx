import { useMemo } from "react";
import { subcontractCashflow } from "../../lib/construction-estimation/tradeContractWorkbook.js";

const money = (value) => `$${(Number(value) || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const section = { border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, background: "#ffffff" };
const metricGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, margin: "10px 0" };
const metric = { border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc", padding: 10, display: "flex", flexDirection: "column", gap: 4, color: "#0f172a" };
const cell = { padding: "6px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "left", fontSize: 14 };
const number = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const SOURCE = { MANUAL: "manual date", GANTT: "Gantt", NONE: "not scheduled" };

// Subcontract payments on the Cashflow page: milestone amounts on their forecast payment dates. The commitment is the same money the
// stage table already shows under Outgoing Costs (through the quotation section), so this section adds nothing to that total.
export default function SubcontractCashflowSection({ workbook = {}, quotation = {} }) {
  const flow = useMemo(() => subcontractCashflow(workbook, quotation), [workbook.tradeContracts, quotation]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!(workbook.tradeContracts || []).length) return null;
  const months = Object.keys(flow.byMonth).sort((a, b) => (a === "UNSCHEDULED") - (b === "UNSCHEDULED") || a.localeCompare(b));
  return (
    <section style={section} aria-label="Subcontract payment forecast">
      <h3 style={{ margin: 0, fontSize: 20 }}>Subcontract payments</h3>
      <p style={{ margin: "4px 0 0", fontSize: 14, color: "#475569" }}>Each subcontract is counted once in Outgoing Costs, through its quotation section. The milestones below are when that same money is forecast to be paid. They are not added to Outgoing Costs again.</p>
      <div style={metricGrid}>
        {[["Total contract commitment", flow.totals.commitment], ["Forecast payments", flow.totals.forecast], ["Claimed", flow.totals.claimed], ["Approved", flow.totals.approved], ["Paid", flow.totals.paid], ["Remaining commitment", flow.totals.remainingCommitment]].map(([label, value]) => (
          <div key={label} style={metric} data-subcontract-metric={label}><span>{label}</span><strong>{money(value)}</strong></div>
        ))}
      </div>
      {flow.contracts.map((contract) => (
        <div key={contract.contractId} style={{ fontSize: 14, margin: "2px 0" }} data-subcontract-check={contract.contractId}>
          <strong>{contract.trade.replace(/_/g, " ")}</strong>{contract.supplierName ? ` - ${contract.supplierName}` : ""}: commitment {money(contract.commitment)}; in Outgoing Costs {money(contract.costInQuotation)} from the {contract.sourceSection} section.{" "}
          {Math.abs(contract.differenceFromQuotation) < 0.005 ? "Counted once." : `Differs from the quotation by ${money(contract.differenceFromQuotation)} (${contract.amountMode === "AGREED" ? "agreed subcontract price" : "approved variations"}); Outgoing Costs still shows the quotation figure.`}
        </div>
      ))}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
        <thead><tr>{["Payment date", "Date from", "Subcontract milestone", "Forecast", "Claimed", "Approved", "Paid", "Status"].map((head, index) => <th key={head} style={index >= 3 && index <= 6 ? { ...number, fontWeight: 700 } : { ...cell, fontWeight: 700 }}>{head}</th>)}</tr></thead>
        <tbody>
          {flow.dated.map((row) => (
            <tr key={row.milestoneId} data-subcontract-payment={row.milestoneId}>
              <td style={cell}>{row.paymentDate || "Not scheduled"}</td>
              <td style={cell}>{row.open ? SOURCE[row.dateSource] : "paid"}</td>
              <td style={cell}>{row.trade.replace(/_/g, " ")} - {row.label}</td>
              <td style={number}>{money(row.forecast)}</td>
              <td style={number}>{money(row.claimed)}</td>
              <td style={number}>{money(row.approved)}</td>
              <td style={number}>{money(row.paid)}</td>
              <td style={cell}>{row.status.replace(/_/g, " ").toLowerCase()}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...cell, fontWeight: 700 }} colSpan={3}>Total</td>
            <td style={{ ...number, fontWeight: 700 }}>{money(flow.totals.forecast)}</td>
            <td style={{ ...number, fontWeight: 700 }}>{money(flow.totals.claimed)}</td>
            <td style={{ ...number, fontWeight: 700 }}>{money(flow.totals.approved)}</td>
            <td style={{ ...number, fontWeight: 700 }}>{money(flow.totals.paid)}</td>
            <td style={cell} />
          </tr>
        </tbody>
      </table>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
        <thead><tr>{["Month", "Forecast", "Claimed", "Approved", "Paid"].map((head, index) => <th key={head} style={index ? { ...number, fontWeight: 700 } : { ...cell, fontWeight: 700 }}>{head}</th>)}</tr></thead>
        <tbody>
          {months.map((month) => (
            <tr key={month}>
              <td style={cell}>{month === "UNSCHEDULED" ? "Not scheduled" : month}</td>
              {["forecast", "claimed", "approved", "paid"].map((field) => <td key={field} style={number}>{money(flow.byMonth[month][field])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
