// pages/modules/funnels/templates.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import supabaseDefault, { supabase as supabaseNamed } from "../../../utils/supabase-client";
const supabase = supabaseNamed || supabaseDefault;

/* ---------- helper functions (HOISTED) ---------- */
function inp() {
  return "background:#0b1220;border:1px solid #1f2937;color:#e5e7eb;padding:10px;border-radius:8px";
}
function btn() {
  return "background:#22a06b;color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer";
}
function styleBlock() {
  return `
<style>
  .root { --primary:#3b82f6; --accent:#22c55e; color:#eaeaea; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 40px 16px; }
  h1,h2,h3 { margin: 8px 0 6px; font-weight: 800; }
  .lead { opacity:.9; margin: 8px 0 20px; }
  .sec { margin: 26px 0; }
</style>`;
}
function makeSlug(s = "") {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "page";
}
function makeOptin({ long }) {
  const longCopy = long
    ? `<p class="lead">Tell a slightly longer story about your offer. Benefits in a short bulleted list works well.</p>`
    : `<p class="lead">Short, punchy promise + irresistible lead magnet.</p>`;

  return `
<div class="root">
  <main class="wrap">
    <section class="sec">
      <h1 style="text-align:center">Get the Free Guide</h1>
      ${longCopy}
      <form method="post" style="display:grid;gap:10px;max-width:480px;margin:0 auto">
        <input name="name"  type="text"  placeholder="Your name"  style="${inp()}"/>
        <input name="email" type="email" placeholder="Your email" style="${inp()}"/>
        <input name="phone" type="tel"   placeholder="Your phone" style="${inp()}"/>
        <button type="submit" style="${btn()}">Send me the guide</button>
      </form>
    </section>
  </main>
  ${styleBlock()}
</div>`;
}
function makeSales({ long }) {
  const section2 = long
    ? `<section class="sec"><h2>Why this works</h2><p>Explain the mechanisms, proof, and value. Add bullets and social proof.</p></section>`
    : ``;

  return `
<div class="root">
  <main class="wrap">
    <section class="sec">
      <h1>New offer</h1>
      <p class="lead">Short promise. Start the story.</p>
    </section>
    ${section2}
    <section class="sec">
      <h3>Get started</h3>
      <form method="post" style="display:grid;gap:10px;max-width:480px">
        <input name="name"  type="text"  placeholder="Your name"  style="${inp()}"/>
        <input name="email" type="email" placeholder="Your email" style="${inp()}"/>
        <input name="phone" type="tel"   placeholder="Your phone" style="${inp()}"/>
        <button type="submit" style="${btn()}">Buy now</button>
      </form>
    </section>
  </main>
  ${styleBlock()}
</div>`;
}

/* ---------- templates data ---------- */
const TEMPLATES = [
  {
    id: "optin-short",
    title: "Opt-in (Short)",
    kind: "Opt-in",
    length: "Short",
    thumb: "https://placehold.co/640x360?text=Opt-in+Short",
    html: makeOptin({ long: false }),
  },
  {
    id: "optin-long",
    title: "Opt-in (Long)",
    kind: "Opt-in",
    length: "Long",
    thumb: "https://placehold.co/640x360?text=Opt-in+Long",
    html: makeOptin({ long: true }),
  },
  {
    id: "sales-short",
    title: "Sales (Short)",
    kind: "Sales",
    length: "Short",
    thumb: "https://placehold.co/640x360?text=Sales+Short",
    html: makeSales({ long: false }),
  },
  {
    id: "sales-long",
    title: "Sales (Long)",
    kind: "Sales",
    length: "Long",
    thumb: "https://placehold.co/640x360?text=Sales+Long",
    html: makeSales({ long: true }),
  },
];

/* ---------- component ---------- */
export default function Templates() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [kind, setKind] = useState("All");     // All | Opt-in | Sales
  const [length, setLength] = useState("All"); // All | Short | Long
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
    })();
  }, []);

  const filtered = useMemo(() => {
    return TEMPLATES.filter(
      (t) => (kind === "All" || t.kind === kind) && (length === "All" || t.length === length)
    );
  }, [kind, length]);

  async function useTemplate(t) {
    setBusyId(t.id);
    try {
      // 1) create funnel
      const insF = await supabase
        .from("funnels")
        .insert({ name: `${t.title} funnel` })
        .select()
        .single();
      if (insF.error) throw insF.error;
      const funnelId = insF.data.id;

      // 2) create page from template
      const insP = await supabase
        .from("pages")
        .insert({
          funnel_id: funnelId,
          title: t.title,
          slug: makeSlug(t.title),
          html: t.html,
          published: false,
        })
        .select()
        .single();
      if (insP.error) throw insP.error;

      router.push(`/editor/${funnelId}?page=${insP.data.id}`);
    } catch (e) {
      console.error("Template create error:", e);
      alert(`Could not create from template.\n${e.message || e}`);
      setBusyId("");
    }
  }

  if (!session) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div>Please log in.</div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <a href="/modules/funnels" style={pill(false)}>My funnels</a>
        <span style={pill(true)}>Templates</span>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={select}>
            <option>All</option>
            <option>Opt-in</option>
            <option>Sales</option>
          </select>
          <select value={length} onChange={(e) => setLength(e.target.value)} style={select}>
            <option>All</option>
            <option>Short</option>
            <option>Long</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
        {filtered.map((t) => (
          <article
            key={t.id}
            style={{
              border: "1px solid #1f2937",
              background: "#0b1220",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <img
              src={t.thumb}
              alt=""
              style={{ width: "100%", borderRadius: 8, border: "1px solid #1f2937" }}
            />
            <div style={{ marginTop: 10, fontWeight: 700 }}>{t.title}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {t.kind} • {t.length}
            </div>
            <button
              onClick={() => useTemplate(t)}
              disabled={!!busyId}
              style={{
                marginTop: 10,
                background: "#22a06b",
                color: "#fff",
                border: "none",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                width: "100%",
              }}
            >
              {busyId === t.id ? "Creating…" : "Use template"}
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}

/* ---------- small styling helpers ---------- */
const pill = (active) => ({
  display: "inline-block",
  border: `1px solid ${active ? "#93c5fd" : "#374151"}`,
  background: active ? "#0b2a58" : "#111827",
  color: "#e5e7eb",
  padding: "8px 12px",
  borderRadius: 999,
  textDecoration: "none",
});
const select = {
  background: "#0b1220",
  color: "#e5e7eb",
  border: "1px solid #374151",
  padding: "8px 10px",
  borderRadius: 8,
};
