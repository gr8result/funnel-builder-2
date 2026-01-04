// pages/modules/email/templates/preview.js
import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

export default function Preview() {
  const router = useRouter();
  const { file } = router.query;
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (!file) return;
    (async () => {
      try {
        const res = await fetch(file);
        const txt = await res.text();
        setHtml(txt);
      } catch {
        setHtml("<p style='color:#fff;background:#111826;padding:16px;border-radius:8px'>Failed to load file.</p>");
      }
    })();
  }, [file]);

  return (
    <>
      <Head><title>Email Preview</title></Head>
      <main className="min-h-screen bg-[#0b0f14] text-slate-200 px-4 py-6">
        <div className="text-sm text-slate-400 mb-3">Preview (no SideNav by design)</div>
        <div className="bg-white rounded-lg overflow-hidden shadow">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </main>
    </>
  );
}




