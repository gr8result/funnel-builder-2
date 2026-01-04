// pages/modules/email/index.js
import { useMemo } from "react";
import fs from "fs";
import path from "path";
import Link from "next/link";
import Head from "next/head";
import dynamic from "next/dynamic";

// IMPORTANT: We only import (not modify) your shared SideNav.
// Adjust this import path if your SideNav lives elsewhere.
import SideNav from "../../../components/SideNav";

export async function getServerSideProps() {
  const publicDir = path.join(process.cwd(), "public");
  const galleryDir = path.join(publicDir, "templates", "gallery", "gr8");
  const thumbsDir = path.join(publicDir, "templates", "thumbs");

  let items = [];
  try {
    const files = fs.readdirSync(galleryDir).filter(f => f.toLowerCase().endsWith(".html"));
    items = files.map((file) => {
      const base = file.replace(/\.html$/i, "");
      const htmlPath = `/templates/gallery/gr8/${file}`;
      const metaPath = path.join(galleryDir, `${base}.json`);
      let meta = { title: base, description: "Email template", category: "GR8 Modern" };
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        } catch {}
      }
      const thumbFile = fs.existsSync(path.join(thumbsDir, `${base}.png`))
        ? `/templates/thumbs/${base}.png`
        : `/templates/thumbs/placeholder.png`;
      return { file: htmlPath, name: meta.title || base, description: meta.description || "", thumb: thumbFile };
    });
  } catch (e) {
    // If directory missing, we just show empty row
    items = [];
  }

  // Pick first 6 as "featured"
  const featured = items.slice(0, 6);
  return { props: { featured } };
}

export default function EmailHub({ featured }) {
  const featuredList = useMemo(() => featured || [], [featured]);

  return (
    <>
      <Head>
        <title>Email Marketing</title>
      </Head>
      <div className="flex min-h-screen bg-[#0b0f14] text-slate-200">
        <SideNav />
        <main className="flex-1 px-6 py-6">
          <h1 className="text-2xl font-semibold mb-4">Email Marketing</h1>

          {/* STEP 1 Card */}
          <section className="bg-[#111826] border border-slate-800 rounded-xl p-5 mb-8">
            <h2 className="text-lg font-semibold mb-3">STEP 1 – Create an email</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">From name</label>
                <input className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-sky-500" placeholder="Your brand or sender name" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">From email</label>
                <input className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="you@domain.com" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Reply-to</label>
                <input className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="replies@domain.com" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm text-slate-300 mb-1">Audience/segment</label>
                <input className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="e.g. VIP, Newsletter List" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm text-slate-300 mb-1">Subject line</label>
                <input className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="Catchy subject…" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm text-slate-300 mb-1">Preheader</label>
                <input className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="Short preview in inbox…" />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-5">
              <Link href={"/modules/email/templates/builder?mode=scratch"} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg">
                Start from scratch
              </Link>
              <Link href={"/modules/email/templates/all"} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">
                Browse templates
              </Link>
              <Link href={"/modules/email/templates/builder?mode=import"} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">
                Import HTML
              </Link>
            </div>
          </section>

          {/* Featured Templates */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Featured templates</h2>
              <Link href={"/modules/email/templates/all"} className="text-sky-400 hover:underline">View all</Link>
            </div>
            {featuredList.length === 0 ? (
              <div className="text-slate-400 text-sm">No templates found yet. Run the seeder or add templates to <code>/public/templates/gallery/gr8/</code>.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {featuredList.map((t) => (
                  <div key={t.file} className="bg-[#111826] border border-slate-800 rounded-xl overflow-hidden">
                    <div className="aspect-[16/10] bg-black/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.thumb} alt={t.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-4">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-sm text-slate-400 line-clamp-2 mt-1">{t.description}</div>
                      <div className="flex gap-2 mt-4">
                        <Link href={`/modules/email/templates/preview?file=${encodeURIComponent(t.file)}`} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">Preview</Link>
                        <Link href={`/modules/email/templates/builder?template=${encodeURIComponent(t.file)}`} className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm">Use Template</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
      <style jsx global>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  );
}




