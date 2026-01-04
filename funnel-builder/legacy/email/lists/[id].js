// pages/modules/email/lists/[id].js
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function ListDetail(){
  const { query } = useRouter();
  const id = query.id?.toString() || "";
  const [list,setList] = useState(null);
  const [loading,setLoading]=useState(true);

  // quick add-subscriber form
  const [subName,setSubName]=useState("");
  const [subEmail,setSubEmail]=useState("");

  async function refresh(){
    const res = await fetch(`/api/lists/${id}`);
    const data = await res.json();
    setList(data.list || null);
    setLoading(false);
  }

  useEffect(()=>{ if(id){ refresh(); } },[id]);

  async function addSubscriber(e){
    e.preventDefault();
    const res = await fetch("/api/lists/add-subscriber",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({listId:id,name:subName,email:subEmail})
    });
    const data = await res.json();
    if(data.ok){ setSubName(""); setSubEmail(""); refresh(); }
  }

  return (
    <>
      <Head><title>List — {list?.name || "Loading…"}</title></Head>
      <main className="wrap">
        <header className="head">
          <div>
            <h1>{list?.name || "Loading…"}</h1>
            {!!list?.description && <p className="muted">{list.description}</p>}
          </div>
          <Link href="/modules/email/lists" className="btn">Back to lists</Link>
        </header>

        {loading ? <p className="muted">Loading…</p> : !list ? <p className="muted">List not found.</p> : (
          <>
            <section className="cards">
              <div className="stat"><div className="k">{list.stats?.totalSubscribers ?? 0}</div><div className="l">Subscribers</div></div>
              <div className="stat"><div className="k">{list.stats?.totalOpens ?? 0}</div><div className="l">Total opens</div></div>
              <div className="stat"><div className="k">{list.stats?.totalClicks ?? 0}</div><div className="l">Total clicks</div></div>
            </section>

            <details className="add">
              <summary>Add subscriber</summary>
              <form onSubmit={addSubscriber} className="row">
                <input value={subName} onChange={e=>setSubName(e.target.value)} placeholder="Name (optional)"/>
                <input value={subEmail} onChange={e=>setSubEmail(e.target.value)} placeholder="email@domain.com" inputMode="email"/>
                <button className="btn primary" type="submit">Add</button>
              </form>
            </details>

            <h2>People</h2>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Email</th><th>Opens</th><th>Clicks</th><th>Last activity</th><th></th></tr></thead>
              <tbody>
                {(list.subscribers||[]).map(p=>(
                  <tr key={p.id}>
                    <td>{p.name || "-"}</td>
                    <td>{p.email}</td>
                    <td>{p.metrics?.opens ?? 0}</td>
                    <td>{p.metrics?.clicks ?? 0}</td>
                    <td>{p.metrics?.lastActivity ? new Date(p.metrics.lastActivity).toLocaleString() : "-"}</td>
                    <td className="actions">
                      <Link className="btn sm" href={`/modules/email/contacts/${p.id}`}>Inspect</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section className="how">
              <h3>How we track</h3>
              <p className="muted">
                Add this open pixel to your HTML emails:
                <code>{`<img src="${location.origin}/api/track/open?l=${list.id}&c={{CONTACT_ID}}" width="1" height="1" alt="" style="display:none;" />`}</code>
              </p>
              <p className="muted">
                Wrap links like:
                <code>{`${location.origin}/api/track/c?l=${list.id}&c={{CONTACT_ID}}&u=${encodeURIComponent('https://your-site.com/path?utm_source=email&utm_medium=list&utm_campaign='+encodeURIComponent(list.name))}`}</code>
              </p>
            </section>
          </>
        )}
      </main>

      <style jsx>{`
        .wrap{min-height:100vh;background:#0c121a;color:#fff;padding:24px}
        .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
        h1{font-size:28px;font-weight:900;margin:0}
        .muted{opacity:.85}
        .btn{border:2px solid #fff;border-radius:12px;padding:10px 14px;font-weight:800;color:#fff;text-decoration:none}
        .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:8px 0 16px}
        .stat{background:#0f1720;border:2px solid #233047;border-radius:12px;padding:14px}
        .k{font-size:26px;font-weight:900}
        .l{opacity:.85}
        .add{background:#0f1720;border:2px solid #233047;border-radius:12px;padding:12px;margin-bottom:16px}
        .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
        .row input{flex:1;min-width:220px;border:2px solid #233047;border-radius:12px;background:#0b1220;color:#fff;padding:10px 12px}
        .tbl{width:100%;border-collapse:separate;border-spacing:0;background:#0f1720;border:2px solid #233047;border-radius:12px;overflow:hidden}
        thead th{font-weight:900;text-align:left;padding:12px;border-bottom:2px solid #233047}
        tbody td{padding:12px;border-top:1px solid #1e293b}
        .actions{white-space:nowrap}
        .sm{padding:6px 10px;border-radius:10px}
        .how{margin-top:16px}
        code{display:block;background:#0b1220;border:1px solid #1e293b;border-radius:10px;padding:10px;margin-top:6px;color:#cbd5e1;word-break:break-all}
      `}</style>
    </>
  );
}
