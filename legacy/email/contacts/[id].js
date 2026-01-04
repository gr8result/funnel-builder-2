// pages/modules/email/contacts/[id].js
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function ContactDetail(){
  const { query } = useRouter();
  const id = query.id?.toString() || "";
  const [c,setC]=useState(null);

  useEffect(()=>{
    if(!id) return;
    (async()=>{
      const res = await fetch(`/api/contacts/${id}`);
      const data = await res.json();
      setC(data.contact || null);
    })();
  },[id]);

  return (
    <>
      <Head><title>Contact — {c?.email || "Loading…"}</title></Head>
      <main className="wrap">
        <header className="head">
          <h1>{c?.name || "Contact"}</h1>
          <Link href="/modules/email/lists" className="btn">Back to lists</Link>
        </header>

        {!c ? <p className="muted">Loading…</p> : (
          <section className="card">
            <p><strong>Email:</strong> {c.email}</p>
            <p><strong>Opens:</strong> {c.metrics?.opens ?? 0}</p>
            <p><strong>Clicks:</strong> {c.metrics?.clicks ?? 0}</p>
            <p><strong>Last activity:</strong> {c.metrics?.lastActivity ? new Date(c.metrics.lastActivity).toLocaleString() : "-"}</p>
            <hr/>
            <p className="muted">Exact “time spent reading” in email clients isn’t reliable. We estimate reading time on your site via UTM + Google Analytics after clicks.</p>
          </section>
        )}
      </main>

      <style jsx>{`
        .wrap{min-height:100vh;background:#0c121a;color:#fff;padding:24px}
        .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
        h1{font-size:28px;font-weight:900;margin:0}
        .btn{border:2px solid #fff;border-radius:12px;padding:10px 14px;font-weight:800;color:#fff;text-decoration:none}
        .muted{opacity:.85}
        .card{max-width:560px;background:#0f1720;border:2px solid #233047;border-radius:14px;padding:16px}
        hr{border:0;border-top:1px solid #1e293b;margin:12px 0}
      `}</style>
    </>
  );
}
