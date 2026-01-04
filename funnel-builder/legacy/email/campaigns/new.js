import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase-client";

export default function NewcampaignsPage() {
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [fromName, setFromName] = useState(process.env.NEXT_PUBLIC_DEFAULT_FROM_NAME || "");
  const [fromEmail, setFromEmail] = useState(process.env.NEXT_PUBLIC_DEFAULT_FROM_EMAIL || "");
  const [schedule, setSchedule] = useState("now"); // now | later
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.from("email_templates").select("id,name,subject").order("created_at",{ascending:false})
      .then(({ data }) => setTemplates(data || []));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError(null); setOk(false); setSaving(true);
    try {
      const payload = {
        name,
        template_id: templateId || null,
        from_name: fromName,
        from_email: fromEmail,
        status: schedule === "now" ? "sending" : "scheduled",
        scheduled_at: schedule === "later" ? new Date(scheduledAt).toISOString() : null,
        created_by: null,
      };
      const { data, error } = await supabase.from("email_campaigns").insert([payload]).select("id").single();
      if (error) throw error;

      // fire send now
      if (schedule === "now") {
        await fetch("/api/email/send-campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignsId: data.id }),
        });
      }

      setOk(true);
      setName("");
      setTemplateId("");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  const input = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid #2b4b99", background: "#0f254d", color: "#e6edf3"
  };

  return (
    <div>
      <h1 style={{ margin: "8px 0 18px" }}>New campaigns</h1>

      <form onSubmit={handleSave} style={{ display: "grid", gap: 12, maxWidth: 720 }}>
        <input placeholder="campaigns name" value={name} onChange={e=>setName(e.target.value)} style={input} required />

        <label style={{ opacity: .9 }}>Template</label>
        <select value={templateId} onChange={e=>setTemplateId(e.target.value)} style={input}>
          <option value="">â€” No template (plain email) â€”</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name} â€” {t.subject}</option>)}
        </select>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <input placeholder="From name" value={fromName} onChange={e=>setFromName(e.target.value)} style={input} required />
          <input placeholder="From email" value={fromEmail} onChange={e=>setFromEmail(e.target.value)} style={input} required />
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <label><input type="radio" checked={schedule==="now"} onChange={()=>setSchedule("now")} /> Send now</label>
          <label><input type="radio" checked={schedule==="later"} onChange={()=>setSchedule("later")} /> Schedule</label>
          {schedule==="later" && (
            <input type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)} style={input} />
          )}
        </div>

        <button disabled={saving} style={{
          background: "#2d6df6", border: "1px solid #2b5fd4",
          color: "#fff", padding: "10px 14px", borderRadius: 8, width: 160
        }}>
          {saving ? "Saving..." : "Create"}
        </button>

        {ok && <div style={{ color: "#7ee787" }}>Created!</div>}
        {error && <div style={{ color: "#ff6b6b", whiteSpace: "pre-wrap" }}>{error}</div>}
      </form>
    </div>
  );
}




