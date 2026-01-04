// /pages/modules/funnels/index.js
// Funnels list with full GR8 banner + Coming Soon placeholder if needed

import { useEffect, useState } from "react";
import Link from "next/link";
import ICONS from "../../../components/iconMap";
import AuthGate from "../../../components/AuthGate";
import supabaseDefault, { supabase as supabaseNamed } from "../../../utils/supabase-client";
const supabase = supabaseNamed || supabaseDefault;

export default function FunnelsHome() {
  return (
    <AuthGate>
      <FunnelsInner />
    </AuthGate>
  );
}

function FunnelsInner() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let sub;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      ({ data: { subscription: sub } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null)));
    })();
    return () => sub?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function refresh() {
    setLoading(true);

    let data = null, error = null;
    let q1 = supabase.from("funnels").select("id, name, slug, status, updated_at");
    ({ data, error } = await q1.order("updated_at", { ascending: false }));

    if (error && /updated_at/.test(error.message)) {
      let q2 = supabase.from("funnels").select("id, name, slug, status, created_at");
      const r2 = await q2.order("created_at", { ascending: false });
      data = r2.data; error = r2.error;
    }

    if (error) {
      const r3 = await supabase.from("funnels").select("id, name, slug, status");
      data = r3.data; error = r3.error;
    }

    setRows(data || []);
    setLoading(false);
  }

  async function createFunnel() {
    if (!newName.trim()) return alert("Please enter a funnel name.");
    if (!session?.user?.id) return alert("No session.");
    setCreating(true);

    const { data, error } = await supabase
      .from("funnels")
      .insert({
        owner_user_id: session.user.id,
        name: newName.trim(),
        description: "",
        slug: null,
        status: "draft",
      })
      .select("id")
      .single();

    setCreating(false);
    if (error) return alert(error.message);
    window.location.href = `/modules/funnels/edit/${data.id}`;
  }

  async function saveName(id, name) {
    const clean = (name || "").trim();
    if (!clean) return alert("Name can’t be empty.");
    const { error } = await supabase.from("funnels").update({ name: clean }).eq("id", id);
    if (error) return alert(error.message);
    await refresh();
  }

  async function deleteFunnel(id) {
    if (!confirm("Delete this funnel? This cannot be undone.")) return;
    const { error } = await supabase.from("funnels").delete().eq("id", id);
    if (error) return alert(error.message);
    await refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0c121a",
        color: "#fff",
        padding: "28px 22px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          background: "#d946ef",
          padding: "16px 20px",
          borderRadius: 12,
          marginBottom: 26,
          width: "100%",
          maxWidth: 1320,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.15)",
              borderRadius: "50%",
              padding: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {ICONS.funnels({ size: 28 })}
          </div>

          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Funnels</h1>
            <p style={{ margin: 0, fontSize: 15, opacity: 0.95 }}>
              Create, edit & manage multi-step funnels that convert.
            </p>
          </div>
        </div>

        <Link href="/dashboard">
          <button
            style={{
              background: "#1e293b",
              color: "#fff",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ← Back
          </button>
        </Link>
      </div>

      {/* >>> Funnels list section <<< */}

      <main style={{ width: "100%", maxWidth: 1320 }}>
        <h2 style={{ marginTop: 0 }}>Funnel List</h2>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <input
            placeholder="New funnel name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #2b2f36",
              background: "#0f1318",
              color: "#e6eef5",
            }}
          />

          <button
            onClick={createFunnel}
            disabled={creating}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: "#d946ef",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {creating ? "Creating…" : "Create Funnel"}
          </button>
        </div>

        {loading ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <div style={{ marginTop: 16, padding: 20, border: "1px dashed #2b2f36", borderRadius: 12, color: "#a5b5c3" }}>
            No funnels yet — create your first one.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              background: "#0f1318",
              border: "1px solid #2b2f36",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Status</th>
                <th style={th}>Public URL</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <Row key={r.id} row={r} onSave={saveName} onDelete={deleteFunnel} />
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}

/* ---- Row component ---- */

function Row({ row, onSave, onDelete }) {
  const [name, setName] = useState(row.name);

  return (
    <tr>
      <td style={td}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inlineInput}
        />
      </td>
      <td style={td}>{row.status}</td>
      <td style={td}>
        {row.status === "published" && row.slug ? (
          <a href={`/p/${row.slug}`} style={{ color: "#7db2ff" }}>
            {`/p/${row.slug}`}
          </a>
        ) : (
          <span style={{ color: "#6a7a89" }}>—</span>
        )}
      </td>
      <td style={{ ...td, textAlign: "right" }}>
        <div style={{ display: "inline-flex", gap: 8 }}>
          <a href={`/modules/funnels/edit/${row.id}`} style={btnLink}>Edit</a>
          <button onClick={() => onSave(row.id, name)} style={btnSmall}>Save</button>
          <button onClick={() => onDelete(row.id)} style={btnDangerSmall}>Delete</button>
        </div>
      </td>
    </tr>
  );
}

/* ---- styles ---- */

const th = { textAlign: "left", padding: "12px 14px", borderBottom: "1px solid #20252c", color: "#a5b5c3" };
const td = { padding: "12px 14px", color: "#e6eef5" };
const inlineInput = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #2b2f36",
  background: "#0f1318",
  color: "#e6eef5",
};

const btnLink = { color: "#9ec5ff", textDecoration: "none", border: "1px solid #2b2f36", padding: "6px 10px", borderRadius: 8 };
const btnSmall = { padding: "6px 10px", borderRadius: 8, border: "1px solid #2b2f36", background: "#151a21", color: "#e6eef5", cursor: "pointer" };
const btnDangerSmall = { padding: "6px 10px", borderRadius: 8, border: "1px solid #5b1a1f", background: "#3a0f12", color: "#ffd7db", cursor: "pointer" };
