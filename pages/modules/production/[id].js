// /pages/modules/production/[id].js
// Production matrix board — rows = job items, columns = production stages
// Each cell shows status; click any cell for full details + update popup.
import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../utils/supabase-client";

// ─── Production stages (columns) ─────────────────────────────────────────────

const STAGES = [
  { key: "quote_req",    label: "Quote\nReq'd",     color: "#8b5cf6" },
  { key: "quote_rcvd",   label: "Quote\nRcvd",      color: "#7c3aed" },
  { key: "quote_appr",   label: "Quote\nApproved",  color: "#a855f7" },
  { key: "sample_req",   label: "Sample\nReq'd",    color: "#3b82f6" },
  { key: "sample_appr",  label: "Sample\nOK",       color: "#2563eb" },
  { key: "ordered",      label: "Ordered",          color: "#f59e0b" },
  { key: "eta_conf",     label: "ETA\nConf'd",      color: "#d97706" },
  { key: "delivered",    label: "Delivered",        color: "#ef4444" },
  { key: "on_site",      label: "On Site\nVerified",color: "#f97316" },
  { key: "installed",    label: "Installed",        color: "#22c55e" },
  { key: "signed_off",   label: "Signed\nOff",      color: "#15803d" },
];

const STATUS = {
  done:        { bg: "#22c55e", border: "none",              text: "#fff",    icon: "✓" },
  in_progress: { bg: "#f59e0b", border: "none",              text: "#fff",    icon: "◑" },
  pending:     { bg: "#1e293b", border: "1px solid #374151", text: "#4b5563", icon: "" },
  na:          { bg: "#0f0f1a", border: "1px solid #1e293b", text: "#374151", icon: "—" },
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductionBoard() {
  const router = useRouter();
  const { id }  = router.query;

  const [job, setJob]               = useState(null);
  const [items, setItems]           = useState([]);
  const [statusMap, setStatusMap]   = useState({}); // { itemId: { stageKey: record } }
  const [loading, setLoading]       = useState(true);

  // Cell popup
  const [selectedCell, setSelectedCell] = useState(null); // { item, stage, record }
  const [cellForm, setCellForm]         = useState({ status: "pending", notes: "", completed_by: "" });
  const [savingCell, setSavingCell]     = useState(false);

  // Add items modal
  const [showAdd, setShowAdd]     = useState(false);
  const [addMode, setAddMode]     = useState("single"); // "single" | "bulk"
  const [addForm, setAddForm]     = useState({ name: "", category: "", supplier: "", notes: "" });
  const [bulkText, setBulkText]   = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Filter
  const [filter, setFilter] = useState("all"); // "all" | "incomplete" | "complete"

  useEffect(() => {
    if (!router.isReady || !id) return;
    loadBoard();
  }, [router.isReady, id]);

  // ── Load ──────────────────────────────────────────────────────────────────

  async function loadBoard() {
    setLoading(true);
    try {
      const [{ data: jobData, error: jErr }, { data: itemData, error: iErr }] = await Promise.all([
        supabase.from("production_jobs").select("*").eq("id", id).single(),
        supabase.from("production_items").select("*").eq("job_id", id).order("sort_order"),
      ]);
      if (jErr) throw jErr;
      if (iErr) throw iErr;

      setJob(jobData);
      setItems(itemData || []);

      if (itemData?.length) {
        const itemIds = itemData.map((it) => it.id);
        const { data: stages, error: sErr } = await supabase
          .from("production_item_stages")
          .select("*")
          .in("item_id", itemIds);
        if (sErr) throw sErr;

        const map = {};
        (stages || []).forEach((s) => {
          if (!map[s.item_id]) map[s.item_id] = {};
          map[s.item_id][s.stage_key] = s;
        });
        setStatusMap(map);
      }
    } catch (err) {
      console.error("Production board load error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getRecord(itemId, stageKey) {
    return statusMap[itemId]?.[stageKey] || { status: "pending", notes: "", completed_by: "" };
  }

  function rowComplete(itemId) {
    return STAGES.every((s) => {
      const r = statusMap[itemId]?.[s.key];
      return r && (r.status === "done" || r.status === "na");
    });
  }

  function rowProgress(itemId) {
    const relevant = STAGES.filter((s) => statusMap[itemId]?.[s.key]?.status !== "na");
    const done     = relevant.filter((s) => statusMap[itemId]?.[s.key]?.status === "done");
    return { done: done.length, total: relevant.length || STAGES.length };
  }

  function colProgress(stageKey) {
    const done = items.filter((it) => statusMap[it.id]?.[stageKey]?.status === "done").length;
    return { done, total: items.length };
  }

  // ── Cell click ────────────────────────────────────────────────────────────

  function handleCellClick(item, stage) {
    const record = getRecord(item.id, stage.key);
    setSelectedCell({ item, stage, record });
    setCellForm({
      status:       record.status       || "pending",
      notes:        record.notes        || "",
      completed_by: record.completed_by || "",
    });
  }

  async function saveCellUpdate() {
    if (!selectedCell) return;
    setSavingCell(true);
    const { item, stage, record } = selectedCell;

    const update = {
      status:       cellForm.status,
      notes:        cellForm.notes        || null,
      completed_by: cellForm.completed_by || null,
      completed_at: cellForm.status === "done"
        ? (record.completed_at || new Date().toISOString())
        : null,
    };

    let newRecord;
    if (record.id) {
      await supabase.from("production_item_stages").update(update).eq("id", record.id);
      newRecord = { ...record, ...update };
    } else {
      const { data } = await supabase
        .from("production_item_stages")
        .insert({ item_id: item.id, stage_key: stage.key, ...update })
        .select()
        .single();
      newRecord = data || { item_id: item.id, stage_key: stage.key, ...update };
    }

    setStatusMap((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], [stage.key]: newRecord },
    }));
    setSavingCell(false);
    setSelectedCell(null);
  }

  // ── Add items ─────────────────────────────────────────────────────────────

  async function addItems() {
    const isValid = addMode === "single" ? !!addForm.name.trim() : !!bulkText.trim();
    if (!isValid) return;
    setAddSaving(true);

    const nextOrder = items.length;
    let rows;

    if (addMode === "bulk") {
      const names = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
      rows = names.map((name, i) => ({ job_id: id, name, sort_order: nextOrder + i }));
    } else {
      rows = [{
        job_id:     id,
        name:       addForm.name.trim(),
        category:   addForm.category.trim()  || null,
        supplier:   addForm.supplier.trim()  || null,
        notes:      addForm.notes.trim()     || null,
        sort_order: nextOrder,
      }];
    }

    const { data, error } = await supabase.from("production_items").insert(rows).select();
    if (error) { alert("Error: " + error.message); setAddSaving(false); return; }

    setItems((prev) => [...prev, ...(data || [])]);
    setAddForm({ name: "", category: "", supplier: "", notes: "" });
    setBulkText("");
    setShowAdd(false);
    setAddSaving(false);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalCells = items.length * STAGES.length;
  const doneCells  = items.reduce((acc, it) =>
    acc + STAGES.filter((s) => statusMap[it.id]?.[s.key]?.status === "done").length, 0);
  const overallPct = totalCells ? Math.round((doneCells / totalCells) * 100) : 0;
  const completeItems   = items.filter((it) => rowComplete(it.id)).length;

  const filteredItems = items.filter((it) => {
    if (filter === "complete")   return rowComplete(it.id);
    if (filter === "incomplete") return !rowComplete(it.id);
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={S.loadScreen}>Loading production board…</div>;
  }
  if (!job) {
    return (
      <div style={S.loadScreen}>
        Job not found.{" "}
        <Link href="/modules/production" style={{ color: "#3b82f6" }}>← Back</Link>
      </div>
    );
  }

  return (
    <>
      <Head><title>{job.name} — Production Board</title></Head>
      <div style={S.page}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={S.header}>
          <div>
            <Link href="/modules/production" style={S.backLink}>← Production Jobs</Link>
            <h1 style={S.jobTitle}>{job.name}</h1>
            {job.client_name && <div style={S.jobSub}>👤 {job.client_name}</div>}
            {job.description  && <div style={{ ...S.jobSub, fontStyle: "italic" }}>{job.description}</div>}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Stats */}
            <div style={S.statBox}>
              <div style={S.statNum}>{overallPct}%</div>
              <div style={S.statLbl}>Overall</div>
            </div>
            <div style={S.statBox}>
              <div style={{ ...S.statNum, color: "#22c55e" }}>{completeItems}</div>
              <div style={S.statLbl}>of {items.length} items done</div>
            </div>
            <button style={S.addBtn} onClick={() => setShowAdd(true)}>+ Add Items</button>
          </div>
        </div>

        {/* ── Legend + filter ────────────────────────────────────────── */}
        <div style={S.toolbar}>
          <div style={S.legend}>
            {Object.entries(STATUS).map(([key, st]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, background: st.bg, border: st.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: st.text, fontWeight: 600 }}>
                  {st.icon}
                </div>
                <span style={{ fontSize: 16, color: "#9ca3af" }}>
                  {key === "in_progress" ? "In Progress" : key === "na" ? "N/A" : key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["all", "All"], ["incomplete", "Incomplete"], ["complete", "Done ✅"]].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                style={{ ...S.filterBtn, ...(filter === k ? S.filterBtnActive : {}) }}
              >
                {l}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 16, color: "#9ca3af", marginLeft: "auto" }}>
            Click any cell to view / update
          </div>
        </div>

        {/* ── Matrix ─────────────────────────────────────────────────── */}
        {items.length === 0 ? (
          <div style={S.empty}>
            No items yet.{" "}
            <span style={{ color: "#3b82f6", cursor: "pointer" }} onClick={() => setShowAdd(true)}>
              Add your first items →
            </span>
          </div>
        ) : (
          <div style={S.matrixWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {/* Corner / item-name header */}
                  <th style={{ ...S.th, position: "sticky", top: 0, left: 0, zIndex: 30, minWidth: 230, textAlign: "left", paddingLeft: 12 }}>
                    Items ({filteredItems.length}{filter !== "all" ? ` / ${items.length}` : ""})
                  </th>
                  {/* Stage headers */}
                  {STAGES.map((stage) => {
                    const cp  = colProgress(stage.key);
                    const pct = cp.total ? Math.round((cp.done / cp.total) * 100) : 0;
                    return (
                      <th key={stage.key} style={{ ...S.th, position: "sticky", top: 0, zIndex: 20, width: 54, minWidth: 54, padding: "6px 2px" }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: stage.color, textAlign: "center", lineHeight: 1.3, whiteSpace: "pre-line" }}>
                          {stage.label}
                        </div>
                        <div style={{ fontSize: 16, color: pct === 100 ? "#22c55e" : "#4b5563", marginTop: 3 }}>
                          {cp.done}/{cp.total}
                        </div>
                      </th>
                    );
                  })}
                  {/* Progress header */}
                  <th style={{ ...S.th, position: "sticky", top: 0, zIndex: 20, minWidth: 88, textAlign: "center" }}>
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, i) => {
                  const done    = rowComplete(item.id);
                  const { done: rd, total: rt } = rowProgress(item.id);
                  const rowPct  = rt ? Math.round((rd / rt) * 100) : 0;
                  const rowBg   = done ? "#22c55e0d" : i % 2 === 0 ? "#0f172a" : "#111827";

                  return (
                    <tr key={item.id}>
                      {/* Item name — sticky left */}
                      <td style={{ ...S.td, position: "sticky", left: 0, zIndex: 5, background: rowBg, minWidth: 230, paddingLeft: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16, color: "#9ca3af", minWidth: 24, fontWeight: 600, textAlign: "right" }}>
                            {i + 1}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: done ? "#22c55e" : "#f1f5f9", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 170 }}>
                              {item.name}
                            </div>
                            {(item.category || item.supplier) && (
                              <div style={{ fontSize: 16, color: "#9ca3af", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 170 }}>
                                {[item.category, item.supplier].filter(Boolean).join(" · ")}
                              </div>
                            )}
                          </div>
                          {done && <span style={{ marginLeft: "auto", flexShrink: 0 }}>✅</span>}
                        </div>
                      </td>

                      {/* Stage cells */}
                      {STAGES.map((stage) => {
                        const rec = getRecord(item.id, stage.key);
                        const st  = STATUS[rec.status] || STATUS.pending;
                        return (
                          <td key={stage.key} style={{ ...S.td, background: rowBg, textAlign: "center", padding: "4px 2px" }}>
                            <button
                              onClick={() => handleCellClick(item, stage)}
                              title={`${item.name} — ${stage.label.replace("\n", " ")}: ${rec.status}${rec.notes ? "\n" + rec.notes : ""}`}
                              style={{
                                width: 36, height: 36, borderRadius: 8,
                                background: st.bg,
                                border: st.border || "none",
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer",
                                fontSize: 16, color: st.text, fontWeight: 600,
                              }}
                            >
                              {st.icon}
                            </button>
                          </td>
                        );
                      })}

                      {/* Progress */}
                      <td style={{ ...S.td, background: rowBg, padding: "0 10px", minWidth: 88 }}>
                        <div style={{ fontSize: 16, color: done ? "#22c55e" : "#6b7280", marginBottom: 3, fontWeight: done ? 700 : 400 }}>
                          {rd}/{rt}
                        </div>
                        <div style={{ height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${rowPct}%`, background: done ? "#22c55e" : "#3b82f6", borderRadius: 2 }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Cell Detail Popup ─────────────────────────────────────────────── */}
      {selectedCell && (
        <div style={S.overlay} onClick={() => setSelectedCell(null)}>
          <div style={S.popup} onClick={(e) => e.stopPropagation()}>

            {/* Popup header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: selectedCell.stage.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  {selectedCell.stage.label.replace("\n", " ")}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#f1f5f9" }}>{selectedCell.item.name}</div>
                {(selectedCell.item.category || selectedCell.item.supplier) && (
                  <div style={{ fontSize: 16, color: "#9ca3af", marginTop: 2 }}>
                    {[selectedCell.item.category, selectedCell.item.supplier].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedCell(null)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 4px" }}>
                ×
              </button>
            </div>

            {/* Completed info */}
            {selectedCell.record.completed_at && cellForm.status === "done" && (
              <div style={{ fontSize: 16, color: "#22c55e", background: "#22c55e18", border: "1px solid #22c55e44", borderRadius: 8, padding: "8px 12px" }}>
                ✓ Completed {fmtDate(selectedCell.record.completed_at)}
                {selectedCell.record.completed_by ? ` by ${selectedCell.record.completed_by}` : ""}
              </div>
            )}

            {/* Status buttons */}
            <div>
              <div style={{ fontSize: 16, color: "#94a3b8", fontWeight: 600, marginBottom: 8 }}>Status</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  ["pending",     "○ Pending"],
                  ["in_progress", "◑ In Progress"],
                  ["done",        "✓ Complete"],
                  ["na",          "— Not Applicable"],
                ].map(([s, label]) => (
                  <button
                    key={s}
                    onClick={() => setCellForm((f) => ({ ...f, status: s }))}
                    style={{
                      padding: "9px 12px", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer",
                      border: "2px solid",
                      borderColor: cellForm.status === s ? STATUS[s].bg : "#334155",
                      background:  cellForm.status === s ? STATUS[s].bg : "#1e293b",
                      color:       cellForm.status === s ? (STATUS[s].text || "#fff") : "#9ca3af",
                      textAlign: "left",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Completed by */}
            <label style={S.fl}>
              Completed by
              <input
                style={S.input}
                placeholder="Name / initials"
                value={cellForm.completed_by}
                onChange={(e) => setCellForm((f) => ({ ...f, completed_by: e.target.value }))}
              />
            </label>

            {/* Notes */}
            <label style={S.fl}>
              Notes / Details
              <textarea
                style={{ ...S.input, minHeight: 90, resize: "vertical" }}
                placeholder={"e.g. 3 quotes received — selected ABC Supplies @ $4,200\nDelivery ETA: 3 weeks from 15 May"}
                value={cellForm.notes}
                onChange={(e) => setCellForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.cancelBtn} onClick={() => setSelectedCell(null)}>Cancel</button>
              <button style={S.saveBtn} onClick={saveCellUpdate} disabled={savingCell}>
                {savingCell ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Items Modal ───────────────────────────────────────────────── */}
      {showAdd && (
        <div style={S.overlay} onClick={() => setShowAdd(false)}>
          <div style={{ ...S.popup, width: "min(540px, 95vw)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#f1f5f9" }}>Add Items</div>

            {/* Mode tabs */}
            <div style={{ display: "flex", gap: 8 }}>
              {[["single", "Single Item"], ["bulk", "Bulk Add (paste list)"]].map(([m, l]) => (
                <button
                  key={m}
                  onClick={() => setAddMode(m)}
                  style={{
                    ...S.filterBtn,
                    ...(addMode === m ? S.filterBtnActive : {}),
                    borderRadius: 8, padding: "8px 16px", fontSize: 16,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            {addMode === "single" ? (
              <>
                <label style={S.fl}>
                  Item Name <span style={{ color: "#ef4444" }}>*</span>
                  <input style={S.input} autoFocus placeholder="e.g. Kitchen Cabinets"
                    value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  <label style={{ ...S.fl, flex: 1 }}>
                    Category
                    <input style={S.input} placeholder="e.g. Joinery"
                      value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))} />
                  </label>
                  <label style={{ ...S.fl, flex: 1 }}>
                    Supplier
                    <input style={S.input} placeholder="e.g. ABC Supplies"
                      value={addForm.supplier} onChange={(e) => setAddForm((f) => ({ ...f, supplier: e.target.value }))} />
                  </label>
                </div>
                <label style={S.fl}>
                  Notes
                  <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }}
                    value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))} />
                </label>
              </>
            ) : (
              <label style={S.fl}>
                Paste item names — one per line
                <textarea
                  autoFocus
                  style={{ ...S.input, minHeight: 180, resize: "vertical", fontFamily: "monospace", fontSize: 16 }}
                  placeholder={"Kitchen Cabinets\nEngineered Flooring\nBathroom Floor Tiles\nWindows & Glazing\nRoofing Sheets\nElectrical Fittings\nPlumbing Fixtures\n..."}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
                {bulkText.trim() && (
                  <span style={{ fontSize: 16, color: "#9ca3af" }}>
                    {bulkText.split("\n").filter((l) => l.trim()).length} items will be added
                  </span>
                )}
              </label>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
              <button
                style={{
                  ...S.saveBtn,
                  opacity: ((addMode === "single" ? !addForm.name.trim() : !bulkText.trim()) || addSaving) ? 0.5 : 1,
                }}
                disabled={(addMode === "single" ? !addForm.name.trim() : !bulkText.trim()) || addSaving}
                onClick={addItems}
              >
                {addSaving
                  ? "Adding…"
                  : addMode === "bulk"
                  ? `Add ${bulkText.split("\n").filter((l) => l.trim()).length} Items`
                  : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:      { minHeight: "100vh", background: "#0f0f1a", color: "#f1f5f9", padding: "22px 20px", fontFamily: "system-ui, -apple-system, sans-serif" },
  loadScreen:{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f1a", color: "#9ca3af", fontSize: 16, fontFamily: "system-ui, sans-serif", gap: 8 },

  header:  { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 },
  backLink:{ fontSize: 16, color: "#3b82f6", textDecoration: "none", fontWeight: 500, display: "block", marginBottom: 6 },
  jobTitle:{ fontSize: 24, fontWeight: 600, margin: 0 },
  jobSub:  { fontSize: 16, color: "#9ca3af", marginTop: 2 },

  statBox: { background: "#1a1a2e", border: "1px solid #334155", borderRadius: 10, padding: "8px 16px", textAlign: "center" },
  statNum: { fontSize: 22, fontWeight: 600, color: "#3b82f6" },
  statLbl: { fontSize: 16, color: "#9ca3af", marginTop: 1 },
  addBtn:  { background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 16, fontWeight: 600, cursor: "pointer" },

  toolbar:       { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "10px 14px", background: "#1a1a2e", border: "1px solid #334155", borderRadius: 10, marginBottom: 14 },
  legend:        { display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" },
  filterBtn:     { background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 20, padding: "5px 12px", fontSize: 16, cursor: "pointer" },
  filterBtnActive:{ background: "#3b82f6", color: "#fff", border: "1px solid #3b82f6" },

  matrixWrap:{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 256px)", borderRadius: 12, border: "1px solid #1e293b" },
  table:     { borderCollapse: "collapse", tableLayout: "auto", minWidth: "max-content", width: "100%" },
  th:        { background: "#1a1a2e", color: "#9ca3af", fontWeight: 600, fontSize: 16, padding: "10px 6px", borderBottom: "2px solid #334155", whiteSpace: "nowrap" },
  td:        { padding: "5px 4px", borderBottom: "1px solid #1a1a2e", verticalAlign: "middle" },

  empty: { textAlign: "center", padding: "80px 0", color: "#9ca3af", fontSize: 16 },

  overlay:   { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  popup:     { background: "#1a1a2e", border: "1px solid #334155", borderRadius: 16, padding: 24, width: "min(480px, 95vw)", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 },

  fl:        { display: "flex", flexDirection: "column", gap: 5, fontSize: 16, color: "#94a3b8", fontWeight: 500 },
  input:     { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", padding: "9px 12px", fontSize: 16, outline: "none" },
  cancelBtn: { background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "9px 16px", fontSize: 16, cursor: "pointer" },
  saveBtn:   { background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 16, fontWeight: 600, cursor: "pointer" },
};
