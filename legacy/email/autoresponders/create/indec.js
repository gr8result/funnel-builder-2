// pages/modules/email/autoresponders/create/index.js
import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

export default function AutoresponderCreate() {
  const [form, setForm] = useState({
    campaignsName: "",
    fromName: "",
    fromEmail: "",
    replyTo: "",
    segment: "",
    subject: "",
    preheader: "",
    trigger: "immediate", // immediate | delay | schedule
    delayHours: 24,
    scheduleDate: "",
    scheduleTime: "",
    days: { Mon:true, Tue:true, Wed:true, Thu:true, Fri:true, Sat:false, Sun:false },
    timezone: "Australia/Brisbane",
    trackOpens: true,
    trackClicks: true,
  });

  function update(k, v) { setForm(s => ({ ...s, [k]: v })); }
  function toggleDay(d) { setForm(s => ({ ...s, days: { ...s.days, [d]: !s.days[d] }})); }

  const queryBase = new URLSearchParams({
    campaignsName: form.campaignsName || "campaigns",
    fromName: form.fromName || "",
    fromEmail: form.fromEmail || "",
    replyTo: form.replyTo || "",
    segment: form.segment || "",
    subject: form.subject || "",
    preheader: form.preheader || "",
    trigger: form.trigger,
    delayHours: String(form.delayHours || 24),
    scheduleDate: form.scheduleDate || "",
    scheduleTime: form.scheduleTime || "",
    days: Object.entries(form.days).filter(([,v])=>v).map(([k])=>k).join(","),
    timezone: form.timezone || "",
    trackOpens: String(!!form.trackOpens),
    trackClicks: String(!!form.trackClicks),
  }).toString();

  return (
    <>
      <Head><title>Create Autoresponder</title></Head>
      <main className="min-h-screen bg-[#0b0f14] text-slate-200 px-6 py-6">
        <h1 className="text-2xl font-semibold mb-4">Create autoresponder</h1>

        {/* campaigns & Sender */}
        <section className="bg-[#111826] border border-slate-800 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold mb-4">STEP 1 – campaigns & sender</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="campaigns name">
              <input value={form.campaignsName} onChange={e=>update("campaignsName", e.target.value)}
                     className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="Winter Promo Series" />
            </Field>
            <Field label="From name">
              <input value={form.fromName} onChange={e=>update("fromName", e.target.value)}
                     className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="Waite and Sea" />
            </Field>
            <Field label="From email">
              <input value={form.fromEmail} onChange={e=>update("fromEmail", e.target.value)}
                     className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="hello@yourdomain.com" />
            </Field>
            <Field label="Reply-to">
              <input value={form.replyTo} onChange={e=>update("replyTo", e.target.value)}
                     className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="support@yourdomain.com" />
            </Field>
            <Field label="Audience/segment">
              <input value={form.segment} onChange={e=>update("segment", e.target.value)}
                     className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="VIP, Leads – 7-day warmup" />
            </Field>
            <div />
          </div>
        </section>

        {/* Content */}
        <section className="bg-[#111826] border border-slate-800 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold mb-4">STEP 2 – Content</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Subject line">
              <input value={form.subject} onChange={e=>update("subject", e.target.value)}
                     className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="Your weekly health & fitness kickstart" />
            </Field>
            <Field label="Preheader">
              <input value={form.preheader} onChange={e=>update("preheader", e.target.value)}
                     className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="Quick wins, zero fluff." />
            </Field>
            <div className="flex items-end gap-2">
              <Link href={`/modules/email/templates/builder?mode=scratch&${queryBase}`} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg">Start from scratch</Link>
              <Link href={`/modules/email/templates/all`} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">Browse templates</Link>
              <Link href={`/modules/email/templates/builder?mode=import&${queryBase}`} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">Import HTML</Link>
              <Link href={`/modules/email/autoresponders/create/editor?${queryBase}`} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg">Continue → Editor</Link>
            </div>
          </div>
        </section>

        {/* Timing & Tracking */}
        <section className="bg-[#111826] border border-slate-800 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold mb-4">STEP 3 – Timing & tracking</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-slate-300 mb-2">Trigger</div>
              <div className="flex flex-wrap gap-2">
                <Chip active={form.trigger==="immediate"} onClick={()=>update("trigger","immediate")}>Send immediately</Chip>
                <Chip active={form.trigger==="delay"} onClick={()=>update("trigger","delay")}>Send after delay</Chip>
                <Chip active={form.trigger==="schedule"} onClick={()=>update("trigger","schedule")}>Send on date/time</Chip>
              </div>

              {form.trigger==="delay" && (
                <div className="mt-3">
                  <label className="block text-sm text-slate-300 mb-1">Delay (hours)</label>
                  <input type="number" min={1} value={form.delayHours} onChange={e=>update("delayHours", Number(e.target.value))}
                         className="w-40 bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" />
                </div>
              )}
              {form.trigger==="schedule" && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label="Date">
                    <input type="date" value={form.scheduleDate} onChange={e=>update("scheduleDate", e.target.value)}
                           className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" />
                  </Field>
                  <Field label="Time">
                    <input type="time" value={form.scheduleTime} onChange={e=>update("scheduleTime", e.target.value)}
                           className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" />
                  </Field>
                </div>
              )}

              <div className="mt-4">
                <div className="text-sm text-slate-300 mb-2">Allowed days</div>
                <div className="flex flex-wrap gap-2">
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                    <Chip key={d} active={!!form.days[d]} onClick={()=>toggleDay(d)}>{d}</Chip>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label="Timezone">
                  <input value={form.timezone} onChange={e=>update("timezone", e.target.value)}
                         className="w-full bg-[#0e1522] border border-slate-700 rounded-lg px-3 py-2" placeholder="Australia/Brisbane" />
                </Field>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.trackOpens} onChange={e=>update("trackOpens", e.target.checked)} /> Track opens</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.trackClicks} onChange={e=>update("trackClicks", e.target.checked)} /> Track clicks</label>
                </div>
              </div>
            </div>

            <div className="bg-[#0e1522] border border-slate-800 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-2">Summary</div>
              <ul className="text-sm space-y-1 text-slate-300">
                <li><b>campaigns:</b> {form.campaignsName || "—"}</li>
                <li><b>Sender:</b> {form.fromName || "—"} &lt;{form.fromEmail || "—"}&gt;</li>
                <li><b>Reply-to:</b> {form.replyTo || "—"}</li>
                <li><b>Segment:</b> {form.segment || "—"}</li>
                <li><b>Subject:</b> {form.subject || "—"}</li>
                <li><b>Preheader:</b> {form.preheader || "—"}</li>
                <li><b>Trigger:</b> {form.trigger}</li>
                {form.trigger==="delay" && <li><b>Delay:</b> {form.delayHours}h</li>}
                {form.trigger==="schedule" && <li><b>When:</b> {form.scheduleDate || "—"} {form.scheduleTime || ""}</li>}
                <li><b>Days:</b> {Object.entries(form.days).filter(([,v])=>v).map(([k])=>k).join(", ")}</li>
                <li><b>Timezone:</b> {form.timezone}</li>
                <li><b>Tracking:</b> opens {form.trackOpens?"on":"off"}, clicks {form.trackClicks?"on":"off"}</li>
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/modules/email/autoresponders/create/editor?${queryBase}`} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg">Continue → Editor</Link>
                <Link href={`/modules/email`} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">Back to Email hub</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm text-slate-300 mb-1">{label}</label>
      {children}
    </div>
  );
}
function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm border ${active ? "bg-sky-600 border-sky-500" : "bg-[#0e1522] border-slate-700 hover:border-slate-600"}`}>
      {children}
    </button>
  );
}




