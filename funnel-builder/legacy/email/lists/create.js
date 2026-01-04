// pages/modules/email/lists/create.js
import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/router";

export default function CreateList() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function onSubmit(e){
    e.preventDefault();
    const res = await fetch("/api/lists/create",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name,description})
    });
    const data = await res.json();
    if(data.ok){ router.push(`/modules/email/lists/${data.id}`); }
  }

  return (
    <>
      <Head><title>Create list</title></Head>
      <main className="wrap">
        <h1>Create a new list</h1>
        <form onSubmit={onSubmit} className="card">
          <label>Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="VIP Newsletter"/>
          <label>Description (optional)</label>
          <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} placeholder="What goes into this list?"/>
          <div className="row">
            <Link href="/modules/email/lists" className="btn ghost">Cancel</Link>
            <button className="btn primary" type="submit">Create</button>
          </div>
        </form>
      </main>

      <style jsx>{`
        .wrap{min-height:100vh;background:#0c121a;color:#fff;padding:24px}
        h1{font-size:28px;font-weight:900;margin:0 0 16px}
        .card{max-width:560px;background:#0f1720;border:2px solid #233047;border-radius:14px;padding:16px}
        label{font-weight:900;margin:12px 0 6px;display:block}
        input,textarea{width:100%;border-radius:12px;border:2px solid #233047;background:#0b1220;color:#fff;padding:12px 14px}
        .row{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}
        .btn{border:2px solid #fff;border-radius:12px;padding:10px 14px;font-weight:800;color:#fff;text-decoration:none}
        .ghost{background:transparent}
        .primary{background:#fff;color:#0c121a}
      `}</style>
    </>
  );
}




