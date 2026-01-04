// pages/modules/email/lists/index.js
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ListsIndex() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/lists");
      const data = await res.json();
      setLists(data.lists || []);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <Head><title>Lists & subscribers</title></Head>
      <main className="wrap">
        <header className="head">
          <h1>Lists & subscribers</h1>
          <Link href="/modules/email/lists/create" className="btn">Create new list</Link>
        </header>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : lists.length === 0 ? (
          <div className="empty">
            <p>No lists yet.</p>
            <Link href="/modules/email/lists/create" className="btn">Create your first list</Link>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Name</th><th>Subscribers</th><th>Opens</th><th>Clicks</th><th>Updated</th><th></th></tr>
            </thead>
            <tbody>
              {lists.map(l => (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td>{l.stats?.totalSubscribers ?? 0}</td>
                  <td>{l.stats?.totalOpens ?? 0}</td>
                  <td>{l.stats?.totalClicks ?? 0}</td>
                  <td>{new Date(l.updatedAt || l.createdAt).toLocaleString()}</td>
                  <td className="actions">
                    <Link href={`/modules/email/lists/${l.id}`} className="btn sm">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      <style jsx>{`
        .wrap{min-height:100vh;background:#0c121a;color:#fff;padding:24px}
        .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
        h1{font-size:28px;font-weight:900;margin:0}
        .btn{border:2px solid #fff;border-radius:12px;padding:10px 14px;font-weight:800;text-decoration:none;color:#fff}
        .muted{opacity:.85}
        .empty{background:#111827;border:2px dashed #374151;border-radius:12px;padding:18px}
        .tbl{width:100%;border-collapse:separate;border-spacing:0;background:#0f1720;border:2px solid #233047;border-radius:12px;overflow:hidden}
        thead th{font-weight:900;text-align:left;padding:12px;border-bottom:2px solid #233047}
        tbody td{padding:12px;border-top:1px solid #1e293b}
        .actions{white-space:nowrap}
        .sm{padding:6px 10px;border-radius:10px}
      `}</style>
    </>
  );
}




