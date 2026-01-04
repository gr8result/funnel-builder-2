// pages/modules/email/templates/import.js
import Head from "next/head";
import Link from "next/link";

export default function ImportTemplate() {
  return (
    <>
      <Head><title>Email â€¢ Import HTML</title></Head>
      <main className="wrap">
        <div className="inner">
          <h1 className="title">Import HTML</h1>
          <p className="sub">Paste raw HTML or upload a .html file.</p>

          <form className="card">
            <label>Template name<input type="text" placeholder="Imported template" /></label>
            <label>Paste HTML<textarea rows={12} placeholder="&lt;html&gt;...&lt;/html&gt;"></textarea></label>
            <div className="actions">
              <button type="button" className="btn primary">Save template</button>
              <Link href="/modules/email/templates" className="btn">Back to templates</Link>
            </div>
          </form>
        </div>
      </main>

      <style jsx>{styles}</style>
    </>
  );
}

const styles = `
  .wrap{min-height:100vh;background:#0c121a;color:#fff;padding:24px 0 40px}
  .inner{width:75vw;max-width:900px;margin:0 auto;padding:0 10px}
  .title{font-weight:900;font-size:30px;margin:6px 0 6px}
  .sub{opacity:.95;margin:0 0 16px}
  .card{background:#111827;border:2px solid rgba(255,255,255,.14);border-radius:16px;padding:18px;display:grid;gap:12px}
  label{display:grid;gap:6px;font-weight:700}
  input,textarea{background:#0f172a;border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:10px;padding:10px}
  textarea{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace}
  .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px}
  .btn{display:inline-block;padding:10px 14px;border-radius:12px;font-weight:800;border:2px solid rgba(255,255,255,.92);color:#fff;text-decoration:none}
  .btn.primary{background:#ec4899;border-color:#db2777}
`;


