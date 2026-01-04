// pages/modules/email/templates/all.js
import fs from "fs";
import path from "path";
import Link from "next/link";
import Head from "next/head";

export async function getServerSideProps() {
  const publicDir = path.join(process.cwd(), "public");
  const curatedDir = path.join(publicDir, "templates", "gallery", "gr8");
  const customDir  = path.join(publicDir, "templates", "gallery", "custom");

  function list(dir, kind) {
    try {
      const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".html"));
      return files.map(f => {
        const base = f.replace(/\.html$/i, "");
        const html = `/templates/gallery/${kind}/${f}`;
        const metaPath = path.join(dir, `${base}.json`);
        let meta = { title: base, description: "", category: kind.toUpperCase() };
        if (fs.existsSync(metaPath)) {
          try { meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch {}
        }
        return { name: meta.title || base, type: "HTML", description: meta.description || "", file: html };
      });
    } catch {
      return [];
    }
  }

  const curated = list(curatedDir, "gr8");
  const custom  = list(customDir, "custom");
  return { props: { all: [...curated, ...custom] } };
}

export default function TemplatesAll({ all }) {
  return (
    <>
      <Head><title>All Email Templates</title></Head>
      <main className="min-h-screen bg-[#0b0f14] text-slate-200 px-6 py-6">
        <h1 className="text-2xl font-semibold mb-4">All templates</h1>
        {all.length === 0 ? (
          <div className="text-slate-400 text-sm">
            No templates yet. Seed or add to <code>/public/templates/gallery/gr8</code> or <code>/public/templates/gallery/custom</code>.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-[#111826]">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-800">Name</th>
                  <th className="px-4 py-3 border-b border-slate-800">Type</th>
                  <th className="px-4 py-3 border-b border-slate-800">Description</th>
                  <th className="px-4 py-3 border-b border-slate-800">Preview</th>
                  <th className="px-4 py-3 border-b border-slate-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {all.map(row => (
                  <tr key={row.file} className="odd:bg-[#0f1522] even:bg-transparent">
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3">{row.type}</td>
                    <td className="px-4 py-3 text-slate-400">{row.description}</td>
                    <td className="px-4 py-3">
                      <Link href={`/modules/email/templates/preview?file=${encodeURIComponent(row.file)}`} className="text-sky-400 hover:underline">Preview</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/modules/email/templates/builder?template=${encodeURIComponent(row.file)}`} className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm">Use Template</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}




