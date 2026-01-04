// pages/editor/[id].js
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import supabaseDefault, { supabase as supabaseNamed } from "../../utils/supabase-client";

const supabase = supabaseNamed || supabaseDefault;

// If you don’t have this bucket, create a **public** bucket named “public-assets”
const STORAGE_BUCKET = "public-assets";

// Add a couple of helper DOM injectors for GrapesJS CDN
function injectOnce({ id, tag, attrs = {} }) {
  if (document.getElementById(id)) return;
  const el = document.createElement(tag);
  el.id = id;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  document.head.appendChild(el);
}

export default function EditorPage() {
  const router = useRouter();
  const { id } = router.query;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [pageRec, setPageRec] = useState(null); // {id,title,slug,html,published}

  const gjsRef = useRef(null);      // div container for editor
  const editorRef = useRef(null);   // grapesjs instance

  // ---- session + page load
  useEffect(() => {
    let alive = true;

    (async () => {
      setError("");
      const { data: s } = await supabase.auth.getSession();
      if (alive) setSession(s?.session || null);
      if (!s?.session || !id) {
        setLoading(false);
        return;
      }

      // Load the page or create an empty shell in memory
      const { data, error } = await supabase
        .from("pages")
        .select("id, title, slug, html, published")
        .eq("id", id)
        .maybeSingle();

      if (!alive) return;

      if (error) setError(error.message);
      setPageRec(data || null);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [id]);

  // ---- init GrapesJS once the container + data exist
  useEffect(() => {
    if (!session || !gjsRef.current || !pageRec) return;
    if (editorRef.current) return; // already mounted

    // Inject CDN assets once
    injectOnce({
      id: "gjs-css",
      tag: "link",
      attrs: {
        rel: "stylesheet",
        href: "https://unpkg.com/grapesjs@0.21.5/dist/css/grapes.min.css",
      },
    });
    injectOnce({
      id: "gjs-blocks-css",
      tag: "link",
      attrs: {
        rel: "stylesheet",
        href: "https://unpkg.com/grapesjs-blocks-basic@1.0.2/dist/grapesjs-blocks-basic.min.css",
      },
    });
    injectOnce({
      id: "gjs-script",
      tag: "script",
      attrs: { src: "https://unpkg.com/grapesjs@0.21.5/dist/grapes.min.js" },
    });
    injectOnce({
      id: "gjs-blocks-script",
      tag: "script",
      attrs: { src: "https://unpkg.com/grapesjs-blocks-basic@1.0.2/dist/grapesjs-blocks-basic.min.js" },
    });

    const waitForGJS = () =>
      new Promise((res) => {
        const ok = () => window.grapesjs && window.grapesjs.plugins ? res() : setTimeout(ok, 50);
        ok();
      });

    (async () => {
      await waitForGJS();

      const gjs = window.grapesjs;

      // Initialize editor
      const editor = gjs.init({
        container: gjsRef.current,
        height: "78vh",
        fromElement: false,
        storageManager: false, // we'll handle save
        plugins: ["gjs-blocks-basic"],
        pluginsOpts: {
          "gjs-blocks-basic": { flexGrid: true, countDown: 0 },
        },
        canvas: {
          styles: [
            // You can add your site CSS here if you have a shared theme
            "https://unpkg.com/tailwindcss@2.2.19/dist/tailwind.min.css",
          ],
        },
        // Nice dark theme tweaks
        styleManager: { clearProperties: true },
        panels: { defaults: [] }, // we’ll add our own header
      });

      // Basic blocks we want always visible
      const blockManager = editor.BlockManager;

      blockManager.add("row-1col", {
        label: "1 Column",
        category: "Layout",
        content: `<section class="p-6"><div class="grid grid-cols-1 gap-4">
          <div class="bg-gray-800 rounded-xl p-6 text-gray-100">Content…</div>
        </div></section>`,
      });

      blockManager.add("row-2col", {
        label: "2 Columns",
        category: "Layout",
        content: `<section class="p-6"><div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-800 rounded-xl p-6 text-gray-100">Left…</div>
          <div class="bg-gray-800 rounded-xl p-6 text-gray-100">Right…</div>
        </div></section>`,
      });

      blockManager.add("row-3col", {
        label: "3 Columns",
        category: "Layout",
        content: `<section class="p-6"><div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gray-800 rounded-xl p-6 text-gray-100">A…</div>
          <div class="bg-gray-800 rounded-xl p-6 text-gray-100">B…</div>
          <div class="bg-gray-800 rounded-xl p-6 text-gray-100">C…</div>
        </div></section>`,
      });

      blockManager.add("hero", {
        label: "Hero",
        category: "Sections",
        content: `<section class="py-16 text-center bg-gray-900 text-gray-100">
          <h1 class="text-4xl font-bold mb-2">New offer</h1>
          <p class="opacity-90 mb-6">Short, punchy promise.</p>
          <a class="inline-block bg-green-400 text-gray-900 font-bold px-4 py-2 rounded-lg" href="#">Get started</a>
        </section>`,
      });

      blockManager.add("optin", {
        label: "Opt-in form",
        category: "Forms",
        content: `<section class="p-6 bg-gray-900">
          <form method="post" action="/api/lead/submit" class="max-w-lg mx-auto grid gap-3">
            <input class="px-3 py-2 rounded bg-gray-800 text-gray-100" name="name" placeholder="Your name"/>
            <input class="px-3 py-2 rounded bg-gray-800 text-gray-100" name="email" type="email" placeholder="Your email"/>
            <input class="px-3 py-2 rounded bg-gray-800 text-gray-100" name="phone" type="tel" placeholder="Your phone"/>
            <button class="px-4 py-2 rounded bg-blue-500 font-bold text-white" type="submit">Send me the guide</button>
          </form>
        </section>`,
      });

      // Asset manager: upload to Supabase, then add the URL
      editor.on("asset:upload:add", async (files) => {
        for (const file of files) {
          const ext = file.name.split(".").pop();
          const path = `pages/${id}/${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
            cacheControl: "3600",
            upsert: true,
          });
          if (error) {
            alert(error.message || "Upload failed");
            continue;
          }
          const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
          const url = pub?.publicUrl;
          if (url) editor.AssetManager.add({ src: url });
        }
      });

      // Load existing page HTML
      const initial = pageRec.html?.trim() || defaultShell();
      editor.setComponents(initial);

      // Keep the instance
      editorRef.current = editor;
    })();
  }, [session, pageRec, id]);

  // ---- actions
  const onSave = async () => {
    if (!editorRef.current || !pageRec) return;
    setSaving(true);
    setError("");

    const editor = editorRef.current;
    const html = editor.getHtml();
    const css = editor.getCss();
    const payload = `<style>${css}</style>${html}`;

    const { error } = await supabase
      .from("pages")
      .update({ html: payload, title: pageRec.title || null, slug: pageRec.slug || null })
      .eq("id", pageRec.id);

    if (error) setError(error.message);
    setSaving(false);
    if (!error) alert("Saved!");
  };

  const onPublishToggle = async () => {
    if (!pageRec) return;
    if (!pageRec.slug) {
      alert("Add a slug before publishing (so it can be served at /p/<slug>).");
      return;
    }
    setPublishing(true);
    const { error, data } = await supabase
      .from("pages")
      .update({ published: !pageRec.published })
      .eq("id", pageRec.id)
      .select("id, title, slug, html, published")
      .maybeSingle();

    if (error) setError(error.message);
    else setPageRec(data);
    setPublishing(false);
  };

  const onPreview = () => {
    if (pageRec?.slug) {
      window.open(`/p/${pageRec.slug}`, "_blank");
    } else {
      // open a quick temp preview of current canvas
      if (!editorRef.current) return;
      const w = window.open("", "_blank");
      const html = editorRef.current.getHtml();
      const css = editorRef.current.getCss();
      w.document.write(`<!doctype html><html><head><meta charset="utf-8" />
        <style>${css}</style></head><body>${html}</body></html>`);
      w.document.close();
    }
  };

  // title/slug inline editing
  const updateField = async (field, value) => {
    if (!pageRec) return;
    setPageRec({ ...pageRec, [field]: value });
    await supabase.from("pages").update({ [field]: value }).eq("id", pageRec.id);
  };

  if (!session) {
    return (
      <main style={{ padding: 24 }}>
        <p>Please log in.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 14 }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          border: "1px solid #1f2937",
          background: "#0a1220",
          padding: 10,
          borderRadius: 10,
          marginBottom: 10,
        }}
      >
        <input
          value={pageRec?.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="Page title"
          style={{
            minWidth: 240,
            borderRadius: 8,
            border: "1px solid #1f2937",
            background: "#0b1320",
            color: "#e5e7eb",
            padding: "8px 10px",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="muted">/p/</span>
          <input
            value={pageRec?.slug || ""}
            onChange={(e) => updateField("slug", e.target.value.replace(/\s+/g, "-").toLowerCase())}
            placeholder="slug"
            style={{
              width: 180,
              borderRadius: 8,
              border: "1px solid #1f2937",
              background: "#0b1320",
              color: "#e5e7eb",
              padding: "8px 10px",
            }}
          />
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={onPreview} style={btn()}>Preview</button>
        <button onClick={onSave} style={btn("primary")} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onPublishToggle} style={btn(pageRec?.published ? "" : "green")} disabled={publishing}>
          {pageRec?.published ? "Unpublish" : "Publish"}
        </button>
        <button onClick={() => router.push("/modules/funnels")} style={btn()}>Back</button>
      </div>

      {error ? <div style={{ color: "#ff6b6b", marginBottom: 10 }}>{error}</div> : null}

      {/* GrapesJS container */}
      <div ref={gjsRef} />

      <style jsx>{`
        .muted { color:#9aa6b2; font-size:12px; }
      `}</style>
    </main>
  );
}

function btn(kind) {
  const base = {
    background: "#0d1a2b",
    color: "#e5e7eb",
    border: "1px solid #1f2937",
    padding: "8px 10px",
    borderRadius: "8px",
    cursor: "pointer",
  };
  if (kind === "primary") return { ...base, background: "#2d6cdf", borderColor: "#2d6cdf" };
  if (kind === "green") return { ...base, background: "#22a06b", borderColor: "#22a06b", color: "#041016" };
  return base;
}

function defaultShell() {
  return `
  <section class="py-16 text-center bg-gray-900 text-gray-100">
    <h1 class="text-4xl font-bold mb-2">Your headline</h1>
    <p class="opacity-90 mb-6">A short, punchy promise.</p>
    <a class="inline-block bg-green-400 text-gray-900 font-bold px-4 py-2 rounded-lg" href="#">Get started</a>
  </section>`;
}
