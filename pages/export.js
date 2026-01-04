// pages/export.js
// Content-only page. Global Layout (SideNav + TopNav) is applied in _app.js.
// Lets the user choose a funnel and download a JSON export.

import { useEffect, useMemo, useState } from "react";
// Works with either default or named supabase export:
import supabaseDefault, { supabase as supabaseNamed } from "../utils/supabase-client";
import { slugify } from "../utils/transfer";

const supabase = supabaseNamed || supabaseDefault;

export default function ExportFunnelsPage() {
  const [session, setSession] = useState(null);
  const [funnels, setFunnels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState(null);
  const [q, setQ] = useState("");

  // ----- session
  useEffect(() => {
    let authSub;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      ({ data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_e, s) => {
        setSession(s || null);
      }));
    })();
    return () => authSub?.unsubscribe();
  }, []);

  // ----- load funnels
  useEffect(() => {
    (async () => {
      setLoading(true);
      // If your schema tracks ownership, add: .eq("user_id", session?.user?.id)
      const { data, error } = await supabase
        .from("funnels")
        .select("id, name")
        .order("created_at", { ascending: false });
      if (!error) setFunnels(data || []);
      setLoading(false);
    })();
  }, [session?.user?.id]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return funnels;
    return funnels.filter(f => (f.name || "").toLowerCase().includes(s));
  }, [q, funnels]);

  async function handleExport(funnel) {
    try {
      setExportingId(funnel.id);

      // Pull pages for the funnel
      const { data: pages, error } = await supabase
        .from("pages")
        .select("id, title, html, slug, published")
        .eq("funnel_id", funnel.id)
        .order("id", { ascending: true });
      if (error) throw error;

      // Build export payload
      const payload = {
        version: 1,
        exported_at: new Date().toISOString(),
        funnel: { id: funnel.id, name: funnel.name },
        pages: (pages || []).map(p => ({
          title: p.title || "",
          html: p.html || "",
          slug: p.slug || null,
          published: !!p.published,
        })),
      };

      // Download as JSON
      const filename = `${slugify(funnel.name || "funnel")}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(err.message || String(err));
    } finally {
      setExportingId(null);
    }
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#eaeaea" }}>
        <p>Please log in.</p>
      </div>
    );
  }

  return (
    <main style={{ minHeight: "100vh", padding: "32px 16px", maxWidth: 960, margin: "0 auto", color: "#eaeaea" }}>
      <h1 style={{ marginBottom: 16 }}>Export a funnel</h1>
      <p style={{ colour: "#9aa0a6", color: "#9aa0a6" }}>
        Select a funnel below to download a <code>.json</code> export.
      </p>

      <div style={{ margin: "12px 0 20px" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search funnels…"
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #333",
            background: "#0f0f0f",
            color: "#eaeaea",
          }}
        />
      </div>

      {loading ? (
        <p style={{ color: "#9aa0a6" }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "#9aa0a6" }}>No funnels found.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: 12,
                background: "#121212",
                border: "1px solid #222",
                borderRadius: 10,
              }}
            >
              <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.name}
              </div>
              <button
                onClick={() => handleExport(f)}
                disabled={exportingId === f.id}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {exportingId === f.id ? "Preparing…" : "Download JSON"}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
