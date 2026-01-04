// pages/import.js
// Content-only. Global Layout (SideNav + TopNav) is applied in _app.js.
// Lets user pick a .json export and imports it safely.

import { useState } from "react";
// Works with either default or named supabase export
import supabaseDefault, { supabase as supabaseNamed } from "../utils/supabase-client";
import { validateImportJson, slugify } from "../utils/transfer";

const supabase = supabaseNamed || supabaseDefault;

export default function ImportFunnelPage() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("Reading file…");
    setResult(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      validateImportJson(json);

      setBusy(true);
      setStatus("Creating funnel…");

      // 1) Create funnel
      const { data: funnel, error: fErr } = await supabase
        .from("funnels")
        .insert({ name: json.funnel.name })
        .select()
        .single();
      if (fErr) throw fErr;

      // 2) Collect existing slugs to avoid collisions
      const { data: existingPublished } = await supabase
        .from("pages")
        .select("slug")
        .eq("published", true);

      const used = new Set((existingPublished || []).map(r => (r.slug || "").toLowerCase()));
      function uniqueSlug(base) {
        if (!base) return null;
        let s = slugify(base);
        if (!s) return null;
        let n = 0;
        while (used.has(s.toLowerCase())) {
          n += 1;
          s = `${slugify(base)}-${n}`;
        }
        used.add(s.toLowerCase());
        return s;
      }

      // 3) Insert pages (as UNPUBLISHED for safety)
      const inserted = [];
      for (const p of json.pages) {
        setStatus(`Importing "${p.title || "Untitled"}"…`);
        const payload = {
          funnel_id: funnel.id,
          title: p.title || "",
          html: p.html || "",
          slug: p.slug ? uniqueSlug(p.slug) : null,
          published: false,
        };
        const { data: page, error: pErr } = await supabase
          .from("pages")
          .insert(payload)
          .select()
          .single();
        if (pErr) throw pErr;
        inserted.push(page);
      }

      setResult({ funnel, pages: inserted });
      setStatus("Done.");
    } catch (err) {
      console.error(err);
      alert(err.message || String(err));
      setStatus("Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: "32px 16px", maxWidth: 880, margin: "0 auto", color: "#eaeaea" }}>
      <h1 style={{ marginBottom: 16 }}>Import a funnel</h1>
      <p style={{ color: "#9aa0a6" }}>
        Choose a <code>.json</code> file exported from <code>/export</code>. Pages import as <strong>unpublished</strong> and slug collisions are avoided automatically.
      </p>

      <input
        type="file"
        accept="application/json"
        onChange={onFile}
        disabled={busy}
        style={{ marginTop: 12 }}
      />

      {status && <p style={{ marginTop: 12, color: "#9aa0a6" }}>{status}</p>}

      {result && (
        <div style={{ marginTop: 16, background: "#121212", border: "1px solid #222", padding: 12, borderRadius: 8 }}>
          <div style={{ marginBottom: 8 }}>
            Imported funnel: <strong>{result.funnel.name}</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {result.pages.map(p => (
              <li key={p.id}>
                {p.title || "Untitled"}{" "}
                {p.slug ? <span style={{ color: "#9aa0a6" }}>({p.slug})</span> : null}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 12 }}>
            <a href={`/f/${result.funnel.id}`} style={{ color: "#8ab4f8", textDecoration: "none" }}>
              → Open in editor
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
