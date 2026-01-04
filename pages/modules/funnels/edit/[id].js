// pages/modules/funnels/edit/[id].js
//
// GrapesJS (MIT, white-label) builder with:
// - Drag & drop blocks
// - Template gallery (no external template API)
// - Supabase Assets picker wired into GrapesJS Asset Manager
// - Save step => inline HTML+CSS to funnel_steps.content
//
// No external env required.

import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import AuthGate from "../../../../components/AuthGate";
import supabaseDefault, { supabase as supabaseNamed } from "../../../../utils/supabase-client";
const supabase = supabaseNamed || supabaseDefault;

export default function Page() {
  return (
    <AuthGate>
      <Editor />
    </AuthGate>
  );
}

function Editor() {
  const router = useRouter();
  const { id } = router.query;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState(null);
  const [steps, setSteps] = useState([]);
  const [activeStepId, setActiveStepId] = useState(null);

  const [lists, setLists] = useState([]);
  const [defaultListId, setDefaultListId] = useState(null);
  const [notifyEmail, setNotifyEmail] = useState("");

  const [savingBasics, setSavingBasics] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const editorRef = useRef(null);
  const editorDivRef = useRef(null);

  // Auth
  useEffect(() => {
    let sub;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      ({ data: { subscription: sub } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null)));
    })();
    return () => sub?.unsubscribe?.();
  }, []);

  // Load basics
  useEffect(() => {
    if (!session || !id) return;
    (async () => {
      setLoading(true);

      const { data: f } = await supabase.from("funnels").select("*").eq("id", id).maybeSingle();
      setFunnel(f || null);
      setNotifyEmail(f?.notify_email || "");
      setDefaultListId(f?.default_list_id || null);

      const { data: s } = await supabase
        .from("funnel_steps")
        .select("*")
        .eq("funnel_id", id)
        .order("order_index", { ascending: true });
      setSteps(s || []);
      setActiveStepId((s && s[0]?.id) || null);

      const listsRes = await supabase
        .from("email_lists")
        .select("id,name")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });
      setLists(listsRes.data || []);

      setLoading(false);
    })();
  }, [session?.user?.id, id]);

  // Load GrapesJS
  useEffect(() => {
    if (!editorDivRef.current) return;
    if (editorRef.current) return;

    const init = async () => {
      // Wait for scripts to be present
      if (!window.grapesjs) return;

      const e = window.grapesjs.init({
        container: editorDivRef.current,
        fromElement: false,
        height: "78vh",
        storageManager: false,
        canvas: { styles: [], scripts: [] },
        blockManager: { appendTo: "#gjs-blocks" },
        styleManager: { clearProperties: 1 },
        assetManager: { assets: [], upload: false, autoAdd: false },
      });

      // Blocks
      const bm = e.BlockManager;
      bm.add("hero", {
        label: "Hero",
        category: "Sections",
        content: heroHTML(),
      });
      bm.add("text", {
        label: "Text",
        category: "Basics",
        content: `<section style="padding:24px 16px;background:#0f1318;"><div style="max-width:900px;margin:0 auto;color:#cbd5e1;">Your paragraph…</div></section>`,
      });
      bm.add("image", {
        label: "Image",
        category: "Basics",
        content: `<section style="padding:24px 16px;background:#0f1318;"><div style="max-width:900px;margin:0 auto;"><img src="" style="max-width:100%;border-radius:12px"/></div></section>`,
      });
      bm.add("button", {
        label: "Button",
        category: "Basics",
        content: `<a href="#" style="display:inline-block;background:#2d6cdf;color:#fff;padding:12px 16px;border-radius:12px;text-decoration:none;">Call to action</a>`,
      });
      bm.add("form", {
        label: "Signup form",
        category: "Forms",
        content: leadFormHTML(),
      });

      // Asset Manager → Supabase /assets/<userId>/*
      e.on("asset:upload:start", () => {}); // not used
      await loadSupabaseAssetsIntoGrapes(e, session?.user?.id);

      editorRef.current = e;

      // Load design (active step or blank)
      if (steps.length === 0) {
        e.setComponents(blankHTML());
        setShowPicker(true);
      } else {
        const step = steps.find((s) => s.id === activeStepId);
        e.setComponents(step?.content || blankHTML());
      }
    };

    // Inject CDN if not present
    if (!window.grapesjs) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/grapesjs@0.21.7/dist/css/grapes.min.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/grapesjs@0.21.7/dist/grapes.min.js";
      script.onload = init;
      document.body.appendChild(script);
    } else {
      init();
    }
  }, [editorDivRef.current, steps.length, activeStepId, session?.user?.id]);

  // When active step changes, load content
  useEffect(() => {
    const e = editorRef.current;
    if (!e) return;
    const step = steps.find((s) => s.id === activeStepId);
    if (!step) {
      e.setComponents(blankHTML());
    } else {
      e.setComponents(step.content || blankHTML());
    }
  }, [activeStepId]);

  function slugify(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  async function saveBasics() {
    if (!funnel) return;
    setSavingBasics(true);
    const payload = {
      name: funnel.name || "",
      description: funnel.description || "",
      slug: (funnel.slug || "").trim() || null,
      notify_email: notifyEmail || null,
      default_list_id: defaultListId || null,
    };
    const { error } = await supabase.from("funnels").update(payload).eq("id", funnel.id);
    setSavingBasics(false);
    if (error) {
      if (/duplicate key|slug/i.test(error.message)) return alert("Slug already in use. Pick another.");
      return alert(error.message);
    }
    alert("Saved.");
  }

  async function publish() {
    if (!funnel) return;
    const slug = (funnel.slug || "").trim();
    if (!slug) return alert("Add a slug first, then publish.");
    const { error } = await supabase.from("funnels").update({ status: "published", slug }).eq("id", funnel.id);
    if (error) return alert(error.message);
    setFunnel({ ...funnel, status: "published", slug });
    alert("Published.");
  }

  async function unpublish() {
    if (!confirm("Unpublish this funnel?")) return;
    const { error } = await supabase.from("funnels").update({ status: "draft" }).eq("id", funnel.id);
    if (error) return alert(error.message);
    setFunnel({ ...funnel, status: "draft" });
  }

  async function removeFunnel() {
    if (!confirm("Delete this funnel?")) return;
    const { error } = await supabase.from("funnels").delete().eq("id", funnel.id);
    if (error) return alert(error.message);
    window.location.href = "/modules/funnels";
  }

  function addLocalStep(title = "Step") {
    const tmpId = `tmp_${Date.now()}`;
    const newStep = { id: tmpId, title, content: "", order_index: steps.length, _tmp: true };
    setSteps((prev) => [...prev, newStep]);
    setActiveStepId(tmpId);
    editorRef.current?.setComponents(blankHTML());
    setShowPicker(true);
  }

  async function deleteStep(stepId) {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    if (!confirm("Delete this step?")) return;

    if (step._tmp) {
      const next = steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order_index: i }));
      setSteps(next);
      setActiveStepId(next[0]?.id || null);
      return;
    }

    const { error } = await supabase.from("funnel_steps").delete().eq("id", stepId);
    if (error) return alert(error.message);
    const next = steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order_index: i }));
    setSteps(next);
    setActiveStepId(next[0]?.id || null);
    await Promise.all(next.map((s, i) => supabase.from("funnel_steps").update({ order_index: i }).eq("id", s.id)));
  }

  async function saveActiveStep() {
    const e = editorRef.current;
    if (!e) return;
    const step = steps.find((s) => s.id === activeStepId);
    if (!step) return;

    const html = e.getHtml();
    const css = e.getCss();
    const combined = injectHiddenFields(inlineHTML(html, css), {
      funnel_id: funnel.id,
      step_id: step._tmp ? "" : step.id,
      list_id: defaultListId || "",
      notify_to: notifyEmail || "",
      success_url: `/p/${(funnel.slug || "").trim()}?ok=1`,
    });

    try {
      if (step._tmp) {
        const ins = await supabase
          .from("funnel_steps")
          .insert({
            funnel_id: id,
            title: step.title || "Step",
            content: combined,
            order_index: step.order_index,
          })
          .select("*")
          .single();
        if (ins.error) throw ins.error;

        const finalHtml = combined.replace(/name="step_id" value=""/g, `name="step_id" value="${ins.data.id}"`);
        await supabase.from("funnel_steps").update({ content: finalHtml }).eq("id", ins.data.id);

        setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...ins.data, content: finalHtml } : s)));
        setActiveStepId(ins.data.id);
      } else {
        const upd = await supabase.from("funnel_steps").update({ content: combined }).eq("id", step.id);
        if (upd.error) throw upd.error;
        setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, content: combined } : s)));
      }
      alert("Step saved.");
    } catch (e) {
      alert(e.message || "Save failed");
    }
  }

  function openTemplateGallery() {
    setShowPicker(true);
  }

  // UI
  if (loading) return <Gate>Loading…</Gate>;
  if (!funnel) return <Gate>Not found.</Gate>;

  return (
    <>
      <Head>
        {/* GrapesJS injected dynamically; css here just in case SSR caches */}
        <link rel="preconnect" href="https://unpkg.com" />
      </Head>

      <main style={wrap}>
        {/* Top / basics */}
        <div style={topRow}>
          <div style={{ flex: 1, display: "grid", gap: 8 }}>
            <input
              style={nameInput}
              placeholder="Funnel name"
              value={funnel.name || ""}
              onChange={(e) => setFunnel({ ...funnel, name: e.target.value })}
              onBlur={() => !funnel.slug && setFunnel((x) => ({ ...x, slug: slugify(x.name) }))}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                style={slugInput}
                placeholder="public-url-slug"
                value={funnel.slug || ""}
                onChange={(e) => setFunnel({ ...funnel, slug: e.target.value })}
              />
              <button style={miniBtn} onClick={() => setFunnel((x) => ({ ...x, slug: slugify(x.name) }))}>
                Auto
              </button>
              {funnel.status === "published" && funnel.slug ? (
                <a href={`/p/${funnel.slug}`} target="_blank" rel="noreferrer" style={miniLink}>
                  View
                </a>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label style={label}>Email list</label>
                <select
                  value={defaultListId || ""}
                  onChange={(e) => setDefaultListId(e.target.value || null)}
                  style={select}
                >
                  <option value="">(none)</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Notify email</label>
                <input
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="alerts@yourdomain.com"
                  style={textInput}
                />
              </div>
            </div>

            <textarea
              style={desc}
              placeholder="Description (optional)"
              value={funnel.description || ""}
              onChange={(e) => setFunnel({ ...funnel, description: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={saveBasics} disabled={savingBasics} style={btn}>
              {savingBasics ? "Saving…" : "Save"}
            </button>
            {funnel.status === "published" ? (
              <button onClick={unpublish} style={btnWarn}>Unpublish</button>
            ) : (
              <button onClick={publish} disabled={publishing} style={btnPrimary}>
                {publishing ? "Publishing…" : "Publish"}
              </button>
            )}
            <button onClick={removeFunnel} style={btnDanger}>Delete</button>
          </div>
        </div>

        {/* Steps */}
        <section>
          <div style={stepsBar}>
            <h3 style={{ margin: 0 }}>Steps</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={btn} onClick={() => addLocalStep("New step")}>New step</button>
              <button style={btn} onClick={openTemplateGallery}>Templates</button>
            </div>
          </div>

          {steps.length === 0 ? (
            <Empty>No steps yet. Click <strong>New step</strong> or <strong>Templates</strong>.</Empty>
          ) : (
            <div style={stepsWrap}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveStepId(s.id)}
                    style={{
                      ...pill,
                      background: s.id === activeStepId ? "#2d6cdf" : "#151a21",
                      color: s.id === activeStepId ? "#fff" : "#e6eef5",
                    }}
                  >
                    {i + 1}. {s.title || "Step"}{s._tmp ? " (unsaved)" : ""}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={saveActiveStep} style={btnPrimary}>Save step</button>
                <button onClick={() => deleteStep(activeStepId)} style={btnDanger}>Delete step</button>
              </div>
            </div>
          )}
        </section>

        {/* Builder */}
        <section style={{ marginTop: 12 }}>
          <div style={panel}>
            <div style={panelTitle}>Page editor</div>
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 10 }}>
              <div id="gjs-blocks" style={blocksPane} />
              <div ref={editorDivRef} id="gjs" style={{ borderRadius: 10, overflow: "hidden", background: "#0b1016" }} />
            </div>
          </div>
        </section>

        {/* Template Picker */}
        {showPicker ? (
          <TemplatePicker
            onClose={() => setShowPicker(false)}
            onChoose={(html) => {
              editorRef.current?.setComponents(html);
              setShowPicker(false);
            }}
          />
        ) : null}
      </main>
    </>
  );
}

/* ---------- Supabase Assets → GrapesJS ---------- */
async function loadSupabaseAssetsIntoGrapes(editor, userId) {
  try {
    if (!userId) return;
    const prefix = `${userId}/`;
    const { data, error } = await supabase.storage
      .from("assets")
      .list(prefix, { limit: 200, offset: 0, sortBy: { column: "name", order: "asc" } });
    if (error) return;
    const urls = [];
    for (const f of data || []) {
      const { data: pub } = supabase.storage.from("assets").getPublicUrl(`${prefix}${f.name}`);
      if (pub?.publicUrl) urls.push(pub.publicUrl);
    }
    if (urls.length) editor.AssetManager.add(urls);
  } catch (e) {
    // ignore
  }
}

/* ---------- Template Picker ---------- */
function TemplatePicker({ onClose, onChoose }) {
  const options = [
    { name: "Hero", html: heroHTML() },
    { name: "Lead capture", html: leadPageHTML() },
    { name: "Sales page", html: salesHTML() },
    { name: "Thank you", html: thankyouHTML() },
    { name: "Blank", html: blankHTML() },
  ];
  return (
    <div style={pickerBack}>
      <div style={picker}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, color: "#e6eef5" }}>Templates</h3>
          <button onClick={onClose} style={miniBtn}>Close</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
          {options.map((o) => (
            <button key={o.name} style={tplCard} onClick={() => onChoose(o.html)}>
              <div style={tplThumb}>{o.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- HTML helpers ---------- */
function inlineHTML(html, css) {
  if (!css) return html;
  // Add a <style> tag at top
  return `<style>${css}</style>${html}`;
}

function injectHiddenFields(html, hidden) {
  const { funnel_id, step_id, list_id, notify_to, success_url } = hidden;
  const hiddenInputs = `
<input type="hidden" name="funnel_id" value="${esc(funnel_id)}" />
<input type="hidden" name="step_id" value="${esc(step_id)}" />
<input type="hidden" name="list_id" value="${esc(list_id)}" />
<input type="hidden" name="notify_to" value="${esc(notify_to)}" />
<input type="hidden" name="success_url" value="${esc(success_url)}" />
`.trim();
  return html.replace(/<form\b([^>]*)>/i, (m) => `${m}\n${hiddenInputs}\n`);
}
function esc(s) { return `${s ?? ""}`.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

/* ---------- Starter sections/pages ---------- */
function heroHTML() {
  return `
<section style="padding:64px 16px;background:#0f1318;">
  <div style="max-width:1000px;margin:0 auto;">
    <h1 style="margin:0 0 8px 0;color:#e6eef5;font-size:48px;">Catchy Headline</h1>
    <p style="margin:0 0 16px 0;color:#a5b5c3;font-size:18px;">A short description that supports the headline.</p>
    <a href="#" style="display:inline-block;background:#2d6cdf;color:#fff;padding:12px 16px;border-radius:12px;text-decoration:none;">Call to action</a>
  </div>
</section>`;
}

function leadFormHTML() {
  return `
<form method="post" action="/api/forms/submit" style="display:grid;gap:10px;max-width:520px;">
  <input name="name" placeholder="Your name" style="padding:10px;border-radius:10px;border:1px solid #2b2f36;background:#0f1318;color:#e6eef5;" />
  <input name="email" type="email" placeholder="you@domain.com" required style="padding:10px;border-radius:10px;border:1px solid #2b2f36;background:#0f1318;color:#e6eef5;" />
  <button type="submit" style="padding:12px 16px;border-radius:12px;background:#2d6cdf;color:#fff;border:none;cursor:pointer;">Send</button>
</form>`;
}

function leadPageHTML() {
  return `
${heroHTML()}
<section style="padding:40px 16px;background:#0f1318;">
  <div style="max-width:1000px;margin:0 auto;color:#cbd5e1;">
    <h2 style="margin:0 0 12px 0;color:#e6eef5;">Get the free guide</h2>
    ${leadFormHTML()}
  </div>
</section>`;
}

function salesHTML() {
  return `
${heroHTML()}
<section style="padding:40px 16px;background:#0f1318;">
  <div style="max-width:1000px;margin:0 auto;color:#cbd5e1;">
    <p>Explain benefits. Add an image below.</p>
    <img src="" alt="" style="max-width:100%;border-radius:12px;margin:12px 0;"/>
    <a href="#" style="display:inline-block;background:#22c55e;color:#0f1318;padding:12px 16px;border-radius:12px;text-decoration:none;">Buy now</a>
  </div>
</section>`;
}

function thankyouHTML() {
  return `
<section style="padding:56px 16px;background:#0f1318;">
  <div style="max-width:900px;margin:0 auto;text-align:center;">
    <h2 style="color:#e6eef5">Thanks!</h2>
    <p style="color:#cbd5e1">We’ve sent you an email with the next steps.</p>
  </div>
</section>`;
}

function blankHTML() {
  return `<section style="padding:56px 16px;background:#0f1318;"><div style="max-width:900px;margin:0 auto;color:#cbd5e1;">Start building…</div></section>`;
}

/* ---------- Styles ---------- */
const wrap = { padding: "20px 16px", maxWidth: 1100, margin: "0 auto" };
const topRow = { display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 12 };
const nameInput = { padding: "10px 12px", borderRadius: 10, border: "1px solid #2b2f36", background: "#0f1318", color: "#e6eef5", fontSize: 18, fontWeight: 700, width: "100%" };
const slugInput = { flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #2b2f36", background: "#0f1318", color: "#e6eef5" };
const miniBtn = { padding: "8px 10px", borderRadius: 10, border: "1px solid #2b2f36", background: "#151a21", color: "#e6eef5", cursor: "pointer", fontSize: 12 };
const miniLink = { ...miniBtn, textDecoration: "none", display: "inline-flex", alignItems: "center" };

const label = { display: "block", color: "#8ea3b6", fontSize: 12, marginBottom: 4 };
const textInput = { width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #2b2f36", background: "#0f1318", color: "#e6eef5" };
const select = { width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #2b2f36", background: "#0f1318", color: "#e6eef5" };
const desc = { width: "100%", minHeight: 80, padding: 12, borderRadius: 10, border: "1px solid #2b2f36", background: "#0f1318", color: "#e6eef5" };

const stepsBar = { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 0" };
const stepsWrap = { display: "grid", gridTemplateColumns: "1fr", gap: 8 };
const panel = { background: "#0f1318", border: "1px solid #2b2f36", borderRadius: 10, padding: 10, minHeight: 120 };
const panelTitle = { color: "#cbd5e1", fontWeight: 800, marginBottom: 8 };
const btn = { padding: "10px 12px", borderRadius: 10, border: "1px solid #2b2f36", background: "#151a21", color: "#e6eef5", cursor: "pointer" };
const btnPrimary = { ...btn, border: "none", background: "#2d6cdf", color: "#fff" };
const btnWarn = { ...btn, border: "1px solid #6a5015", background: "#3b2a0a", color: "#ffd89a" };
const btnDanger = { ...btn, border: "1px solid #5b1a1f", background: "#3a0f12", color: "#ffd7db" };
const pill = { padding: "8px 12px", borderRadius: 999, border: "1px solid #2b2f36", background: "#151a21", color: "#e6eef5", cursor: "pointer", fontSize: 12 };
const blocksPane = { background: "#0b1016", border: "1px solid #2b2f36", borderRadius: 10, padding: 10, minHeight: "78vh", overflow: "auto" };

const pickerBack = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const picker = { width: "min(980px,92vw)", background: "#0f1318", border: "1px solid #2b2f36", borderRadius: 12, padding: 16 };
const tplCard = { border: "1px solid #2b2f36", borderRadius: 12, background: "#151a21", padding: 6, cursor: "pointer", textAlign: "center" };
const tplThumb = { height: 120, borderRadius: 10, background: "#0b1016", color: "#e6eef5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 };

function Gate({ children }) {
  return <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#e6eef5" }}>{children}</div>;
}
function Empty({ children }) {
  return <div style={{ padding: 12, border: "1px dashed #2b2f36", borderRadius: 10, color: "#8ea3b6" }}>{children}</div>;
}
