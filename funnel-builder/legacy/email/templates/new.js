// pages/modules/email/templates/new.js
import fs from "fs";
import path from "path";
import Link from "next/link";
import Head from "next/head";
import { useMemo, useState } from "react";

/* ---------------- helpers ---------------- */
function safeRead(p, enc = "utf8") { try { return fs.readFileSync(p, enc); } catch { return null; } }
function listImages(abs) {
  try {
    return fs.readdirSync(abs)
      .filter(f => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f))
      .map(f => ({ name: f.toLowerCase(), url: `/media/stock/${f}` }));
  } catch { return []; }
}
function firstImgFromHtml(absHtmlPath, publicPrefix) {
  const html = safeRead(absHtmlPath, "utf8");
  if (!html) return null;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!m) return null;
  let src = m[1].trim();
  if (/^https?:\/\//i.test(src) || src.startsWith("data:")) return null;
  if (src.startsWith("/")) return src;
  src = src.replace(/^\.?\/*/, "");
  return `${publicPrefix}${src}`;
}

/* ---------------- data loader ---------------- */
export async function getServerSideProps() {
  const publicDir   = path.join(process.cwd(), "public");
  const gr8Dir      = path.join(publicDir, "templates", "gallery", "gr8");
  const customDir   = path.join(publicDir, "templates", "gallery", "custom");
  const thumbsDir   = path.join(publicDir, "templates", "thumbs");
  const stockDir    = path.join(publicDir, "media", "stock");
  const stockImages = listImages(stockDir);

  function collect(dirAbs, publicPrefix) {
    if (!fs.existsSync(dirAbs)) return [];
    const htmls = fs.readdirSync(dirAbs).filter(f => f.toLowerCase().endsWith(".html"));
    return htmls.map((file, i) => {
      const base = file.replace(/\.html$/i, "");
      const htmlFile = path.join(dirAbs, file);
      const htmlUrl  = `${publicPrefix}${file}`;
      const metaPath = path.join(dirAbs, `${base}.json`);
      let meta = { title: base, description: "", source: publicPrefix.includes("/gr8/") ? "gr8" : "custom" };
      if (fs.existsSync(metaPath)) {
        try { meta = { ...meta, ...JSON.parse(fs.readFileSync(metaPath, "utf8")) }; } catch {}
      }

      let thumb;
      const genThumbAbs = path.join(thumbsDir, `${base}.png`);
      if (fs.existsSync(genThumbAbs)) thumb = `/templates/thumbs/${base}.png`;
      if (!thumb) {
        const first = firstImgFromHtml(htmlFile, publicPrefix);
        if (first) thumb = first;
      }
      if (!thumb) {
        // Prefer photo formats first
        const photos = stockImages.filter(s => /\.(png|jpg|jpeg|gif|webp)$/i.test(s.name));
        const pool   = photos.length ? photos : stockImages;
        thumb = pool.length ? pool[i % pool.length].url : "/media/stock/stock-1.svg";
      }

      return {
        file: htmlUrl,
        name: meta.title || base,
        description: meta.description || "",
        source: meta.source,
        thumb,
      };
    });
  }

  const curated = collect(gr8Dir, "/templates/gallery/gr8/");
  const saved   = collect(customDir, "/templates/gallery/custom/");
  const all     = [...saved, ...curated]; // show saved first

  return { props: { all } };
}

/* ---------------- page ---------------- */
export default function TemplatesGallery({ all }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return all;
    const t = q.trim().toLowerCase();
    return all.filter(x =>
      (x.name || "").toLowerCase().includes(t) ||
      (x.description || "").toLowerCase().includes(t)
    );
  }, [q, all]);

  return (
    <>
      <Head><title>Templates — Email Marketing</title></Head>
      <main className="wrap" role="main">
        <h1 className="title">Templates</h1>

        {/* Top cards like BeeFree: Blank + Import */}
        <div className="top-cards">
          <Link href="/modules/email/templates/builder?mode=scratch" className="card">
            <div className="card-icon" aria-hidden>✏️</div>
            <div className="card-title">Start with a blank template</div>
            <div className="card-desc">Open the builder with a clean, email-safe 640px canvas.</div>
          </Link>

          <Link href="/modules/email/templates/builder?mode=import" className="card">
            <div className="card-icon" aria-hidden>⬆️</div>
            <div className="card-title">Import an existing HTML</div>
            <div className="card-desc">Paste your HTML and edit it visually.</div>
          </Link>
        </div>

        {/* Search */}
        <div className="search">
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Search templates…"
            aria-label="Search templates"
          />
          <div className="count">{filtered.length} result{filtered.length===1?"":"s"}</div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="empty">No matches. Try a different search.</div>
        ) : (
          <div className="grid" role="list">
            {filtered.map(t => (
              <article key={t.file} className="card-tpl" role="listitem">
                <div className="thumb" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.thumb} alt="" onError={(e)=>{ e.currentTarget.src="/media/stock/stock-2.svg"; }}/>
                </div>
                <div className="body">
                  <div className="name">{t.name}</div>
                  <div className="desc">{t.description}</div>
                  <div className="row">
                    <Link href={`/modules/email/templates/preview?file=${encodeURIComponent(t.file)}`} className="btn">Preview</Link>
                    <Link href={`/modules/email/templates/builder?template=${encodeURIComponent(t.file)}`} className="btn primary">Use Template</Link>
                  </div>
                </div>
                <div className={`badge ${t.source==="custom"?"b-custom":"b-gr8"}`}>{t.source==="custom"?"Custom":"GR8"}</div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* self-contained CSS */}
      <style jsx>{`
        :root{
          --bg:#070d14; --panel:#0f1a28; --panel2:#132338; --text:#fff; --muted:#cbd5e1;
          --line:#243246; --brand:#0ea5e9; --btn:#2b435a; --btnb:#395a78;
        }
        .wrap{ min-height:100vh; background:var(--bg); color:var(--text); padding:28px;
               font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
        .title{ font-size:34px; font-weight:800; margin:0 0 16px; }

        .top-cards{ display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:14px; }
        @media (max-width:900px){ .top-cards{ grid-template-columns:1fr; } }
        .card{ display:block; padding:18px; border-radius:16px; text-decoration:none; color:#fff;
               background:linear-gradient(180deg,var(--panel),var(--panel2));
               border:1px solid var(--line); box-shadow:0 8px 24px rgba(0,0,0,.35); }
        .card:hover{ background:#122132; border-color:#335274; }
        .card-icon{ font-size:28px; margin-bottom:6px; }
        .card-title{ font-size:18px; font-weight:800; margin-bottom:4px; }
        .card-desc{ font-size:14px; color:var(--muted); }

        .search{ display:flex; align-items:center; gap:12px; margin:8px 0 12px; }
        .search input{ flex:1; height:48px; border-radius:12px; background:#0a1522; color:#fff;
                       border:2px solid #203042; padding:0 14px; font-size:16px; outline:none; }
        .search input:focus{ border-color:#93c5fd; box-shadow:0 0 0 3px rgba(147,197,253,.25); }
        .count{ color:#9bdcff; font-size:14px; }

        .grid{ display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:16px; }
        @media (max-width:1400px){ .grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width:860px){ .grid{ grid-template-columns: 1fr; } }

        .card-tpl{ position:relative; background:var(--panel); border:1px solid var(--line);
                   border-radius:14px; overflow:hidden; }
        .thumb{ aspect-ratio: 16/9; background:#0a0a0a; border-bottom:1px solid var(--line); }
        .thumb img{ width:100%; height:100%; object-fit:cover; display:block; filter:saturate(1.05) contrast(1.05); }
        .body{ padding:12px; }
        .name{ font-weight:800; font-size:17px; }
        .desc{ color:var(--muted); font-size:14px; min-height:34px; margin-top:4px; }
        .row{ display:flex; gap:8px; margin-top:10px; }
        .btn{ display:inline-block; padding:10px 12px; border-radius:12px; background:var(--btn); color:#fff; text-decoration:none; border:1px solid var(--btnb); font-size:14px; }
        .btn:hover{ background:#355471; } .btn.primary{ background:var(--brand); border-color:var(--brand); }
        .badge{ position:absolute; top:10px; left:10px; padding:4px 8px; border-radius:999px; font-size:11px; font-weight:700; }
        .b-custom{ background:rgba(34,197,94,.15); color:#86efac; border:1px solid rgba(34,197,94,.35); }
        .b-gr8{ background:rgba(14,165,233,.15); color:#7dd3fc; border:1px solid rgba(14,165,233,.35); }

        .empty{ color:#cbd5e1; font-size:16px; }
      `}</style>
    </>
  );
}

/* small field component so the “form” card looks neat if we reuse it later */
function Field({ label, children }) {
  return (
    <div className="em-field">
      <style jsx>{`
        .em-field label{ display:block; font-size:14px; color:#cbd5e1; margin:0 0 6px; }
        .em-field input{
          width:100%; height:48px; background:#0a1522; color:#fff; border:2px solid #203042;
          border-radius:12px; padding:0 14px; font-size:16px; outline:none;
        }
        .em-field input:focus{ border-color:#93c5fd; box-shadow:0 0 0 3px rgba(147,197,253,.25); }
      `}</style>
      <label>{label}</label>
      {children}
    </div>
  );
}




