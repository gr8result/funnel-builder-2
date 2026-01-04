// /pages/leads.js
// Leads Manager — unified avatars using utils/avatar + SubscriberAvatar
//
// 🚫 THIS FILE WAS MARKED "LOCKED" BUT HAS BEEN UPDATED WITH GRANT'S APPROVAL.

import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabase-client";
import EditListModal from "../components/lists/EditListModal";

// ✅ Shared avatar logic (single source of truth)
import { getAvatarForLead } from "../utils/avatar";
import SubscriberAvatar from "../components/crm/SubscriberAvatar";
import LeadDetailsModal from "../components/crm/LeadDetailsModal";

export default function LeadsPage() {
  const [lists, setLists] = useState([]);
  const [leads, setLeads] = useState([]);
  const [allMode, setAllMode] = useState(false);
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingLead, setEditingLead] = useState(null);
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "",
    tags: "",
    notes: "",
  });
  const [message, setMessage] = useState("");

  // logged in user id
  const [userId, setUserId] = useState(null);

  // selected IDs for bulk delete
  const [selectedIds, setSelectedIds] = useState([]);

  // List Modal
  const [showListModal, setShowListModal] = useState(false);
  const [editingList, setEditingList] = useState(null);

  // Lead details CRM modal
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [stages, setStages] = useState([]);

  // 🔀 Drag & drop state
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  const [dragTargetListId, setDragTargetListId] = useState(null);

  const router = useRouter();

  // ✅ Resizable columns
  const defaultColWidths = useMemo(
    () => ({
      select: 36, // tighter so checkbox sits closer to avatar
      name: 240, // a bit tighter
      email: 360, // "put that space into the email column"
      phone: 160,
      source: 140,
      actions: 90,
    }),
    []
  );

  const [colWidths, setColWidths] = useState(defaultColWidths);
  const resizingRef = useRef(null);

  function onStartResize(colKey, e) {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 120;

    resizingRef.current = { colKey, startX, startWidth };

    const onMove = (ev) => {
      if (!resizingRef.current) return;
      const { colKey, startX, startWidth } = resizingRef.current;

      const delta = ev.clientX - startX;
      const next = Math.max(getMinWidth(colKey), startWidth + delta);

      setColWidths((prev) => ({ ...prev, [colKey]: next }));
    };

    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function getMinWidth(colKey) {
    if (colKey === "select") return 32;
    if (colKey === "actions") return 70;
    if (colKey === "phone") return 120;
    if (colKey === "source") return 110;
    if (colKey === "name") return 180;
    if (colKey === "email") return 220;
    return 90;
  }

  // load user once
  useEffect(() => {
    (async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("auth error:", error);
        return;
      }
      if (user) {
        setUserId(user.id);
      } else {
        console.warn("No logged-in user found");
      }
    })();
  }, []);

  useEffect(() => {
    loadLists();
    loadStages();
  }, []);

  async function loadStages() {
    try {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("stages")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (error) {
        console.error("loadStages error:", error);
        return;
      }

      if (Array.isArray(data?.stages)) {
        setStages(data.stages);
      }
    } catch (e) {
      console.error("loadStages exception:", e);
    }
  }

  async function loadLists() {
    const { data, error } = await supabase
      .from("lead_lists")
      .select("id,name")
      .order("created_at");

    if (error) console.error(error);
    setLists(data || []);

    if (data?.length) {
      setSelectedList(data[0]);
      await loadLeads(data[0].id);
    } else {
      setLeads([]);
      setLoading(false);
    }
  }

  async function loadLeads(listId) {
    setLoading(true);

    const query = supabase.from("leads").select("*");

    if (!allMode) {
      query.eq("list_id", listId);
    }

    query.order(sortField, { ascending: sortDir === "asc" });

    const { data, error } = await query;

    if (error) console.error("Load leads error:", error);
    setLeads(data || []);
    setSelectedIds([]);
    setLoading(false);
  }

  async function showAllLeads() {
    setAllMode(true);
    setSelectedList(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order(sortField, { ascending: sortDir === "asc" });

    if (error) console.error(error);

    setLeads(data || []);
    setSelectedIds([]);
    setLoading(false);
  }

  function handleSort(field) {
    let direction = sortDir;
    if (field === sortField) {
      direction = sortDir === "asc" ? "desc" : "asc";
      setSortDir(direction);
    } else {
      setSortField(field);
      setSortDir("asc");
    }

    if (allMode) showAllLeads();
    else if (selectedList) loadLeads(selectedList.id);
  }

  function sortIcon(field) {
    if (field !== sortField) return "↕️";
    return sortDir === "asc" ? "⬆️" : "⬇️";
  }

  function showMsg(t) {
    setMessage(t);
    setTimeout(() => setMessage(""), 10000);
  }

  async function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // 🔧 helper to get default pipeline + "New Lead" stage
  async function getDefaultPipelineAndStage() {
    try {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("id, stages")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (error || !data) {
        if (error) console.error("Default pipeline error:", error);
        return { pipelineId: null, stageId: null };
      }

      let stageId = null;
      if (Array.isArray(data.stages)) {
        const match =
          data.stages.find(
            (s) =>
              s.id === "new_lead" ||
              s.title?.toLowerCase() === "new lead" ||
              s.title?.toLowerCase() === "new leads"
          ) || data.stages[0];

        stageId = match?.id || null;
      }

      return { pipelineId: data.id, stageId };
    } catch (e) {
      console.error("Default pipeline exception:", e);
      return { pipelineId: null, stageId: null };
    }
  }

  // CSV IMPORT – uses shared avatar helper
  async function handleImport() {
    if (!selectedList) return showMsg("⚠️ Please select a list first.");

    const { pipelineId, stageId } = await getDefaultPipelineAndStage();

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(Boolean);

        if (!lines.length) return showMsg("❌ Empty CSV file.");

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const hasHeaders =
          headers.includes("email") ||
          headers.includes("name") ||
          headers.includes("phone");

        const rows = hasHeaders ? lines.slice(1) : lines;

        const newLeads = rows
          .map((row) => {
            const cols = row.split(",").map((c) => c.trim());
            let lead = {
              name: "",
              email: "",
              phone: "",
              source: "",
              tags: "",
              notes: "",
            };

            if (hasHeaders) {
              headers.forEach((h, i) => {
                if (
                  ["name", "email", "phone", "source", "tags", "notes"].includes(
                    h
                  )
                ) {
                  lead[h] = cols[i] || "";
                }
              });
            } else {
              const emailCol = cols.find((c) => c.includes("@"));
              lead.email = emailCol || "";
            }

            const baseLead = {
              ...lead,
              list_id: selectedList.id,
              pipeline_id: pipelineId,
              stage: stageId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            // ✅ avatar from shared helper
            const { emoji, color } = getAvatarForLead(baseLead);

            return {
              ...baseLead,
              avatar_icon: emoji,
              avatar_color: color,
            };
          })
          .filter((l) => l.email && l.email.includes("@"));

        if (!newLeads.length) return showMsg("⚠️ No valid emails found.");

        const chunkSize = 100;
        for (let i = 0; i < newLeads.length; i += chunkSize) {
          const chunk = newLeads.slice(i, i + chunkSize);
          const { error } = await supabase.from("leads").insert(chunk);
          if (error) throw error;
          await delay(150);
        }

        showMsg(`✅ Imported ${newLeads.length} leads.`);
        loadLeads(selectedList.id);
      } catch (err) {
        console.error("❌ CSV Import Error:", err);
        showMsg(`❌ Failed to import CSV: ${err.message}`);
      }
    };

    input.click();
  }

  function handleExport() {
    if (!leads.length) return showMsg("⚠️ No leads to export.");

    const headers = ["Name", "Email", "Phone", "Source", "Tags", "Notes"];

    const csv = [
      headers.join(","),
      ...leads.map((l) =>
        [l.name, l.email, l.phone, l.source, l.tags, l.notes].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedList?.name || "leads"}.csv`;
    a.click();
  }

  // Add List Handler — opens modal
  function openAddListModal() {
    if (!userId) {
      showMsg("⚠️ Missing user – please log in again.");
      return;
    }
    setEditingList(null);
    setShowListModal(true);
  }

  // 🔁 DUPLICATE LIST + LEADS (uses full original row so constraints are satisfied)
  async function duplicateList(list) {
    if (!list) return;

    const defaultName = `${list.name} copy`;
    const newName = window.prompt("New list name:", defaultName);
    if (!newName || !newName.trim()) return;

    // 1) load full original list row so we keep required fields like "action"
    const { data: fullList, error: loadErr } = await supabase
      .from("lead_lists")
      .select("*")
      .eq("id", list.id)
      .single();

    if (loadErr || !fullList) {
      console.error("Duplicate list load error:", loadErr);
      showMsg(
        `❌ Failed to duplicate list: ${
          loadErr?.message || "Unable to load original list"
        }`
      );
      return;
    }

    const {
      id: _oldId,
      created_at: _oldCreated,
      updated_at: _oldUpdated,
      ...restFields
    } = fullList;

    const insertPayload = {
      ...restFields,
      user_id: userId || restFields.user_id || null,
      name: newName.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 2) create new list
    const { data: newList, error: listError } = await supabase
      .from("lead_lists")
      .insert([insertPayload])
      .select()
      .single();

    if (listError || !newList) {
      console.error("Duplicate list insert error:", listError);
      showMsg(
        `❌ Failed to duplicate list: ${listError?.message || "Unknown error"}`
      );
      return;
    }

    // 3) fetch leads from original list
    const { data: originalLeads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .eq("list_id", list.id);

    if (leadsError) {
      console.error("Duplicate list leads load error:", leadsError);
      showMsg(
        `⚠️ New list created but copying leads failed: ${
          leadsError.message || "Unknown error"
        }`
      );
      setLists((prev) => [...prev, { id: newList.id, name: newList.name }]);
      setAllMode(false);
      setSelectedList({ id: newList.id, name: newList.name });
      await loadLeads(newList.id);
      return;
    }

    if (originalLeads && originalLeads.length) {
      const now = new Date().toISOString();
      const clonedLeads = originalLeads.map(
        ({ id, created_at, updated_at, ...rest }) => ({
          ...rest,
          list_id: newList.id,
          created_at: now,
          updated_at: now,
        })
      );

      const { error: insertError } = await supabase
        .from("leads")
        .insert(clonedLeads);

      if (insertError) {
        console.error("Duplicate list leads insert error:", insertError);
        showMsg(
          `⚠️ List duplicated but copying some leads may have failed: ${
            insertError.message || "Unknown error"
          }`
        );
      }
    }

    // 4) update UI
    setLists((prev) => [...prev, { id: newList.id, name: newList.name }]);
    setAllMode(false);
    setSelectedList({ id: newList.id, name: newList.name });
    await loadLeads(newList.id);

    showMsg("✅ List duplicated.");
  }

  async function deleteList(id) {
    if (!confirm("Delete this list and all its leads?")) return;

    await supabase.from("leads").delete().eq("list_id", id);
    const { error } = await supabase.from("lead_lists").delete().eq("id", id);

    if (error) showMsg(`❌ ${error.message}`);
    else {
      showMsg("🗑️ List deleted.");
      setLists((prev) => prev.filter((l) => l.id !== id));
      if (selectedList?.id === id) {
        setSelectedList(null);
        setLeads([]);
      }
    }
  }

  function openAdd() {
    setEditingLead({ id: null });
    setForm({
      name: "",
      email: "",
      phone: "",
      source: "",
      tags: "",
      notes: "",
    });
  }

  function openLeadDetails(lead) {
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
  }

  // SAVE LEAD – uses shared avatar helper for NEW leads
  async function saveLead() {
    if (!selectedList && !allMode) return showMsg("⚠️ Select a list first.");

    let pipeline_id = null;
    let stage = null;

    // Only auto-assign pipeline/stage when creating a NEW lead
    if (!editingLead?.id) {
      const res = await getDefaultPipelineAndStage();
      pipeline_id = res.pipelineId;
      stage = res.stageId;
    }

    const payload = {
      ...form,
      list_id: selectedList?.id || null,
      ...(pipeline_id ? { pipeline_id } : {}),
      ...(stage ? { stage } : {}),
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingLead?.id) {
      ({ error } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", editingLead.id));
    } else {
      const baseLead = {
        ...payload,
        created_at: new Date().toISOString(),
      };

      const { emoji, color } = getAvatarForLead(baseLead);

      ({ error } = await supabase.from("leads").insert([
        {
          ...baseLead,
          avatar_icon: emoji,
          avatar_color: color,
        },
      ]));
    }

    if (error) showMsg(`❌ ${error.message}`);
    else {
      showMsg("✅ Lead saved.");
      setEditingLead(null);
      if (allMode) showAllLeads();
      else if (selectedList) loadLeads(selectedList.id);
    }
  }

  async function deleteLead(id) {
    if (!confirm("Delete this subscriber?")) return;

    const { error } = await supabase.from("leads").delete().eq("id", id);

    if (error) showMsg(`❌ ${error.message}`);
    else {
      showMsg("🗑️ Lead deleted.");
      if (allMode) showAllLeads();
      else if (selectedList) loadLeads(selectedList.id);
    }
  }

  // bulk delete selected leads
  async function deleteSelectedLeads() {
    if (!selectedIds.length) {
      showMsg("⚠️ No leads selected.");
      return;
    }

    if (
      !confirm(
        `Delete ${selectedIds.length} selected lead${
          selectedIds.length > 1 ? "s" : ""
        }?`
      )
    ) {
      return;
    }

    const { error } = await supabase.from("leads").delete().in("id", selectedIds);

    if (error) {
      showMsg(`❌ ${error.message}`);
    } else {
      showMsg("🗑️ Selected leads deleted.");
      setSelectedIds([]);
      if (allMode) showAllLeads();
      else if (selectedList) loadLeads(selectedList.id);
    }
  }

  // 🔀 MOVE LEAD TO ANOTHER LIST (drag & drop)
  async function moveLeadToList(leadId, targetListId) {
    if (!leadId || !targetListId) return;
    if (!lists.find((l) => l.id === targetListId)) return;

    const { error } = await supabase
      .from("leads")
      .update({
        list_id: targetListId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (error) {
      console.error("Move lead error:", error);
      showMsg(`❌ Failed to move lead: ${error.message}`);
    } else {
      showMsg("✅ Lead moved to new list.");
      // simple refresh so table always stays in sync
      if (allMode) await showAllLeads();
      else if (selectedList) await loadLeads(selectedList.id);
    }

    setDraggedLeadId(null);
    setDragTargetListId(null);
  }

  return (
    <>
      <Head>
        <title>Leads Manager</title>
      </Head>

      <main className="wrap">
        <div className="inner">
          <div className="banner">
            <div className="banner-left">
              <span className="banner-icon">👥</span>
              <div>
                <h1 className="banner-title">Leads</h1>
                <p className="banner-sub">Manage your subscribers.</p>
              </div>
            </div>

            <div className="banner-right">
              <button className="btn import" onClick={handleImport}>
                📁 Import CSV
              </button>

              <button
                className="btn import"
                style={{ background: "#0ea5e9", width: "150px" }}
                onClick={showAllLeads}
              >
                🔍 Show All Leads
              </button>

              <button
                className="btn back"
                onClick={() => router.push("/dashboard")}
              >
                🔙 Back
              </button>
            </div>
          </div>

          {message && <div className="alert">{message}</div>}

          <div className="content">
            <aside className="lists">
              <h3>Lists</h3>
              <p className="drag-hint">
                Drag a lead row and drop it onto a list to move it.
              </p>

              <div className="list-wrap">
                {lists.map((list) => (
                  <div
                    key={list.id}
                    className={`list-item ${
                      selectedList?.id === list.id && !allMode ? "active" : ""
                    } ${
                      dragTargetListId === list.id && draggedLeadId
                        ? "drop-target"
                        : ""
                    }`}
                    onClick={() => {
                      setAllMode(false);
                      setSelectedList(list);
                      loadLeads(list.id);
                    }}
                    // 🔽 allow dropping a dragged lead onto this list
                    onDragOver={(e) => {
                      if (!draggedLeadId) return;
                      e.preventDefault();
                      setDragTargetListId(list.id);
                    }}
                    onDragLeave={() => {
                      setDragTargetListId((prev) =>
                        prev === list.id ? null : prev
                      );
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!draggedLeadId) return;
                      moveLeadToList(draggedLeadId, list.id);
                    }}
                  >
                    <span>{list.name}</span>
                    <div className="list-actions">
                      <span
                        className="copy"
                        title="Duplicate list"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateList(list);
                        }}
                      >
                        📄
                      </span>
                      <span
                        className="del"
                        title="Delete list"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteList(list.id);
                        }}
                      >
                        🗑
                      </span>
                    </div>
                  </div>
                ))}

                <button className="btn add-list" onClick={openAddListModal}>
                  + Add List
                </button>

                <button className="btn add-lead" onClick={openAdd}>
                  ➕ Add Lead
                </button>
                <button className="btn export" onClick={handleExport}>
                  ⬇️ Export
                </button>
              </div>
            </aside>

            <section className="table">
              {loading ? (
                <p>Loading leads...</p>
              ) : leads.length === 0 ? (
                <p>No leads found.</p>
              ) : (
                <>
                  {/* bulk actions */}
                  <div className="bulk-actions">
                    <button
                      className="bulk-btn bulk-select"
                      onClick={() => setSelectedIds(leads.map((l) => l.id))}
                    >
                      Select All
                    </button>
                    <button
                      className="bulk-btn bulk-clear"
                      onClick={() => setSelectedIds([])}
                    >
                      Clear
                    </button>
                    <button
                      className="bulk-btn bulk-delete"
                      onClick={deleteSelectedLeads}
                    >
                      🗑 Delete Selected
                    </button>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <colgroup>
                        <col style={{ width: colWidths.select }} />
                        <col style={{ width: colWidths.name }} />
                        <col style={{ width: colWidths.email }} />
                        <col style={{ width: colWidths.phone }} />
                        <col style={{ width: colWidths.source }} />
                        <col style={{ width: colWidths.actions }} />
                      </colgroup>

                      <thead>
                        <tr>
                          <th className="col-select"></th>

                          <th
                            className="col-name"
                            onClick={() => handleSort("name")}
                          >
                            Name {sortIcon("name")}
                            <div
                              className="resizer"
                              onMouseDown={(e) => onStartResize("name", e)}
                              title="Drag to resize"
                            />
                          </th>

                          <th
                            className="col-email"
                            onClick={() => handleSort("email")}
                          >
                            Email {sortIcon("email")}
                            <div
                              className="resizer"
                              onMouseDown={(e) => onStartResize("email", e)}
                              title="Drag to resize"
                            />
                          </th>

                          <th
                            className="col-phone"
                            onClick={() => handleSort("phone")}
                          >
                            Phone {sortIcon("phone")}
                            <div
                              className="resizer"
                              onMouseDown={(e) => onStartResize("phone", e)}
                              title="Drag to resize"
                            />
                          </th>

                          <th
                            className="col-source"
                            onClick={() => handleSort("source")}
                          >
                            Source {sortIcon("source")}
                            <div
                              className="resizer"
                              onMouseDown={(e) => onStartResize("source", e)}
                              title="Drag to resize"
                            />
                          </th>

                          <th className="col-actions" style={{ textAlign: "right" }}>
                            Actions
                            <div
                              className="resizer"
                              onMouseDown={(e) => onStartResize("actions", e)}
                              title="Drag to resize"
                            />
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {leads.map((lead) => (
                          <tr
                            key={lead.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              setDraggedLeadId(lead.id);
                            }}
                            onDragEnd={() => {
                              setDraggedLeadId(null);
                              setDragTargetListId(null);
                            }}
                            onClick={() => openLeadDetails(lead)}
                            style={{ cursor: "pointer" }}
                          >
                            <td className="col-select">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(lead.id)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() =>
                                  setSelectedIds((prev) =>
                                    prev.includes(lead.id)
                                      ? prev.filter((x) => x !== lead.id)
                                      : [...prev, lead.id]
                                  )
                                }
                                style={{
                                  width: "18px",
                                  height: "18px",
                                  cursor: "pointer",
                                }}
                              />
                            </td>

                            <td className="col-name">
                              <div className="lead-name-cell">
                                <SubscriberAvatar lead={lead} size={28} fontSize={16} />
                                <span className="name-text">{lead.name || "-"}</span>
                              </div>
                            </td>

                            <td className="col-email truncate">{lead.email}</td>
                            <td className="col-phone truncate">{lead.phone || "-"}</td>
                            <td className="col-source truncate">{lead.source || "-"}</td>

                            <td className="col-actions actions">
                              <button
                                className="delete"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteLead(lead.id);
                                }}
                              >
                                🗑
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>

        {/* SIMPLE LEAD ADD/EDIT MODAL */}
        {editingLead && (
          <div className="modal-overlay" onClick={() => setEditingLead(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{editingLead.id ? "Edit Lead" : "Add Lead"}</h3>

              {["name", "email", "phone", "source", "tags", "notes"].map((f) => (
                <div key={f} className="input-group">
                  <label>{f.charAt(0).toUpperCase() + f.slice(1)}</label>
                  <input
                    type="text"
                    value={form[f]}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, [f]: e.target.value }))
                    }
                  />
                </div>
              ))}

              <div className="modal-actions">
                <button className="btn save" onClick={saveLead}>
                  💾 Save
                </button>
                <button className="btn cancel" onClick={() => setEditingLead(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LIST MODAL */}
        {showListModal && (
          <EditListModal
            userId={userId}
            list={editingList}
            onClose={() => setShowListModal(false)}
            onSaved={loadLists}
          />
        )}

        {/* CRM LEAD DETAILS MODAL */}
        <LeadDetailsModal
          isOpen={isLeadModalOpen}
          lead={selectedLead}
          stages={stages}
          userId={userId}
          fontScale={1.35}
          onClose={() => {
            setIsLeadModalOpen(false);
            setSelectedLead(null);
          }}
          onNotesUpdated={(leadId, notes) => {
            setLeads((prev) =>
              prev.map((l) => (l.id === leadId ? { ...l, notes } : l))
            );
          }}
        />
      </main>

      <style jsx>{`
        .wrap {
          background: #0c121a;
          color: #fff;
          min-height: 100vh;
          padding: 40px 0;
          font-size: 16px;
        }
        .inner {
          width: 1320px;
          margin: 0 auto;
          font-size: 16px;
        }
        .banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #dc2626;
          padding: 16px 22px;
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 16px;
        }
        .banner-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .banner-icon {
          font-size: 48px;
          margin-right: 8px;
        }
        .banner-title {
          font-size: 48px;
          margin: 0;
        }
        .banner-sub {
          font-size: 18px;
          margin: 0;
        }
        .banner-right {
          display: flex;
          gap: 12px;
          margin-right: 12px;
        }
        .btn {
          border: none;
          border-radius: 6px;
          font-weight: 700;
          color: #fff;
          cursor: pointer;
          width: 100%;
          height: 40px;
          transition: all 0.2s;
          text-align: center;
          font-size: 16px;
        }
        .btn.import {
          background: #2563eb;
          width: 130px;
        }
        .btn.export {
          background: #14b8a6;
          margin-top: 8px;
        }
        .btn.add-lead {
          background: #9333ea;
          margin-top: 8px;
        }
        .btn.add-list {
          background: #16a34a;
          margin-top: 8px;
        }
        .btn.back {
          background: #374151;
          width: 130px;
        }
        .btn.save {
          background: #16a34a;
        }
        .btn.cancel {
          background: #374151;
        }
        .btn:hover {
          filter: brightness(1.15);
        }
        .content {
          display: flex;
          gap: 20px;
          align-items: flex-start;
          font-size: 16px;
        }
        .lists {
          width: 280px;
          background: #111827;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 14px;
          font-size: 18px;
        }
        .drag-hint {
          font-size: 16px;
          color: #9ca3af;
          margin: 4px 0 10px;
        }
        .list-item {
          background: #1f2937;
          border-radius: 6px;
          padding: 6px 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 6px;
        }
        .list-item.active {
          background: #2563eb;
        }
        .list-item.drop-target {
          border: 2px dashed #fbbf24;
          background: #1e293b;
        }
        .list-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .list-item .del,
        .list-item .copy {
          cursor: pointer;
          padding-right: 4px;
          font-size: 22px;
          line-height: 1;
        }
        .list-item .del {
          color: #f87171;
        }
        .list-item .copy {
          color: #38bdf8;
        }
        .table {
          flex: 1;
          background: #111827;
          border-radius: 12px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          padding: 18px;
          max-width: calc(1320px - 320px);
          font-size: 16px;
        }
        .bulk-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-bottom: 10px;
        }
        .bulk-btn {
          border: none;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
        }
        .bulk-select {
          background: #2563eb;
          color: #fff;
        }
        .bulk-clear {
          background: #4b5563;
          color: #fff;
        }
        .bulk-delete {
          background: #dc2626;
          color: #fff;
        }
        .bulk-btn:hover {
          filter: brightness(1.15);
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 16px;
          min-width: 900px;
        }

        th,
        td {
          padding: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          cursor: pointer;
          position: relative;
          user-select: none;
        }

        th:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        /* ✅ tighten checkbox -> avatar spacing */
        th.col-select,
        td.col-select {
          padding-left: 6px;
          padding-right: 6px;
          cursor: default;
        }

        .lead-name-cell {
          display: flex;
          align-items: center;
          gap: 8px; /* keep normal spacing between avatar and name */
          min-width: 0;
        }

        .name-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
          display: inline-block;
        }

        .truncate {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }

        .actions {
          text-align: right;
        }

        .delete {
          width: 34px;
          height: 34px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: 4px;
          background: #dc2626;
          color: #fff;
        }

        /* ✅ Column resizer */
        .resizer {
          position: absolute;
          right: 0;
          top: 0;
          height: 100%;
          width: 8px;
          cursor: col-resize;
          z-index: 5;
        }
        th:hover .resizer {
          background: rgba(255, 255, 255, 0.06);
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
        }
        .modal {
          background: #111827;
          padding: 20px;
          border-radius: 10px;
          width: 400px;
          font-size: 16px;
        }
        .input-group {
          margin-bottom: 10px;
          display: flex;
          flex-direction: column;
        }
        .input-group label {
          font-size: 16px;
          margin-bottom: 4px;
        }
        .input-group input {
          padding: 8px;
          border-radius: 6px;
          border: 1px solid #334155;
          background: #0f172a;
          color: #fff;
          font-size: 16px;
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 10px;
        }
        .alert {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid #ef4444;
          color: #ef4444;
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 10px;
          text-align: center;
          font-size: 16px;
        }
      `}</style>
    </>
  );
}
