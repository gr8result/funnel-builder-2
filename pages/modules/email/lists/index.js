// /pages/modules/email/lists/index.js
// GR8 RESULT — BULK DELETE + BIG CHECKBOXES + NAME SORTING + SHARED AVATARS
// ✅ Restores click-to-open Lead Details modal (row click)
// ✅ Prevents row-click when using checkbox / edit / delete buttons
// ✅ Loads stages from crm_pipelines (first pipeline) for LeadDetailsModal

import { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import { supabase } from "../../../../utils/supabase-client";
import SubscriberAvatar from "/components/crm/SubscriberAvatar";
import LeadDetailsModal from "/components/crm/LeadDetailsModal";
import { getAvatarForLead } from "../../../../utils/avatar";
import { useApiFetch, useWorkspace } from "../../../../hooks/useWorkspace";

const TEAM_STORAGE_KEY_PREFIX = "crm:pipeline:teams:";

const SUPPORTED_IMPORT_FIELDS = [
  { key: "first_name", label: "First Name", aliases: ["first name", "firstname", "first"] },
  { key: "last_name", label: "Last Name", aliases: ["last name", "lastname", "surname", "last"] },
  { key: "company", label: "Company", aliases: ["company", "business", "organisation", "organization"] },
  { key: "email", label: "Email", aliases: ["email", "email address", "e-mail"] },
  { key: "phone", label: "Phone", aliases: ["phone", "telephone", "phone number"] },
  { key: "mobile", label: "Mobile", aliases: ["mobile", "cell", "mobile phone"] },
  { key: "address", label: "Address", aliases: ["address", "street"] },
  { key: "city", label: "City", aliases: ["city", "suburb"] },
  { key: "state", label: "State", aliases: ["state", "province"] },
  { key: "postcode", label: "Postcode", aliases: ["postcode", "postal code", "zip"] },
  { key: "country", label: "Country", aliases: ["country"] },
  { key: "website", label: "Website", aliases: ["website", "url", "site"] },
  { key: "tags", label: "Tags", aliases: ["tags", "tag"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "comments"] },
  { key: "lead_source", label: "Lead Source", aliases: ["lead source", "source", "origin"] },
  { key: "custom", label: "Custom Fields", aliases: [] },
];

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function detectMapping(headers) {
  const mapping = {};
  headers.forEach((header) => {
    const normal = String(header || "").trim().toLowerCase().replace(/[_-]+/g, " ");
    const match = SUPPORTED_IMPORT_FIELDS.find((field) => field.aliases.includes(normal));
    mapping[header] = match?.key || "";
  });
  return mapping;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function readStoredJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function buildDefaultTeams() {
  return [
    {
      id: "team_default",
      name: "Sales Team",
      manager: "Owner",
      members: "Closer, Setter",
      target: 25000,
      color: "#22c55e",
    },
  ];
}

export default function EmailListsDashboard() {
  const apiFetch = useApiFetch();
  const { workspaceId, loading: workspaceLoading } = useWorkspace();
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSubscriber, setEditingSubscriber] = useState(false);
  const [userId, setUserId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const [showAllMode, setShowAllMode] = useState(false);
  const [listSearch, setListSearch] = useState("");

  // name sort: "asc" | "desc"
  const [nameSort, setNameSort] = useState("asc");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "",
    tags: "",
    notes: "",
    list_id: "",
    id: undefined,
  });

  // IMPORT CSV modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importListId, setImportListId] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importHeaders, setImportHeaders] = useState([]);
  const [importRows, setImportRows] = useState([]);
  const [importMapping, setImportMapping] = useState({});
  const [importDuplicateMode, setImportDuplicateMode] = useState("ignore");
  const [importNewListName, setImportNewListName] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [editingListForm, setEditingListForm] = useState(null);

  // ✅ Lead Details modal state
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [stages, setStages] = useState([]);
  const [teamRows, setTeamRows] = useState([]);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId && workspaceId) {
      loadLists();
      loadStages();
      loadTeams();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, workspaceId]);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) setUserId(user.id);
  }

  async function loadStages() {
    try {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("stages")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1);

      if (error) {
        console.error("loadStages error:", error);
        setStages([]);
        return;
      }

      const first = data?.[0];
      const s = first?.stages;

      if (Array.isArray(s)) setStages(s);
      else if (typeof s === "string") {
        try {
          const parsed = JSON.parse(s);
          setStages(Array.isArray(parsed) ? parsed : []);
        } catch {
          setStages([]);
        }
      } else {
        setStages([]);
      }
    } catch (e) {
      console.error("loadStages exception:", e);
      setStages([]);
    }
  }

  function loadTeams() {
    const storedTeams = readStoredJson(
      `${TEAM_STORAGE_KEY_PREFIX}${userId}`,
      buildDefaultTeams()
    );
    setTeamRows(Array.isArray(storedTeams) && storedTeams.length ? storedTeams : buildDefaultTeams());
  }

  async function loadLists() {
    if (!workspaceId) return;
    const res = await apiFetch(`/api/crm/lead-lists?workspace_id=${encodeURIComponent(workspaceId)}`);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.ok) {
      console.error(json.error || "Could not load lists");
      setLoading(false);
      return;
    }

    const nextLists = json.lists || [];
    setLists(nextLists);

    if (nextLists.length > 0) {
      const selected = selectedList
        ? nextLists.find((list) => list.id === selectedList.id) || nextLists[0]
        : nextLists[0];
      setSelectedList(selected);
      loadSubscribers(selected.id);
    } else {
      setSelectedList(null);
      setSubscribers([]);
      setLoading(false);
    }
  }

  async function loadSubscribers(listId) {
    if (!listId) return;

    setShowAllMode(false); // auto disable show-all
    setLoading(true);

    const res = await apiFetch(
      `/api/crm/leads?limit=2000&list_id=${encodeURIComponent(listId)}&workspace_id=${encodeURIComponent(workspaceId)}`
    );
    const json = await res.json().catch(() => ({}));

    if (res.ok && json.ok) setSubscribers(json.leads || []);

    setLoading(false);
    setSelectedIds([]);
  }

  // Show All Subscribers
  async function loadAllSubscribers() {
    setShowAllMode(true);
    setSelectedList(null);
    setLoading(true);

    const res = await apiFetch(`/api/crm/leads?limit=2000&workspace_id=${encodeURIComponent(workspaceId)}`);
    const json = await res.json().catch(() => ({}));

    if (res.ok && json.ok) setSubscribers(json.leads || []);

    setLoading(false);
    setSelectedIds([]);
  }

  function getListName(id) {
    const l = lists.find((x) => x.id === id);
    return l ? l.name : "—";
  }

  function getActionColor(action) {
    if (!action) return "#374151";
    switch (action) {
      case "CRM":
        return "#3b82f6";
      case "Automation":
        return "#7c3aed";
      case "Both":
        return "#06b6d4";
      default:
        return "#374151";
    }
  }

  // ✅ Open Lead Details modal
  function openLeadDetails(lead) {
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
  }

  function handleLeadCrmMetaSave(leadId, meta) {
    const patch = {
      source: meta?.source || "",
      tags: meta?.tags || "",
      crmMeta: meta || {},
    };

    setSubscribers((prev) => (prev || []).map((x) => (x.id === leadId ? { ...x, ...patch } : x)));
    setSelectedLead((prev) => (prev?.id === leadId ? { ...prev, ...patch } : prev));
  }

  // EXPORT CSV
  function exportCSV() {
    if (!subscribers || subscribers.length === 0) {
      alert("No subscribers to export.");
      return;
    }

    const columns = [
      ["first_name", "First Name"],
      ["last_name", "Last Name"],
      ["company", "Company"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["mobile", "Mobile"],
      ["address", "Address"],
      ["city", "City"],
      ["state", "State"],
      ["postcode", "Postcode"],
      ["country", "Country"],
      ["website", "Website"],
      ["tags", "Tags"],
      ["notes", "Notes"],
      ["source", "Lead Source"],
      ["list_id", "List"],
    ];

    const rows = subscribers
      .map((s) => {
        return columns
          .map(([key]) => csvCell(key === "list_id" ? getListName(s.list_id) : s[key] ?? s.raw?.[key] ?? ""))
          .join(",");
      })
      .join("\n");

    const header = columns.map(([, label]) => csvCell(label)).join(",");
    const blob = new Blob([header + "\n" + rows], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${selectedList?.name || "leads"}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // IMPORT CSV HANDLING
  function openImportCSV() {
    setImportFile(null);
    setImportListId(selectedList?.id || "");
    setImportHeaders([]);
    setImportRows([]);
    setImportMapping({});
    setImportNewListName("");
    setImportProgress(0);
    setImportResult(null);
    setShowImportModal(true);
  }

  async function handleCSVSelected(e) {
    const file = e.target.files[0];
    setImportFile(file);
    setImportResult(null);
    if (!file) return;
    const text = await file.text();
    const parsed = parseCSV(text);
    const headers = (parsed[0] || []).map((header, index) => String(header || `Column ${index + 1}`).trim());
    const rows = parsed.slice(1).map((row) =>
      headers.reduce((acc, header, index) => {
        acc[header] = row[index] || "";
        return acc;
      }, {})
    );
    setImportHeaders(headers);
    setImportRows(rows);
    setImportMapping(detectMapping(headers));
  }

  async function processCSV() {
    if (!importFile || !importRows.length) {
      alert("Select a file first.");
      return;
    }
    if (!importListId && !importNewListName.trim()) {
      alert("Choose which list to import into.");
      return;
    }

    setImporting(true);
    setImportProgress(10);
    setImportResult(null);
    try {
      let listId = importListId;
      let openedList = lists.find((list) => String(list.id) === String(listId));
      if (!listId && importNewListName.trim()) {
        const listRes = await apiFetch("/api/crm/lead-lists", {
          method: "POST",
          body: JSON.stringify({
            workspace_id: workspaceId,
            name: importNewListName.trim(),
            source_type: "csv",
            color: "#0284c7",
            actionType: "CRM",
            auto_add_crm: true,
          }),
        });
        const listJson = await listRes.json().catch(() => ({}));
        if (!listRes.ok || !listJson.ok) throw new Error(listJson.error || "Could not create list.");
        openedList = listJson.list;
        listId = listJson.list.id;
        setLists((prev) => [...prev, listJson.list]);
      }

      const mappedRows = importRows.map((row) => {
        const lead = { custom_fields: {} };
        importHeaders.forEach((header) => {
          const target = importMapping[header];
          const value = row[header];
          if (!target) return;
          if (target === "custom") lead.custom_fields[header] = value;
          else lead[target] = value;
        });
        return lead;
      });

      setImportProgress(45);
      const res = await apiFetch("/api/lead/import-csv", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: workspaceId,
          list_id: listId,
          leads: mappedRows,
          duplicateMode: importDuplicateMode,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "CSV import failed.");
      setImportProgress(100);
      setImportResult(json);
      await loadLists();
      setSelectedList(openedList || lists.find((list) => String(list.id) === String(listId)) || null);
      await loadSubscribers(listId);
    } catch (error) {
      setImportResult({ ok: false, error: error.message || "CSV import failed." });
    } finally {
      setImporting(false);
    }
  }

  // ------ ADD NEW LIST ------ //
  function openAddList() {
    setEditingListForm({
      id: null,
      name: "",
      source_type: "",
      tags: "",
      auto_add_crm: false,
      action: "None",
      color: "#2563eb",
    });
  }

  // ------ EDIT LIST ------ //
  function openEditList(list) {
    setEditingListForm({
      ...list,
      color: list.color || list.color_tag || "#2563eb",
    });
  }

  async function saveListForm() {
    if (!editingListForm?.name?.trim()) {
      alert("List name is required.");
      return;
    }
    const isEdit = Boolean(editingListForm.id);
    const res = await apiFetch("/api/crm/lead-lists", {
      method: isEdit ? "PATCH" : "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        id: editingListForm.id,
        name: editingListForm.name,
        source_type: editingListForm.source_type || "",
        tags: editingListForm.tags || "",
        color: editingListForm.color || "#2563eb",
        actionType: editingListForm.action || "None",
        auto_add_crm: editingListForm.auto_add_crm || editingListForm.action === "CRM" || editingListForm.action === "Both",
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      alert(json.error || "Could not save list.");
      return;
    }
    if (isEdit) {
      setLists((prev) => prev.map((list) => (list.id === json.list.id ? json.list : list)));
      if (selectedList?.id === json.list.id) setSelectedList(json.list);
    } else {
      setLists((prev) => [...prev, json.list]);
      setSelectedList(json.list);
      await loadSubscribers(json.list.id);
    }
    setEditingListForm(null);
  }

  async function deleteList(list) {
    if (!list?.id) return;
    if (!confirm(`Delete list "${list.name}" and its leads?`)) return;
    const res = await apiFetch("/api/crm/lead-lists", {
      method: "DELETE",
      body: JSON.stringify({ workspace_id: workspaceId, id: list.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      alert(json.error || "Could not delete list.");
      return;
    }
    const remaining = lists.filter((item) => item.id !== list.id);
    setLists(remaining);
    if (selectedList?.id === list.id) {
      const next = remaining[0] || null;
      setSelectedList(next);
      if (next) await loadSubscribers(next.id);
      else setSubscribers([]);
    }
  }

  async function duplicateList(list) {
    const res = await apiFetch("/api/crm/lead-lists", {
      method: "POST",
      body: JSON.stringify({ workspace_id: workspaceId, action: "duplicate", id: list.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      alert(json.error || "Could not duplicate list.");
      return;
    }
    setLists((prev) => [...prev, json.list]);
  }

  // ------ ADD SUBSCRIBER ------ //
  function openAddSubscriber() {
    if (!selectedList) {
      alert("Select a list first.");
      return;
    }

    setForm({
      name: "",
      email: "",
      phone: "",
      source: "",
      tags: "",
      notes: "",
      list_id: selectedList.id,
      id: undefined,
    });

    setEditingSubscriber("new");
  }

  function openEditSubscriber(sub) {
    setForm({
      name: sub.name,
      email: sub.email,
      phone: sub.phone,
      source: sub.source,
      tags: sub.tags,
      notes: sub.notes,
      list_id: sub.list_id,
      id: sub.id,
    });
    setEditingSubscriber("edit");
  }

  // ✅ FIXED: correct payload + avatar saving, matching Leads page
  async function saveSubscriber() {
    if (!form.email.trim()) {
      alert("Email required");
      return;
    }

    const basePayload = {
      user_id: userId,
      workspace_id: workspaceId,
      list_id: form.list_id,
      list: form.list_id,
      name: (form.name || "").trim(),
      email: (form.email || "").trim(),
      phone: (form.phone || "").trim(),
      source: (form.source || "").trim(),
      lead_source: (form.source || "").trim(),
      tags: (form.tags || "").trim(),
      notes: (form.notes || "").trim(),
    };

    const { emoji, color } = getAvatarForLead(basePayload);

    const payload = {
      ...basePayload,
      avatar_icon: emoji,
      avatar_color: color,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingSubscriber === "edit") {
      ({ error } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", form.id));
    } else {
      ({ error } = await supabase.from("leads").insert([payload]));
    }

    if (error) {
      console.error("Save subscriber error:", error);
      alert("Failed to save subscriber.");
      return;
    }

    setEditingSubscriber(false);

    if (showAllMode) loadAllSubscribers();
    else loadSubscribers(form.list_id);
  }

  async function deleteSubscriber(id) {
    if (!confirm("Delete this subscriber?")) return;

    await supabase.from("leads").delete().eq("id", id);

    if (showAllMode) loadAllSubscribers();
    else loadSubscribers(selectedList?.id);
  }

  // ------ BULK DELETE SELECTED ------ //
  async function deleteSelectedSubscribers() {
    if (!selectedIds.length) {
      alert("No subscribers selected.");
      return;
    }

    if (
      !confirm(
        `Delete ${selectedIds.length} selected subscriber${
          selectedIds.length > 1 ? "s" : ""
        }?`
      )
    ) {
      return;
    }

    await supabase.from("leads").delete().in("id", selectedIds);

    if (showAllMode) await loadAllSubscribers();
    else await loadSubscribers(selectedList?.id);
    setSelectedIds([]);
  }

  // ------ SORTED SUBSCRIBERS (BY NAME) ------ //
  const sortedSubscribers = useMemo(() => {
    const arr = [...subscribers];
    if (nameSort === "asc") {
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (nameSort === "desc") {
      arr.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    }
    return arr;
  }, [subscribers, nameSort]);

  const visibleLists = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return lists;
    return lists.filter((list) => String(list.name || "").toLowerCase().includes(q));
  }, [lists, listSearch]);

  // --------------------------------------------------------------------
  // RENDER PAGE
  // --------------------------------------------------------------------
  return (
    <>
      <Head>
        <title>Email Lists • Subscribers</title>
      </Head>

      <main
        style={{
          background: "#0c121a",
          color: "#fff",
          minHeight: "100vh",
          padding: "24px 0 40px",
        }}
      >
        <div style={{ width: "1320px", margin: "0 auto" }}>
          {/* HEADER */}
          <div
            style={{
              background: "linear-gradient(90deg,#0ea5e9,#2563eb)",
              borderRadius: "12px",
              padding: "18px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <span style={{ fontSize: "48px" }}>📥</span>
              <div>
                <h1 style={{ margin: 0, fontSize: "48px" }}>
                  Email Lists & Subscribers
                </h1>
                <p style={{ margin: 0, opacity: 0.9 }}>
                  Manage, import, edit and organise your subscribers.
                </p>
              </div>
            </div>

            <button
              onClick={() => history.back()}
              style={{
                background: "#1e293b",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                padding: "10px 20px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              ⬅ Back
            </button>
          </div>

          <div style={{ display: "flex", gap: "24px" }}>
            {/* SIDEBAR */}
            <aside
              style={{
                width: "320px",
                background: "#0f1724",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.05)",
                padding: "14px",
                flexShrink: 0,
              }}
            >
              <h3>Lists</h3>
              <input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Search lists..."
                style={{
                  width: "100%",
                  background: "#020617",
                  color: "#fff",
                  border: "1px solid #1f2a37",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  marginBottom: "12px",
                }}
              />

              <div
                style={{
                  maxHeight: "520px",
                  overflowY: "auto",
                  marginBottom: "10px",
                }}
              >
                {visibleLists.map((l) => (
                  <div
                    key={l.id}
                    style={{
                      background:
                        selectedList?.id === l.id && !showAllMode
                          ? "#2563eb"
                          : "#111827",
                      borderRadius: "6px",
                      padding: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          width: "12px",
                          height: "34px",
                          borderRadius: "999px",
                          background: l.color || l.color_tag || "#2563eb",
                          flexShrink: 0,
                        }}
                      />
                      <button
                        style={{
                          flex: 1,
                          border: "none",
                          background: "transparent",
                          color: "#fff",
                          fontWeight: "600",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          loadSubscribers(l.id);
                          setSelectedList(l);
                        }}
                      >
                        {l.name}
                        <span
                          style={{
                            display: "inline-flex",
                            marginLeft: "8px",
                            minWidth: "28px",
                            justifyContent: "center",
                            borderRadius: "999px",
                            padding: "2px 7px",
                            background: "rgba(255,255,255,0.14)",
                            color: "#e2e8f0",
                            fontSize: "12px",
                          }}
                        >
                          {Number(l.lead_count || 0).toLocaleString()}
                        </span>
                      </button>

                      <span
                        style={{
                          background: getActionColor(l.action),
                          color: "#fff",
                          borderRadius: "6px",
                          padding: "10px 12px",
                          fontSize: "16px",
                          fontWeight: "600",
                          marginRight: "6px",
                        }}
                      >
                        {l.action || "None"}
                      </span>

                      <button
                        style={{
                          cursor: "pointer",
                          color: "#38bdf8",
                          background: "transparent",
                          border: "none",
                          fontSize: "16px",
                        }}
                        onClick={() => openEditList(l)}
                      >
                        ✏️
                      </button>
                      <button
                        title="Duplicate list"
                        style={{ cursor: "pointer", color: "#a78bfa", background: "transparent", border: "none", fontSize: "16px" }}
                        onClick={() => duplicateList(l)}
                      >
                        ⧉
                      </button>
                      <button
                        title="Delete list"
                        style={{ cursor: "pointer", color: "#f87171", background: "transparent", border: "none", fontSize: "16px" }}
                        onClick={() => deleteList(l)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                style={{
                  background: "#16a34a",
                  color: "#fff",
                  width: "100%",
                  marginTop: "10px",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
                onClick={openAddList}
              >
                + Add List
              </button>

              <button
                style={{
                  background: "#7c3aed",
                  color: "#fff",
                  width: "100%",
                  marginTop: "8px",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
                onClick={openAddSubscriber}
              >
                + Add Subscriber
              </button>

              <button
                onClick={loadAllSubscribers}
                style={{
                  background: "#475569",
                  color: "#fff",
                  width: "100%",
                  marginTop: "14px",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Show All Subscribers
              </button>

              <button
                style={{
                  background: "#0284c7",
                  color: "#fff",
                  width: "100%",
                  marginTop: "12px",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
                onClick={openImportCSV}
              >
                📤 Import CSV
              </button>

              <button
                style={{
                  background: "#14b8a6",
                  color: "#fff",
                  width: "100%",
                  marginTop: "10px",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
                onClick={exportCSV}
              >
                📥 Export CSV
              </button>
            </aside>

            {/* SUBSCRIBERS TABLE */}
            <section
              style={{
                width: "calc(100% - 360px)",
                background: "#0f1724",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.03)",
                padding: "18px",
              }}
            >
              {!showAllMode && selectedList && (
                <h3 style={{ marginBottom: "10px" }}>📋 {selectedList.name}</h3>
              )}

              {/* SELECT/CLEAR/BULK DELETE */}
              {!loading && subscribers.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginBottom: "12px",
                  }}
                >
                  <button
                    onClick={() =>
                      setSelectedIds(sortedSubscribers.map((s) => s.id))
                    }
                    style={{
                      background: "#2563eb",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: "600",
                      color: "#fff",
                      padding: "6px 12px",
                      cursor: "pointer",
                    }}
                  >
                    Select All
                  </button>

                  <button
                    onClick={() => setSelectedIds([])}
                    style={{
                      background: "#4b5563",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: "600",
                      color: "#fff",
                      padding: "6px 12px",
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>

                  <button
                    onClick={deleteSelectedSubscribers}
                    style={{
                      background: "#dc2626",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: "600",
                      color: "#fff",
                      padding: "16px 18px",
                      cursor: "pointer",
                    }}
                  >
                    🗑️ Delete Selected
                  </button>
                </div>
              )}

              {loading ? (
                <p>Loading subscribers...</p>
              ) : subscribers.length === 0 ? (
                <p>No subscribers found.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th></th>
                      <th
                        onClick={() =>
                          setNameSort((prev) => (prev === "asc" ? "desc" : "asc"))
                        }
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        Name {nameSort === "asc" ? "▲" : "▼"}
                      </th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Source</th>

                      {showAllMode && <th>List</th>}

                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedSubscribers.map((s) => {
                      return (
                        <tr
                          key={s.id}
                          onClick={() => openLeadDetails(s)}
                          style={{
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(s.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() =>
                                setSelectedIds((prev) =>
                                  prev.includes(s.id)
                                    ? prev.filter((x) => x !== s.id)
                                    : [...prev, s.id]
                                )
                              }
                              style={{
                                width: "18px",
                                height: "18px",
                                cursor: "pointer",
                              }}
                            />
                          </td>

                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              {/* Shared avatar component */}
                              <SubscriberAvatar lead={s} size={32} fontSize={24} />
                              <span>{s.name || "-"}</span>
                            </div>
                          </td>
                          <td>{s.email}</td>
                          <td>{s.phone || "-"}</td>
                          <td>{s.source || "-"}</td>

                          {showAllMode && <td>{getListName(s.list_id)}</td>}

                          <td style={{ textAlign: "right" }}>
                            <button
                              style={{
                                background: "#2563eb",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                width: "48px",
                                height: "48px",
                                marginRight: "16px",
                                marginBottom: "16px",
                                cursor: "pointer",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditSubscriber(s);
                              }}
                            >
                              ✏️
                            </button>

                            <button
                              style={{
                                background: "#dc2626",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                width: "48px",
                                height: "48px",
                                cursor: "pointer",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSubscriber(s.id);
                              }}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </div>

        {/* ✅ LEAD DETAILS MODAL */}
        <LeadDetailsModal
          isOpen={isLeadModalOpen}
          lead={selectedLead}
          stages={stages}
          userId={userId}
          fontScale={1.35}
          crmMeta={selectedLead?.crmMeta || {}}
          teamOptions={teamRows}
          onCrmMetaSave={handleLeadCrmMetaSave}
          onClose={() => {
            setIsLeadModalOpen(false);
            setSelectedLead(null);
          }}
          onNotesUpdated={(leadId, notes) => {
            // keep this page in sync if notes changed
            setSubscribers((prev) =>
              (prev || []).map((x) => (x.id === leadId ? { ...x, notes } : x))
            );
          }}
        />

        {/* EDIT SUBSCRIBER MODAL */}
        {editingSubscriber && (
          <div
            onClick={() => setEditingSubscriber(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 999,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#0b1220",
                padding: "20px",
                borderRadius: "10px",
                width: "420px",
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <h3>
                {editingSubscriber === "edit" ? "Edit Subscriber" : "Add Subscriber"}
              </h3>

              {/* INPUTS */}
              {["name", "email", "phone", "source", "tags", "notes"].map((f) => (
                <div
                  key={f}
                  style={{
                    marginBottom: "10px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <label
                    style={{
                      marginBottom: "16px",
                      fontSize: "16px",
                      color: "#cbd5e1",
                    }}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </label>

                  <input
                    type="text"
                    value={form[f] || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [f]: e.target.value,
                      }))
                    }
                    style={{
                      padding: "16px",
                      borderRadius: "6px",
                      border: "1px solid #1f2a37",
                      background: "#0f1724",
                      color: "#fff",
                    }}
                  />
                </div>
              ))}

              {/* LIST DROPDOWN */}
              <div
                style={{
                  marginBottom: "16px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <label
                  style={{
                    marginBottom: "16px",
                    fontSize: "18px",
                    color: "#cbd5e1",
                  }}
                >
                  List
                </label>

                <select
                  value={form.list_id || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      list_id: e.target.value,
                    }))
                  }
                  style={{
                    padding: "16px",
                    borderRadius: "6px",
                    border: "1px solid #1f2a37",
                    background: "#0f1724",
                    color: "#fff",
                  }}
                >
                  <option value="">— Select List —</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* BUTTONS */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "16px",
                }}
              >
                <button
                  onClick={saveSubscriber}
                  style={{
                    background: "#22c55e",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "600",
                    color: "#fff",
                    padding: "18px 14px",
                    cursor: "pointer",
                  }}
                >
                  💾 Save
                </button>

                <button
                  onClick={() => setEditingSubscriber(false)}
                  style={{
                    background: "#4b5563",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "600",
                    color: "#fff",
                    padding: "18px 14px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IMPORT CSV MODAL */}
        {showImportModal && (
          <div
            onClick={() => setShowImportModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 999,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#0b1220",
                padding: "20px",
                borderRadius: "10px",
                width: "980px",
                maxWidth: "94vw",
                maxHeight: "90vh",
                overflow: "auto",
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <h3>Import CSV list</h3>

              <label
                style={{
                  marginBottom: "12px",
                  fontSize: "16px",
                  color: "#cbd5e1",
                }}
              >
                Choose List
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 220px", gap: "12px", marginBottom: "16px" }}>
                <select
                  value={importListId}
                  onChange={(e) => setImportListId(e.target.value)}
                  style={{
                    padding: "12px",
                    width: "100%",
                    borderRadius: "6px",
                    border: "1px solid #1f2a37",
                    background: "#0f1724",
                    color: "#fff",
                  }}
                >
                  <option value="">— Add to existing list —</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({Number(l.lead_count || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
                <input
                  value={importNewListName}
                  onChange={(e) => {
                    setImportNewListName(e.target.value);
                    if (e.target.value.trim()) setImportListId("");
                  }}
                  placeholder="Or create new list"
                  style={{
                    padding: "12px",
                    width: "100%",
                    borderRadius: "6px",
                    border: "1px solid #1f2a37",
                    background: "#0f1724",
                    color: "#fff",
                  }}
                />
                <select
                  value={importDuplicateMode}
                  onChange={(e) => setImportDuplicateMode(e.target.value)}
                  style={{
                    padding: "12px",
                    width: "100%",
                    borderRadius: "6px",
                    border: "1px solid #1f2a37",
                    background: "#0f1724",
                    color: "#fff",
                  }}
                >
                  <option value="ignore">Ignore duplicates</option>
                  <option value="merge">Merge duplicates</option>
                  <option value="update">Update existing contacts</option>
                </select>
              </div>

              <input
                type="file"
                accept=".csv"
                onChange={handleCSVSelected}
                style={{ marginBottom: "20px" }}
              />

              {importHeaders.length > 0 && (
                <>
                  <h4 style={{ margin: "4px 0 10px" }}>Column mapping</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "16px" }}>
                    {importHeaders.map((header) => (
                      <label key={header} style={{ display: "grid", gap: "4px", fontSize: "13px", color: "#cbd5e1" }}>
                        {header}
                        <select
                          value={importMapping[header] || ""}
                          onChange={(e) => setImportMapping((prev) => ({ ...prev, [header]: e.target.value }))}
                          style={{
                            padding: "9px",
                            borderRadius: "6px",
                            border: "1px solid #1f2a37",
                            background: "#0f1724",
                            color: "#fff",
                          }}
                        >
                          <option value="">Do not import</option>
                          {SUPPORTED_IMPORT_FIELDS.map((field) => (
                            <option key={field.key} value={field.key}>{field.label}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>

                  <h4 style={{ margin: "4px 0 10px" }}>Preview first 10 rows</h4>
                  <div style={{ overflowX: "auto", border: "1px solid #1f2a37", borderRadius: "8px", marginBottom: "16px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr>
                          {importHeaders.map((header) => (
                            <th key={header} style={{ padding: "8px", borderBottom: "1px solid #1f2a37", textAlign: "left" }}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 10).map((row, idx) => (
                          <tr key={idx}>
                            {importHeaders.map((header) => (
                              <td key={header} style={{ padding: "8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{row[header]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {importing || importProgress > 0 ? (
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ height: "12px", borderRadius: "999px", background: "#1f2937", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${importProgress}%`, background: "#22c55e" }} />
                  </div>
                  <p style={{ margin: "6px 0 0", color: "#cbd5e1" }}>{importProgress}%</p>
                </div>
              ) : null}

              {importResult && (
                <div style={{ background: importResult.ok === false ? "#451a1a" : "#052e1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "10px", marginBottom: "14px" }}>
                  {importResult.ok === false ? (
                    <strong>{importResult.error}</strong>
                  ) : (
                    <div>
                      <strong>Imported {Number(importResult.importedCount || 0).toLocaleString()} leads.</strong>
                      <div>Updated: {Number(importResult.updatedCount || 0).toLocaleString()} | Skipped duplicates: {Number(importResult.skippedDuplicates || 0).toLocaleString()} | Invalid rows: {Number(importResult.invalidRows?.length || 0).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  onClick={processCSV}
                  disabled={importing}
                  style={{
                    background: "#22c55e",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "600",
                    color: "#fff",
                    padding: "12px 16px",
                    cursor: "pointer",
                  }}
                >
                  {importing ? "Importing..." : `Import ${importRows.length ? importRows.length.toLocaleString() : ""}`}
                </button>

                <button
                  onClick={() => setShowImportModal(false)}
                  style={{
                    background: "#4b5563",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "600",
                    color: "#fff",
                    padding: "12px 16px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT LIST MODAL */}
        {editingListForm && (
          <div
            onClick={() => setEditingListForm(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 999,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#0b1220",
                padding: "20px",
                borderRadius: "10px",
                width: "460px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <h3>{editingListForm.id ? "Rename / Edit List" : "Create List"}</h3>
              <label style={{ color: "#cbd5e1", fontSize: 16 }}>List name</label>
              <input
                value={editingListForm.name || ""}
                onChange={(e) => setEditingListForm((prev) => ({ ...prev, name: e.target.value }))}
                style={{ width: "100%", padding: 12, borderRadius: 6, border: "1px solid #1f2a37", background: "#0f1724", color: "#fff", margin: "6px 0 12px" }}
              />
              <label style={{ color: "#cbd5e1", fontSize: 16 }}>Colour tag</label>
              <input
                type="color"
                value={editingListForm.color || "#2563eb"}
                onChange={(e) => setEditingListForm((prev) => ({ ...prev, color: e.target.value }))}
                style={{ width: "100%", height: 46, borderRadius: 6, border: "1px solid #1f2a37", background: "#0f1724", margin: "6px 0 12px" }}
              />
              <label style={{ color: "#cbd5e1", fontSize: 16 }}>Source type</label>
              <input
                value={editingListForm.source_type || ""}
                onChange={(e) => setEditingListForm((prev) => ({ ...prev, source_type: e.target.value }))}
                placeholder="csv, website, facebook..."
                style={{ width: "100%", padding: 12, borderRadius: 6, border: "1px solid #1f2a37", background: "#0f1724", color: "#fff", margin: "6px 0 12px" }}
              />
              <label style={{ color: "#cbd5e1", fontSize: 16 }}>Tags</label>
              <input
                value={editingListForm.tags || ""}
                onChange={(e) => setEditingListForm((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="prelaunch,july"
                style={{ width: "100%", padding: 12, borderRadius: 6, border: "1px solid #1f2a37", background: "#0f1724", color: "#fff", margin: "6px 0 12px" }}
              />
              <label style={{ color: "#cbd5e1", fontSize: 16 }}>Routing</label>
              <select
                value={editingListForm.action || "None"}
                onChange={(e) => setEditingListForm((prev) => ({ ...prev, action: e.target.value }))}
                style={{ width: "100%", padding: 12, borderRadius: 6, border: "1px solid #1f2a37", background: "#0f1724", color: "#fff", margin: "6px 0 18px" }}
              >
                <option value="None">None</option>
                <option value="CRM">CRM</option>
                <option value="Automation">Automation</option>
                <option value="Both">Both</option>
              </select>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={saveListForm} style={{ background: "#22c55e", color: "#fff", border: "none", borderRadius: 8, padding: "12px 16px", fontWeight: 600, cursor: "pointer" }}>
                  Save List
                </button>
                <button onClick={() => setEditingListForm(null)} style={{ background: "#4b5563", color: "#fff", border: "none", borderRadius: 8, padding: "12px 16px", fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
