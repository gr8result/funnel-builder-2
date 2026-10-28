// Funnel Builder dashboard: "My Landing Pages" and "My Multi-Step Funnels" for the active workspace.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLandingApi } from "../landing-pages/ui/useLandingApi";

const SORTS = [
  { id: "updated", label: "Last modified" },
  { id: "name", label: "Name (A–Z)" },
  { id: "status", label: "Published first" },
  { id: "created", label: "Newest created" },
];

export function sortItems(items, sort) {
  const list = [...items];
  const time = (v) => (v ? new Date(v).getTime() || 0 : 0);
  if (sort === "name") return list.sort((a, b) => a.name.localeCompare(b.name, "en-AU", { sensitivity: "base" }));
  if (sort === "created") return list.sort((a, b) => time(b.createdAt) - time(a.createdAt));
  if (sort === "status") return list.sort((a, b) => (a.status === "published" ? 0 : 1) - (b.status === "published" ? 0 : 1) || time(b.updatedAt) - time(a.updatedAt));
  return list.sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
}

export function filterItems(items, search) {
  const q = String(search || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => `${item.name} ${item.slug || ""}`.toLowerCase().includes(q));
}

export function landingItems(campaigns = []) {
  return campaigns.map((c) => {
    const page = c.pages?.[0] || null;
    const times = [c.updated_at, page?.updated_at].filter(Boolean).sort();
    return {
      id: c.id,
      kind: "landing",
      name: c.name,
      slug: page?.slug || "",
      page,
      archived: c.status === "archived",
      status: c.status === "archived" ? "deleted" : page?.status === "published" ? "published" : "draft",
      thumbnail: page?.thumbnail || "",
      createdAt: c.created_at,
      updatedAt: times.pop() || c.created_at,
      leads: c.stats?.leads || 0,
      visits: c.stats?.visits || 0,
    };
  });
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function CampaignManager({ onFunnelsChanged }) {
  const { call, ready } = useLandingApi();
  return (
    <div style={{ display: "grid", gap: 28, marginBottom: 40 }}>
      <LandingPagesPanel call={call} ready={ready} />
      <FunnelsPanel call={call} ready={ready} onChanged={onFunnelsChanged} />
    </div>
  );
}

function LandingPagesPanel({ call, ready }) {
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated");

  const load = useCallback(async () => {
    try {
      const j = await call("/api/landing-pages/campaigns?archived=1");
      setCampaigns(j.campaigns || []);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [call]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const all = useMemo(() => landingItems(campaigns || []), [campaigns]);
  const deletedCount = all.filter((i) => i.archived).length;
  const visible = useMemo(() => sortItems(filterItems(all.filter((i) => i.archived === showDeleted), search), sort), [all, showDeleted, search, sort]);

  async function run(item, label, fn) {
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const message = await fn();
      await load();
      setNotice(message || `${label} complete.`);
    } catch (e) {
      const issues = (e.body?.check?.errors || []).map((x) => x?.message || x).filter(Boolean);
      setError(issues.length ? `${e.message}: ${issues.join(" ")}` : e.message);
    } finally {
      setBusyId("");
    }
  }

  const actions = (item) => {
    const page = item.page;
    const busy = busyId === item.id;
    if (item.archived) {
      return [
        <button key="restore" type="button" style={btn("primary")} disabled={busy} onClick={() => run(item, "Restore", async () => { await call(`/api/landing-pages/campaigns/${item.id}`, { method: "POST", body: { action: "restore" } }); return `Restored “${item.name}” as a draft.`; })}>Restore</button>,
      ];
    }
    return [
      page ? <a key="preview" style={btn()} href={`/modules/landing-pages/preview/${page.id}`} target="_blank" rel="noreferrer">Preview</a> : null,
      <Link key="edit" style={btn("primary")} href={page ? `/modules/landing-pages/editor/${page.id}` : `/modules/landing-pages/${item.id}`}>{page ? "Edit" : "Continue setup"}</Link>,
      page?.status === "published" ? <a key="live" style={btn()} href={`/lp/${page.slug}`} target="_blank" rel="noreferrer">View live</a> : null,
      <button key="dup" type="button" style={btn()} disabled={busy} onClick={() => run(item, "Duplicate", async () => { const j = await call(`/api/landing-pages/campaigns/${item.id}`, { method: "POST", body: { action: "duplicate" } }); return `Duplicated as “${j.campaign?.name || "copy"}” (draft).`; })}>Duplicate</button>,
      page ? (page.status === "published"
        ? <button key="unpub" type="button" style={btn()} disabled={busy} onClick={() => { if (window.confirm(`Unpublish “${item.name}”? The public page goes offline; enquiries are kept.`)) run(item, "Unpublish", async () => { await call(`/api/landing-pages/pages/${page.id}`, { method: "POST", body: { action: "unpublish" } }); return `“${item.name}” is now offline (draft).`; }); }}>Unpublish</button>
        : <button key="pub" type="button" style={btn("success")} disabled={busy} onClick={() => run(item, "Publish", async () => { const j = await call(`/api/landing-pages/pages/${page.id}`, { method: "POST", body: { action: "publish" } }); return `Published “${item.name}” at ${j.publicUrl || `/lp/${page.slug}`}.`; })}>Publish</button>) : null,
      <button key="del" type="button" style={btn("danger")} disabled={busy} onClick={() => { if (window.confirm(`Delete “${item.name}”?\n\nIts page goes offline and moves to Deleted. Enquiries and CRM records are kept, and you can restore it later.`)) run(item, "Delete", async () => { await call(`/api/landing-pages/campaigns/${item.id}`, { method: "POST", body: { action: "archive" } }); return `Moved “${item.name}” to Deleted. Use “Show deleted” to restore it.`; }); }}>Delete</button>,
    ].filter(Boolean);
  };

  return (
    <Panel
      testId="my-landing-pages"
      title="My Landing Pages"
      subtitle="Standalone AI landing pages for this workspace. Every enquiry goes to Leads and CRM."
      count={all.length - deletedCount}
      search={search} onSearch={setSearch} sort={sort} onSort={setSort}
      extra={<label style={{ color: "#94a3b8", fontSize: 15, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> Show deleted ({deletedCount})</label>}
      error={error} notice={notice} onRetry={load}
      loading={campaigns === null && !error}
      empty={showDeleted ? "No deleted landing pages." : search ? "No landing pages match your search." : "No landing pages yet. Use “Create standalone landing page” above."}
      items={visible}
      actions={actions}
    />
  );
}

function FunnelsPanel({ call, ready, onChanged }) {
  const [funnels, setFunnels] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated");

  const load = useCallback(async () => {
    try {
      const j = await call("/api/funnels/manage");
      setFunnels(j.funnels || []);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [call]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const items = useMemo(() => (funnels || []).map((f) => ({ ...f, kind: "funnel", status: f.status === "published" ? "published" : "draft", meta: `${f.stepCount} step${f.stepCount === 1 ? "" : "s"}` })), [funnels]);
  const visible = useMemo(() => sortItems(filterItems(items, search), sort), [items, search, sort]);

  async function run(item, body, message) {
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const j = await call("/api/funnels/manage", { method: "POST", body: { id: item.id, ...body } });
      await load();
      onChanged?.();
      setNotice(typeof message === "function" ? message(j) : message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }

  const [pending, setPending] = useState(null);

  const actions = (item) => {
    const busy = busyId === item.id;
    const open = pending?.id === item.id ? pending : null;
    const submitPending = (e) => {
      e.preventDefault();
      const value = open.value.trim();
      if (open.mode === "rename") {
        if (!value) return;
        setPending(null);
        if (value !== item.name) run(item, { action: "rename", name: value }, `Renamed to “${value}”.`);
        return;
      }
      if (value !== item.name.trim()) { setError("Deletion cancelled: the name you typed didn't match."); return; }
      setPending(null);
      run(item, { action: "delete", confirmName: value }, `Deleted “${item.name}”.`);
    };
    return [
      <a key="preview" style={btn()} href={`/p/${encodeURIComponent(item.slug || "preview")}?preview=1&funnelId=${item.id}`} target="_blank" rel="noreferrer">Preview</a>,
      <Link key="edit" style={btn("primary")} href={`/modules/funnels/edit/${item.id}`}>Edit</Link>,
      item.status === "published" && item.slug ? <a key="live" style={btn()} href={`/p/${item.slug}`} target="_blank" rel="noreferrer">View live</a> : null,
      <button key="rename" type="button" style={btn()} disabled={busy} onClick={() => setPending({ id: item.id, mode: "rename", value: item.name })}>Rename</button>,
      <button key="dup" type="button" style={btn()} disabled={busy} onClick={() => run(item, { action: "duplicate" }, `Duplicated “${item.name}” as a draft copy.`)}>Duplicate</button>,
      item.status === "published"
        ? <button key="unpub" type="button" style={btn()} disabled={busy} onClick={() => { if (window.confirm(`Unpublish “${item.name}”? The public funnel goes offline.`)) run(item, { action: "unpublish" }, `“${item.name}” is now a draft.`); }}>Unpublish</button>
        : <button key="pub" type="button" style={btn("success")} disabled={busy} onClick={() => run(item, { action: "publish" }, (j) => `Published “${item.name}” at ${j.url}.`)}>Publish</button>,
      <button key="del" type="button" style={btn("danger")} disabled={busy} onClick={() => setPending({ id: item.id, mode: "delete", value: "" })}>Delete</button>,
      open ? (
        <form key="inline" data-testid={`funnel-${open.mode}-form`} onSubmit={submitPending} style={{ flexBasis: "100%", display: "grid", gap: 8, marginTop: 4, padding: 10, borderRadius: 10, background: open.mode === "delete" ? "#2a1015" : "#111a27", border: `1px solid ${open.mode === "delete" ? "#7f1d1d" : "#2b3650"}` }}>
          <label style={{ color: open.mode === "delete" ? "#fecaca" : "#cbd5e1", fontSize: 14 }}>
            {open.mode === "rename"
              ? "New funnel name"
              : `Permanently delete “${item.name}” and its ${item.stepCount} page${item.stepCount === 1 ? "" : "s"}? Multi-step funnels can't be recovered after deletion. Type the funnel name to confirm.`}
            <input autoFocus value={open.value} onChange={(e) => setPending({ ...open, value: e.target.value })} aria-label={open.mode === "rename" ? "New funnel name" : "Type the funnel name to confirm deletion"} style={{ ...field, width: "100%", marginTop: 6, boxSizing: "border-box" }} />
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="submit" style={btn(open.mode === "delete" ? "danger" : "primary")} disabled={busy || (open.mode === "delete" && open.value.trim() !== item.name.trim())}>{open.mode === "rename" ? "Save name" : "Delete permanently"}</button>
            <button type="button" style={btn()} onClick={() => setPending(null)}>Cancel</button>
          </div>
        </form>
      ) : null,
    ].filter(Boolean);
  };

  return (
    <Panel
      testId="my-multi-step-funnels"
      title="My Multi-Step Funnels"
      subtitle="Multi-page sales funnels you own in this workspace."
      count={items.length}
      search={search} onSearch={setSearch} sort={sort} onSort={setSort}
      error={error} notice={notice} onRetry={load}
      loading={funnels === null && !error}
      empty={search ? "No funnels match your search." : "No multi-step funnels yet. Use “Create multi-step sales funnel” above."}
      items={visible}
      actions={actions}
    />
  );
}

function Panel({ testId, title, subtitle, count, search, onSearch, sort, onSort, extra, error, notice, onRetry, loading, empty, items, actions }) {
  return (
    <section data-testid={testId} aria-labelledby={`${testId}-title`} style={{ background: "linear-gradient(135deg,#141c2b,#0f1622)", border: "1px solid #2b3650", borderRadius: 14, padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h2 id={`${testId}-title`} style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#e6eef5" }}>{title} <span style={{ color: "#64748b", fontWeight: 600, fontSize: 18 }}>({count})</span></h2>
          <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 15 }}>{subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input type="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search by name" aria-label={`Search ${title}`} style={field} />
          <select value={sort} onChange={(e) => onSort(e.target.value)} aria-label={`Sort ${title}`} style={field}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {extra}
        </div>
      </div>
      {error ? <div role="alert" style={{ background: "#3b1219", border: "1px solid #7f1d1d", color: "#fecaca", borderRadius: 10, padding: "10px 12px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{error} <button type="button" style={btn()} onClick={onRetry}>Retry</button></div> : null}
      {notice ? <div role="status" style={{ background: "#0f2a1d", border: "1px solid #166534", color: "#bbf7d0", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>{notice}</div> : null}
      {loading ? <p style={{ color: "#94a3b8" }}>Loading…</p> : items.length === 0 ? (
        <div style={{ padding: "28px 16px", border: "2px dashed #2b3650", borderRadius: 12, textAlign: "center", color: "#94a3b8" }}>{empty}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 14 }}>
          {items.map((item) => <ItemCard key={item.id} item={item} actions={actions(item)} />)}
        </div>
      )}
    </section>
  );
}

const STATUS_STYLE = {
  published: { label: "Published", bg: "#14532d", fg: "#bbf7d0" },
  draft: { label: "Draft", bg: "#422006", fg: "#fde68a" },
  deleted: { label: "Deleted", bg: "#3f1d1d", fg: "#fecaca" },
};

function ItemCard({ item, actions }) {
  const status = STATUS_STYLE[item.status] || STATUS_STYLE.draft;
  const [broken, setBroken] = useState(false);
  return (
    <article data-testid={`${item.kind}-item`} data-item-id={item.id} style={{ background: "#0c121a", border: "1px solid #233046", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ aspectRatio: "16 / 9", background: "linear-gradient(135deg,#1e293b,#0f172a)",       position: "relative", overflow: "hidden", flexShrink: 0 }}>
        {item.thumbnail && !broken
                ? <img src={item.thumbnail} alt="" loading="lazy" onError={() => setBroken(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 15, fontWeight: 600 }}>{item.kind === "funnel" ? "Funnel" : "Landing page"}</div>}
        <span style={{ position: "absolute", top: 10, left: 10, background: status.bg, color: status.fg, borderRadius: 999, padding: "3px 10px", fontSize: 13, fontWeight: 700 }}>{status.label}</span>
      </div>
      <div style={{ padding: "12px 14px 14px", display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#e6eef5", overflowWrap: "anywhere" }}>{item.name}</h3>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>
          Last modified {formatDate(item.updatedAt)}{item.meta ? ` · ${item.meta}` : ""}{item.kind === "landing" ? ` · ${item.leads} enquir${item.leads === 1 ? "y" : "ies"}` : ""}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{actions}</div>
      </div>
    </article>
  );
}

const field = { padding: "9px 12px", borderRadius: 9, border: "1px solid #2b3650", background: "#0c121a", color: "#e6eef5", fontSize: 15, minWidth: 0 };

function btn(kind) {
  const palette = {
    primary: { background: "#2563eb", border: "1px solid #2563eb", color: "#fff" },
    success: { background: "#15803d", border: "1px solid #15803d", color: "#fff" },
    danger: { background: "transparent", border: "1px solid #ef4444", color: "#fca5a5" },
  }[kind] || { background: "#112036", border: "1px solid #34517c", color: "#cfe0ff" };
  return { ...palette, padding: "7px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", textDecoration: "none", lineHeight: 1.2, display: "inline-block" };
}
