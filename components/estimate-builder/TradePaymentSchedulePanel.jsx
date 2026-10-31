import { useEffect, useMemo, useState } from "react";
import { COMPLETION, CLAIM, jobBoardTaskKeyOf, milestoneEligibility, scheduledDateSource, tradeCashflowForecast, validateTradeContract, effectiveScheduledDate } from "../../lib/construction-estimation/tradePaymentSchedule.js";
import { parseTemplateMilestones } from "../../lib/construction-estimation/tradePaymentTemplateStore.js";

const money = (value) => `$${(Number(value) || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const box = { border: "1px solid #cbd5e1", borderRadius: 8, padding: 12, margin: "12px 0", background: "#fff" };
const cell = { padding: "4px 6px", borderBottom: "1px solid #e2e8f0", verticalAlign: "top", fontSize: 13 };
const input = { width: 90, padding: "3px 5px", border: "1px solid #94a3b8", borderRadius: 4 };
const small = { fontSize: 11, color: "#475569" };
const row = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const DATE_SOURCE = { MANUAL: "manual date", GANTT: "from Gantt", NONE: "no date" };
const ISSUE_TEXT = {
  OVER_ALLOCATED: (i) => `Over-allocated by ${money(i.by)}: milestones exceed the contract.`,
  UNDER_ALLOCATED: (i) => `Under-allocated by ${money(i.by)}: milestones do not cover the contract.`,
  PAYMENT_EXCEEDS_CONTRACT: (i) => `Payments exceed the contract by ${money(i.by)} without an approved variation.`,
  APPROVALS_EXCEED_CONTRACT: (i) => `Approvals exceed the contract by ${money(i.by)}.`,
  DUPLICATE_INVOICE_REFERENCE: (i) => `Invoice reference ${i.invoiceRef} is used on more than one milestone.`,
  SUPPLIER_REQUIRED: () => "Assign the subcontractor before issuing the purchase order.",
  NO_CONTRACT_AMOUNT: () => "No contract amount from the quotation yet.",
};

function Commit({ value, onCommit, disabled, label, style, placeholder }) {
  const [draft, setDraft] = useState(null);
  return <input aria-label={label} placeholder={placeholder} disabled={disabled} style={{ ...input, ...style }} value={draft ?? String(value ?? "")} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (draft !== null && draft !== String(value ?? "")) onCommit(draft); setDraft(null); }} />;
}

export default function TradePaymentSchedulePanel({ sheet, readonly = false }) {
  const workbook = sheet?.workbook || {};
  const contracts = workbook.tradeContracts || [];
  const [actor, setActor] = useState("");
  const [message, setMessage] = useState("");
  const [claimInputs, setClaimInputs] = useState({});
  const [refresh, setRefresh] = useState(null); // the reported changes awaiting confirmation
  const [board, setBoard] = useState({ jobs: null, message: "" });
  const [templates, setTemplates] = useState({ source: "", message: "", list: [] });
  const [newTemplate, setNewTemplate] = useState({ trade: "", milestones: "" });
  const flow = useMemo(() => tradeCashflowForecast(contracts), [contracts]);
  const ganttTasks = useMemo(() => (readonly || !sheet?.tradeContractGanttTasks ? [] : sheet.tradeContractGanttTasks()), [contracts, readonly]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = (result) => { setMessage(result?.ok ? (result.message || "Saved.") : `${result?.code || "ERROR"}: ${result?.message || "Action failed."}`); return result; };
  const act = (contractId, action, payload) => run(sheet.updateTradeContract(contractId, action, payload, actor.trim()));
  const input_ = (key, field) => claimInputs[`${key}:${field}`] || "";
  const setInput = (key, field, value) => setClaimInputs((current) => ({ ...current, [`${key}:${field}`]: value }));
  const linkedJobId = contracts.find((contract) => contract.jobBoard?.jobId)?.jobBoard.jobId || "";
  const linkedJob = (board.jobs || []).find((job) => job.id === linkedJobId);

  const loadTemplates = async () => { const result = await sheet.refreshBuilderTradeTemplates(); setTemplates({ source: result.source, message: result.message, list: result.templates || [] }); };
  const loadBoard = async () => { const result = await sheet.loadTradeContractJobBoardJobs(); setBoard({ jobs: result.ok ? result.jobs : [], message: result.ok ? "" : result.message }); };
  useEffect(() => { if (!readonly && sheet?.refreshBuilderTradeTemplates) { loadTemplates(); loadBoard(); } }, [readonly]); // eslint-disable-line react-hooks/exhaustive-deps

  const reportRefresh = () => {
    const result = sheet.previewTradeContractSync();
    if (!result.ok) { run(result); return; }
    if (!result.changed) { setRefresh(null); setMessage("Trade contracts already match the quotation. Nothing to change."); return; }
    setMessage(""); setRefresh(result.lines.length ? result.lines : ["Purchase order details will be refreshed. No contract value changes."]);
  };
  const saveTemplate = async (payload) => { run(await sheet.saveBuilderTradeTemplate(payload, actor.trim())); loadTemplates(); };

  return (
    <section style={box} aria-label="Trade payment schedules">
      <h3 style={{ margin: 0 }}>Trade payment schedules</h3>
      <p style={{ margin: "4px 0 8px", fontSize: 13, color: "#475569" }}>The quotation sets each contract amount once. Milestones are how that same amount is paid; they add nothing to the quotation, BOQ or purchase cost.</p>
      {!readonly && <div style={row}>
        <button type="button" onClick={reportRefresh}>Create / refresh contracts from quotation</button>
        <button type="button" onClick={() => run(sheet.linkTradeContractsToSchedule())}>Link milestones to Gantt</button>
        <label style={{ fontSize: 13 }}>Acting as (required to approve, reject, pay) <input aria-label="Acting as" style={{ ...input, width: 160 }} value={actor} onChange={(event) => setActor(event.target.value)} /></label>
      </div>}
      {refresh && <div role="alertdialog" aria-label="Contract changes to confirm" style={{ ...box, background: "#fffbeb", borderColor: "#f59e0b" }}>
        <strong>Review before applying</strong>
        <ul style={{ margin: "6px 0", paddingLeft: 18, fontSize: 13 }}>{refresh.map((line, index) => <li key={index}>{line}</li>)}</ul>
        <div style={small}>Approved and paid milestones, agreed subcontract prices and approved variations are kept. No second purchase order is created for a contract that already has one.</div>
        <div style={{ ...row, marginTop: 6 }}>
          <button type="button" onClick={() => { setRefresh(null); run(sheet.syncTradeContracts()); }}>Apply these changes</button>
          <button type="button" onClick={() => { setRefresh(null); setMessage("No changes were made."); }}>Cancel</button>
        </div>
      </div>}
      {!readonly && contracts.length > 0 && <div style={{ ...row, marginTop: 8, fontSize: 13 }} aria-label="Job Board link">
        <label>Job Board job <select aria-label="Job Board job" value={linkedJobId} onChange={(event) => { const job = (board.jobs || []).find((entry) => entry.id === event.target.value); run(sheet.linkTradeContractsToJobBoard({ jobId: job?.id || "", jobName: job?.name || "" }, actor.trim())); }}>
          <option value="">Not linked</option>
          {linkedJobId && !linkedJob && <option value={linkedJobId}>{contracts.find((contract) => contract.jobBoard?.jobId)?.jobBoard.jobName || linkedJobId}</option>}
          {(board.jobs || []).map((job) => <option key={job.id} value={job.id}>{job.name}{job.boardName ? ` (${job.boardName})` : ""}</option>)}
        </select></label>
        <button type="button" disabled={!linkedJobId} onClick={async () => run(await sheet.syncTradeContractsFromJobBoard())}>Update work status from Job Board</button>
        <span style={small}>{board.message || "A done card on the linked Job Board task makes the milestone eligible for review. It never approves or pays."}</span>
      </div>}
      {message && <div role="status" style={{ margin: "8px 0", fontSize: 13 }}>{message}</div>}
      {!contracts.length && <div style={{ marginTop: 8, fontSize: 13 }}>No trade contracts yet. Select "Create / refresh contracts from quotation".</div>}
      {contracts.length > 0 && <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "8px 0", fontSize: 13 }} aria-label="Outgoing cash flow">
        {[["Commitment", flow.totals.commitment], ["Forecast", flow.totals.forecast], ["Claimed", flow.totals.claimed], ["Approved", flow.totals.approved], ["Paid", flow.totals.paid], ["Remaining commitment", flow.totals.remainingCommitment]].map(([label, value]) => <div key={label}><strong>{label}</strong> {money(value)}</div>)}
      </div>}
      {contracts.map((contract) => {
        const check = validateTradeContract(contract);
        return (
          <div key={contract.contractId} style={{ ...box, background: "#f8fafc" }} data-trade-contract={contract.contractId}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <strong>{contract.trade.replace(/_/g, " ")}</strong>
              <span>Contract {money(contract.contractAmount)} ({contract.amountMode === "AGREED" ? "agreed amount" : "from quotation"})</span>
              <span>Purchase order: {contract.poId || "none yet"} (one for the whole commitment)</span>
              <label style={{ fontSize: 13 }}>Subcontractor <Commit label={`${contract.trade} subcontractor`} disabled={readonly} style={{ width: 160 }} value={contract.supplierName} onCommit={(value) => act(contract.contractId, "assignSupplier", { supplierName: value })} /></label>
              <label style={{ fontSize: 13 }}>Agreed amount <Commit label={`${contract.trade} agreed amount`} disabled={readonly} value={contract.agreedAmount} onCommit={(value) => act(contract.contractId, "setAmount", { amount: value })} /></label>
              {!readonly && <button type="button" title="Copies this job's percentages to the builder master template. Other jobs are not changed." onClick={() => saveTemplate({ contractId: contract.contractId })}>Save as builder default for {contract.trade.replace(/_/g, " ").toLowerCase()}</button>}
            </div>
            <div style={small}>Template {contract.templateId} revision {contract.templateRevision}. Changes here stay in this job.</div>
            {check.issues.map((issue, index) => <div key={index} role="alert" style={{ color: issue.severity === "error" ? "#b91c1c" : "#92400e", fontSize: 13 }}>{(ISSUE_TEXT[issue.code] || (() => issue.code))(issue)}</div>)}
            <div style={{ fontSize: 13 }}>Allocated {money(check.totalAllocated)} ({check.totalPercent}% of contract) - paid {money(check.paid)} - approved {money(check.approved)}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
              <thead><tr>{["Milestone", "Linked work", "%", "$ override", "Allocated", "Forecast date", "Work", "Claim", "Invoice", "Actions"].map((head) => <th key={head} style={{ ...cell, textAlign: "left" }}>{head}</th>)}</tr></thead>
              <tbody>
                {check.milestones.map((milestone) => {
                  const key = milestone.milestoneId;
                  const state = milestoneEligibility(milestone);
                  const lockedRow = milestone.claim.status === CLAIM.APPROVED || Number(milestone.payment.paidAmount) > 0;
                  const dateSource = scheduledDateSource(milestone);
                  const boardKey = jobBoardTaskKeyOf(contract, milestone);
                  const columns = linkedJob?.columns || [];
                  return (
                    <tr key={key} data-milestone={key}>
                      <td style={cell}><strong>{milestone.label}</strong><div style={small}>{state.replace(/_/g, " ").toLowerCase()}</div></td>
                      <td style={cell}>
                        <div style={small}>{milestone.constructionStage}</div>
                        {readonly || lockedRow ? <div style={small}>Gantt: {milestone.link?.resolved?.taskName || "not linked"}</div> : <select aria-label={`${milestone.label} Gantt task`} style={{ maxWidth: 190 }} value={milestone.link?.manualTask ? milestone.link.taskId : ""} onChange={(event) => { act(contract.contractId, "setLink", { key: milestone.key, ganttTaskId: event.target.value }); setTimeout(() => sheet.linkTradeContractsToSchedule({ quiet: true }), 0); }}>
                          <option value="">Gantt: {milestone.link?.resolved && !milestone.link.manualTask ? `auto - ${milestone.link.resolved.taskName}` : "match automatically"}</option>
                          {ganttTasks.map((task) => <option key={task.id} value={task.id}>{task.label}</option>)}
                        </select>}
                        {readonly ? <div style={small}>Job Board: {boardKey || "not linked"}</div> : <select aria-label={`${milestone.label} Job Board task`} style={{ maxWidth: 190, display: "block", marginTop: 2 }} value={boardKey} onChange={(event) => act(contract.contractId, "setLink", { key: milestone.key, jobBoardTaskKey: event.target.value })}>
                          <option value="">Job Board: not linked</option>
                          {boardKey && !columns.some((column) => column.key === boardKey) && <option value={boardKey}>Job Board: {boardKey}{linkedJob ? " (not on this board)" : ""}</option>}
                          {columns.map((column) => <option key={column.key} value={column.key}>Job Board: {column.label}</option>)}
                        </select>}
                      </td>
                      <td style={cell}>{milestone.remainder && milestone.mode !== "MANUAL_OVERRIDE" ? <span>{milestone.effectivePercent}% (balance)</span> : <Commit label={`${milestone.label} percentage`} disabled={readonly || lockedRow} style={{ width: 52 }} value={milestone.percent} onCommit={(value) => act(contract.contractId, "setField", { key: milestone.key, field: "percent", value })} />}</td>
                      <td style={cell}><Commit label={`${milestone.label} dollar override`} disabled={readonly || lockedRow} value={milestone.manualAmount} onCommit={(value) => act(contract.contractId, "setField", { key: milestone.key, field: "manualAmount", value })} /></td>
                      <td style={cell}><strong>{money(milestone.allocatedAmount)}</strong>{milestone.mode === "MANUAL_OVERRIDE" && <div style={small}>manual override (calc {money(milestone.calculatedAmount)})</div>}</td>
                      <td style={cell}>
                        <Commit label={`${milestone.label} forecast date`} placeholder="yyyy-mm-dd" disabled={readonly} style={{ width: 100 }} value={effectiveScheduledDate(milestone)} onCommit={(value) => act(contract.contractId, "setField", { key: milestone.key, field: "scheduledDate", value })} />
                        <div style={{ ...small, color: dateSource === "MANUAL" ? "#92400e" : small.color }} data-date-source={dateSource}>{DATE_SOURCE[dateSource]}{dateSource === "MANUAL" && milestone.link?.resolved?.date ? ` (Gantt says ${milestone.link.resolved.date})` : ""}</div>
                        {!readonly && dateSource === "MANUAL" && <button type="button" style={{ fontSize: 11 }} onClick={() => act(contract.contractId, "setField", { key: milestone.key, field: "scheduledDate", value: "" })}>Use Gantt date</button>}
                      </td>
                      <td style={cell}>
                        <select aria-label={`${milestone.label} work status`} disabled={readonly} value={milestone.completion.status} onChange={(event) => act(contract.contractId, "setCompletion", { key: milestone.key, status: event.target.value })}>
                          {Object.values(COMPLETION).map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}
                        </select>
                        {milestone.completion.source && milestone.completion.status !== COMPLETION.NOT_STARTED && <div style={small}>set by {milestone.completion.source.replace(/_/g, " ").toLowerCase()}</div>}
                      </td>
                      <td style={cell}>{milestone.claim.status.replace(/_/g, " ")}<div style={small}>claimed {money(milestone.claim.claimedAmount)} / approved {money(milestone.claim.approvedAmount)} / paid {money(milestone.payment.paidAmount)}</div></td>
                      <td style={cell}>{readonly ? milestone.invoiceRef : <Commit label={`${milestone.label} invoice reference`} value={input_(key, "invoice") || milestone.invoiceRef} onCommit={(value) => setInput(key, "invoice", value)} />}</td>
                      <td style={cell}>
                        {!readonly && <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => act(contract.contractId, "claim", { key: milestone.key, invoiceRef: input_(key, "invoice") })}>Claim</button>
                          <button type="button" onClick={() => act(contract.contractId, "approve", { key: milestone.key })}>Approve</button>
                          <button type="button" onClick={() => act(contract.contractId, "reject", { key: milestone.key, reason: "Rejected" })}>Reject</button>
                          <Commit label={`${milestone.label} payment date`} style={{ width: 96 }} value={input_(key, "date") || new Date().toISOString().slice(0, 10)} onCommit={(value) => setInput(key, "date", value)} />
                          <button type="button" onClick={() => act(contract.contractId, "pay", { key: milestone.key, date: input_(key, "date") || new Date().toISOString().slice(0, 10), invoiceRef: input_(key, "invoice") })}>Record payment</button>
                        </div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <details style={{ marginTop: 6, fontSize: 12 }}><summary>Audit history ({contract.audit.length})</summary>
              {contract.audit.slice().reverse().map((entry, index) => <div key={index}>{entry.at.slice(0, 19).replace("T", " ")} - {entry.actor || "system"} - {entry.action}{entry.milestoneId ? ` - ${entry.milestoneId.split(":").pop()}` : ""}{entry.field ? ` ${entry.field}: ${entry.from ?? ""} -> ${entry.to ?? ""}` : ""}{entry.note ? ` (${entry.note})` : ""}</div>)}
            </details>
          </div>
        );
      })}
      {!readonly && <details style={{ marginTop: 8, fontSize: 13 }} aria-label="Builder master payment templates">
        <summary>Builder master payment templates ({templates.list.length} saved{templates.source === "LOCAL" ? ", this browser only" : templates.source === "SHARED" ? ", shared with your team" : ""})</summary>
        {templates.message && <div role="status" style={{ color: "#92400e" }}>{templates.message}</div>}
        <div style={small}>Defaults for new jobs of this builder. Trades without one use the system default. Existing jobs keep the schedule they were created with.</div>
        {templates.list.map((template) => <div key={template.trade}><strong>{template.trade.replace(/_/g, " ")}</strong> (revision {template.revision}): {template.milestones.map((milestone) => `${milestone.label} ${milestone.remainder ? "balance" : `${milestone.percent}%`}`).join(" / ")}</div>)}
        <div style={{ ...row, marginTop: 6 }}>
          <label>Trade (quotation section) <input aria-label="Template trade" style={{ ...input, width: 150 }} value={newTemplate.trade} onChange={(event) => setNewTemplate((current) => ({ ...current, trade: event.target.value }))} /></label>
          <label>Milestones <input aria-label="Template milestones" placeholder="Rough-in 30, Fix 40, Final balance" style={{ ...input, width: 300 }} value={newTemplate.milestones} onChange={(event) => setNewTemplate((current) => ({ ...current, milestones: event.target.value }))} /></label>
          <button type="button" disabled={!newTemplate.trade.trim() || !newTemplate.milestones.trim()} onClick={() => saveTemplate({ template: { trade: newTemplate.trade, name: `${newTemplate.trade.trim()} payment schedule`, sourceSection: newTemplate.trade.trim(), milestones: parseTemplateMilestones(newTemplate.milestones) } })}>Save builder default</button>
        </div>
      </details>}
    </section>
  );
}
