// /pages/modules/lists/pipeline.js
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

// --- CRM colour (consistent across the module) ---
const CRM_COLOR  = "#dc2626";  // rich red
const CRM_BORDER = "#7f1d1d";  // darker red for borders

const DEFAULT_STEPS = [
  { id: "lead",        name: "Lead",          color: "#f59e0b" },
  { id: "contacted",   name: "Contacted",     color: "#ea580c" },
  { id: "followup",    name: "Follow up",     color: "#6366f1" },
  { id: "sent",        name: "Sent Samples",  color: "#4338ca" },
  { id: "pitched",     name: "Pitched",       color: "#3730a3" },
  { id: "negotiating", name: "Negotiating",   color: "#1e3a8a" },
  { id: "won",         name: "Closed Â· Won",  color: "#16a34a" },
  // CHANGED: make the last step clearly red
  { id: "lost",        name: "Closed Â· Lost", color: "#ef4444" },
];

function lsKey(listId){ return `crm:pipeline:steps:${listId||"default"}`; }
function stageKey(listId){ return `crm:pipeline:stages:${listId||"default"}`; }

export default function Pipeline() {
  const router = useRouter();
  const { list: listId } = router.query;

  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [rows, setRows]   = useState([]);
  const [q, setQ]         = useState("");
  const [period, setPeriod] = useState("month"); // day|week|month|all
  const [stageMap, setStageMap] = useState({});  // { subscriberId: stepId }

  useEffect(()=>{
    if(!listId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(lsKey(listId))||"null");
      if (saved?.length) setSteps(saved);
    } catch {}
    try {
      const savedStages = JSON.parse(localStorage.getItem(stageKey(listId))||"{}");
      setStageMap(savedStages);
    } catch {}
  },[listId]);

  useEffect(()=>{
    if(!listId) return;
    localStorage.setItem(lsKey(listId), JSON.stringify(steps));
  },[steps, listId]);

  useEffect(()=>{
    if(!listId) return;
    localStorage.setItem(stageKey(listId), JSON.stringify(stageMap));
  },[stageMap, listId]);

  const { from, to } = useMemo(()=>{
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
    const fmt = d => d.toISOString().slice(0,10);
    if(period==="day"){ const s=new Date(now.getFullYear(),now.getMonth(),now.getDate()); return {from:fmt(s),to:fmt(end)}; }
    if(period==="week"){ const d=now.getDay(); const s=new Date(now.getFullYear(),now.getMonth(),now.getDate()-d); return {from:fmt(s),to:fmt(end)}; }
    if(period==="month"){ const s=new Date(now.getFullYear(),now.getMonth(),1); return {from:fmt(s),to:fmt(end)}; }
    return {from:"",to:""};
  },[period]);

  async function load() {
    if(!listId) return;
    const p = new URLSearchParams();
    if(q) p.set("q", q);
    if(from) p.set("from", from);
    if(to)   p.set("to", to);
    const r = await fetch(`/api/lists/${listId}/subscribers?${p.toString()}`);
    const j = await r.json();
    if(j?.ok) setRows(j.rows||[]);
  }
  useEffect(()=>{ load(); /* eslint-disable-next-line */ },[listId,q,from,to]);

  const counts = useMemo(()=>{
    const c = Object.fromEntries(steps.map(s=>[s.id,0]));
    for(const r of rows){
      const sid = stageMap[r.id] || steps[0].id;
      if(c[sid]!=null) c[sid] += 1;
    }
    return c;
  },[rows,stageMap,steps]);

  function updateStepName(i, name){
    const next = [...steps];
    next[i] = { ...next[i], name: name || DEFAULT_STEPS[i]?.name || next[i].name };
    setSteps(next);
  }

  function setStage(subId, stepId){
    setStageMap(prev => ({ ...prev, [subId]: stepId }));
  }

  const exportHref = useMemo(()=>{
    if(!listId) return "#";
    const p = new URLSearchParams();
    if(q) p.set("q", q);
    if(from) p.set("from", from);
    if(to)   p.set("to", to);
    return `/api/lists/${listId}/export?`+p.toString();
  },[listId,q,from,to]);

  return (
    <main className="wrap">
      <div className="band">
        <div className="label">
          <span className="badge">Pipeline</span> Lists & Subscribers
        </div>
        <div className="tools">
          <Link href="/modules/lists" legacyBehavior><a className="btn">â† Lists</a></Link>
          <a className="btn" href={exportHref}>Export CSV</a>
        </div>
      </div>

      <div className="stepsRow">
        {steps.map((s,i)=>(
          <div key={s.id} className="step" style={{background:s.color}}>
            <input
              className="stepName"
              value={s.name}
              onChange={e=>updateStepName(i, e.target.value)}
            />
            <div className="count">{counts[s.id] || 0}</div>
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="filters">
          <input className="search" placeholder="Search name, email, phone, companyâ€¦" value={q} onChange={e=>setQ(e.target.value)} />
          <select value={period} onChange={e=>setPeriod(e.target.value)}>
            <option value="day">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
          </select>
        </div>

        <div className="table">
          <div className="thead">
            <div>Stage</div><div>First</div><div>Last</div><div>Email</div><div>Phone</div>
            <div>Company</div><div>Position</div><div>Postcode</div><div>Source</div><div>Joined</div>
          </div>
          {rows.map(r=>(
            <div key={r.id} className="tr">
              <div className="stageCell">
                <select
                  value={stageMap[r.id] || steps[0].id}
                  onChange={e=>setStage(r.id, e.target.value)}
                >
                  {steps.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>{r.first_name||""}</div>
              <div>{r.last_name||""}</div>
              <div>{r.email||""}</div>
              <div>{r.phone||""}</div>
              <div>{r.company||""}</div>
              <div>{r.position||""}</div>
              <div>{r.postcode||""}</div>
              <div>{r.source||""}</div>
              <div>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</div>
            </div>
          ))}
          {rows.length===0 && <div className="empty">No subscribers match this filter.</div>}
        </div>
      </section>

      <style jsx>{`
        .wrap{min-height:100vh;background:#0c121a;color:#eaf0ff;padding:12px 16px 24px}
        /* CHANGED: top band now uses CRM red */
        .band{
          display:flex;align-items:center;justify-content:space-between;
          background:${CRM_COLOR};border:1px solid ${CRM_BORDER};
          border-radius:14px;padding:12px 14px;margin:8px 0 14px
        }
        .label{font-weight:900}
        .badge{
          background:${CRM_COLOR};
          border-radius:999px;padding:4px 10px;margin-right:8px;border:1px solid ${CRM_BORDER}
        }
        .tools{display:flex;gap:8px}
        .btn{background:transparent;border:1px solid #223448;color:#eaf0ff;border-radius:10px;padding:8px 12px;text-decoration:none}
        .btn:hover{background:#0b111a}

        .stepsRow{display:grid;grid-template-columns:repeat(8, minmax(80px,1fr));gap:10px;margin-bottom:14px}
        .step{border-radius:12px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between}
        .stepName{background:transparent;border:none;color:#fff;font-weight:900;max-width:75%;outline:none}
        .count{background:rgba(0,0,0,.25);border-radius:999px;padding:2px 8px;font-weight:900}

        .panel{background:#0f1722;border:1px solid #223448;border-radius:14px;padding:16px}
        .filters{display:flex;gap:10px;align-items:center;margin:0 0 12px}
        .search{flex:1;min-width:260px;background:#0f1722;border:1px solid #203040;border-radius:10px;padding:10px 12px;color:#e8eefc}

        .table{background:#0b111a;border:1px solid #223448;border-radius:12px;overflow:hidden}
        .thead,.tr{display:grid;grid-template-columns:180px repeat(9, minmax(100px,1fr));gap:0;border-bottom:1px solid #1a2636}
        .thead{background:#0b111a;font-weight:900;font-size:13px;padding:10px 12px}
        .tr{padding:10px 12px}
        .tr:hover{background:#0c1622}
        .stageCell select{background:#0f1722;color:#eaf0ff;border:1px solid #203040;border-radius:8px;padding:6px 8px}
        .empty{padding:16px;text-align:center;opacity:.75}
      `}</style>
    </main>
  );
}

