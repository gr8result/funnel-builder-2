// /pages/import-contacts.js
// Competitor contact import wizard — Klaviyo, Mailchimp, HubSpot, or Generic CSV

import { useState, useRef } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabase-client";
import { useWorkspace } from "../hooks/useWorkspace";
import { getAvatarForLead } from "../utils/avatar";

// ─── Platform definitions ──────────────────────────────────────────────────────
const PLATFORMS = [
  {
    id: "klaviyo",
    name: "Klaviyo",
    emoji: "📊",
    color: "#22c55e",
    desc: "Import subscribers and their tags from a Klaviyo list export",
    hints: ["Export from Klaviyo → Lists → select list → Export"],
    fieldMap: {
      email:      ["Email Address", "email"],
      firstName:  ["First Name", "first_name"],
      lastName:   ["Last Name", "last_name"],
      phone:      ["Phone Number", "phone", "SMS Number"],
      tags:       ["Tags", "Lists"],
    },
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    emoji: "🐵",
    color: "#ffe01b",
    textColor: "#1a1a1a",
    desc: "Import subscribers exported from a Mailchimp audience",
    hints: ["Export from Mailchimp → Audience → All contacts → Export"],
    fieldMap: {
      email:      ["Email Address", "email"],
      firstName:  ["First Name", "FNAME"],
      lastName:   ["Last Name", "LNAME"],
      phone:      ["Phone", "Phone Number", "PHONE"],
      tags:       ["Tags", "TAGS", "Groups"],
    },
  },
  {
    id: "hubspot",
    name: "HubSpot",
    emoji: "🔶",
    color: "#ff7a59",
    desc: "Import contacts exported from HubSpot CRM",
    hints: ["Export from HubSpot → Contacts → Actions → Export"],
    fieldMap: {
      email:      ["Email", "Email Address"],
      firstName:  ["First Name"],
      lastName:   ["Last Name"],
      phone:      ["Phone Number", "Mobile Phone Number", "Phone"],
      tags:       ["Lifecycle Stage", "Lead Status"],
    },
  },
  {
    id: "generic",
    name: "Other / Generic CSV",
    emoji: "📁",
    color: "#6366f1",
    desc: "Any CSV with email addresses — we'll auto-detect the column names",
    hints: ["Any spreadsheet export saved as .csv"],
    fieldMap: {
      email:      ["email", "Email", "EMAIL", "Email Address", "email_address"],
      firstName:  ["first_name", "First Name", "FNAME", "firstname", "given_name"],
      lastName:   ["last_name", "Last Name", "LNAME", "lastname", "surname", "family_name"],
      phone:      ["phone", "Phone", "Phone Number", "mobile", "Mobile", "cell"],
      tags:       ["tags", "Tags", "tag", "Tag", "group", "Group", "segment"],
      name:       ["name", "Name", "full_name", "Full Name", "display_name"],
    },
  },
];

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let inQuote = false;
    let cell = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cell += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        row.push(cell.trim());
        cell = "";
      } else {
        cell += ch;
      }
    }
    row.push(cell.trim());
    result.push(row);
  }
  return result;
}

// ─── Column auto-detect ───────────────────────────────────────────────────────
function detectMapping(headers, platform) {
  const fieldMap = platform.fieldMap;
  const mapping = { email: "", firstName: "", lastName: "", phone: "", tags: "", name: "" };
  const lowerHeaders = headers.map(h => h.toLowerCase());

  for (const [field, candidates] of Object.entries(fieldMap)) {
    for (const candidate of candidates) {
      const idx = lowerHeaders.indexOf(candidate.toLowerCase());
      if (idx !== -1) { mapping[field] = headers[idx]; break; }
    }
  }
  return mapping;
}

// ─── Build lead rows ──────────────────────────────────────────────────────────
function buildLeads({ rows, headers, mapping, userId, workspaceId, platformName }) {
  return rows
    .map(cols => {
      const get = (field) => {
        if (!mapping[field]) return "";
        const idx = headers.indexOf(mapping[field]);
        return idx !== -1 ? (cols[idx] || "").trim() : "";
      };

      const email = get("email");
      if (!email || !email.includes("@")) return null;

      let name = get("name");
      if (!name) {
        const first = get("firstName");
        const last = get("lastName");
        name = [first, last].filter(Boolean).join(" ");
      }

      const baseLead = {
        user_id: userId,
        workspace_id: workspaceId,
        email,
        name: name || email.split("@")[0],
        phone: get("phone"),
        tags: get("tags"),
        source: platformName,
        notes: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { emoji, color } = getAvatarForLead(baseLead);
      return { ...baseLead, avatar_icon: emoji, avatar_color: color };
    })
    .filter(Boolean);
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: { maxWidth: 780, margin: "0 auto", padding: "32px 20px 80px", color: "#f9fafb" },
  card: { background: "#0d1522", border: "1px solid #1e2d42", borderRadius: 14, padding: 28 },
  h1:   { fontSize: 26, fontWeight: 700, margin: "0 0 6px", color: "#f9fafb" },
  sub:  { fontSize: 14, color: "#9ca3af", margin: "0 0 28px" },
  btn:  (color = "#2563eb") => ({
    background: color, color: color === "#ffe01b" ? "#1a1a1a" : "#fff",
    border: "none", borderRadius: 9, padding: "10px 22px",
    fontSize: 14, fontWeight: 600, cursor: "pointer",
  }),
  outlineBtn: {
    background: "transparent", color: "#9ca3af",
    border: "1px solid #374151", borderRadius: 9,
    padding: "10px 22px", fontSize: 14, cursor: "pointer",
  },
  label: { display: "block", fontSize: 13, color: "#d1d5db", marginBottom: 6 },
  select: {
    background: "#1f2937", border: "1px solid #374151", borderRadius: 8,
    color: "#f9fafb", padding: "8px 12px", fontSize: 13, width: "100%",
  },
  progress: (step, total) => ({
    display: "flex", gap: 0, marginBottom: 32,
    borderRadius: 10, overflow: "hidden", height: 6,
    background: "#1e2d42",
  }),
};

// ─── Step indicator ───────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ["Choose source", "Upload & map", "Confirm", "Done"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "grid", placeItems: "center",
                fontSize: 12, fontWeight: 700,
                background: done ? "#22c55e" : active ? "#2563eb" : "#1e2d42",
                color: done || active ? "#fff" : "#4b5563",
                border: active ? "2px solid #3b82f6" : "2px solid transparent",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <div style={{ fontSize: 11, color: active ? "#e5e7eb" : "#4b5563", whiteSpace: "nowrap" }}>{label}</div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? "#22c55e" : "#1e2d42", margin: "0 8px", marginBottom: 18 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ImportContacts() {
  const { workspaceId } = useWorkspace();
  const [step, setStep] = useState(0);
  const [platform, setPlatform] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [dataRows, setDataRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  // Step 0 → 1: user picks a platform
  function handlePickPlatform(p) {
    setPlatform(p);
    setStep(1);
  }

  // Step 1: file upload
  async function handleFile(e) {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) { setError("CSV file appears empty or has only a header row."); return; }
      const hdrs = rows[0];
      const data = rows.slice(1).filter(r => r.some(c => c));
      const detected = detectMapping(hdrs, platform);
      setHeaders(hdrs);
      setDataRows(data);
      setMapping(detected);
      setPreview(data.slice(0, 5));
      setStep(2);
    } catch (err) {
      setError("Could not read the file. Make sure it is a valid CSV.");
    }
  }

  // Step 2 → 3: confirm
  async function handleConfirm() {
    setError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) { setError("You must be logged in."); return; }
    setImporting(true);
    try {
      const leads = buildLeads({
        rows: dataRows, headers, mapping,
        userId, workspaceId: workspaceId || null,
        platformName: platform.name,
      });
      if (!leads.length) { setError("No rows with valid email addresses found."); setImporting(false); return; }

      let imported = 0;
      const chunkSize = 100;
      for (let i = 0; i < leads.length; i += chunkSize) {
        const chunk = leads.slice(i, i + chunkSize);
        const { error: dbErr } = await supabase.from("leads").upsert(chunk, { onConflict: "user_id,email", ignoreDuplicates: true });
        if (dbErr) throw dbErr;
        imported += chunk.length;
        await new Promise(r => setTimeout(r, 100));
      }
      setImportResult({ total: leads.length, imported });
      setStep(3);
    } catch (err) {
      setError(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  const leadCount = dataRows.length
    ? buildLeads({ rows: dataRows, headers, mapping, userId: "preview", workspaceId: null, platformName: "" }).length
    : 0;

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/dashboard" style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}>← Dashboard</Link>
      </div>

      <h1 style={S.h1}>Import Contacts</h1>
      <p style={S.sub}>Bring your contacts over from another platform — no data gets left behind.</p>

      <Steps current={step} />

      {/* ── Step 0: pick platform ── */}
      {step === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => handlePickPlatform(p)}
              style={{
                background: "#0d1522", border: `2px solid ${p.color}33`,
                borderRadius: 14, padding: "20px 20px",
                cursor: "pointer", textAlign: "left", transition: "border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = p.color}
              onMouseLeave={e => e.currentTarget.style.borderColor = `${p.color}33`}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{p.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.5 }}>{p.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* ── Step 1: upload + mapping ── */}
      {step === 1 && platform && (
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 28 }}>{platform.emoji}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#f9fafb" }}>{platform.name} import</div>
              <div style={{ fontSize: 13, color: "#9ca3af" }}>{platform.hints[0]}</div>
            </div>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: "2px dashed #374151", borderRadius: 12,
              padding: "40px 20px", textAlign: "center", cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#6366f1"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#374151"}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#e5e7eb" }}>Click to choose a CSV file</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>or drag and drop</div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
          </div>

          {error && <div style={{ marginTop: 16, color: "#f87171", fontSize: 13 }}>{error}</div>}

          <div style={{ marginTop: 20 }}>
            <button style={S.outlineBtn} onClick={() => setStep(0)}>← Back</button>
          </div>
        </div>
      )}

      {/* ── Step 2: column mapping review ── */}
      {step === 2 && (
        <div style={S.card}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#f9fafb", marginBottom: 4 }}>
              Review column mapping
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              We detected {dataRows.length} rows. Adjust any column assignments below, then import.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
            {[
              { field: "email",     label: "Email address *" },
              { field: "name",      label: "Full name" },
              { field: "firstName", label: "First name" },
              { field: "lastName",  label: "Last name" },
              { field: "phone",     label: "Phone number" },
              { field: "tags",      label: "Tags / segment" },
            ].map(({ field, label }) => (
              <div key={field}>
                <label style={S.label}>{label}</label>
                <select
                  style={S.select}
                  value={mapping[field] || ""}
                  onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}
                >
                  <option value="">— not mapped —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Preview table */}
          {preview.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.7px" }}>
                Preview (first {preview.length} rows)
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["email", "name / first+last", "phone", "tags"].map(h => (
                        <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "#6b7280", borderBottom: "1px solid #1e2d42", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => {
                      const get = (field) => {
                        const col = mapping[field];
                        if (!col) return "";
                        const idx = headers.indexOf(col);
                        return idx !== -1 ? (row[idx] || "") : "";
                      };
                      const first = get("firstName"), last = get("lastName"), fullName = get("name");
                      const displayName = fullName || [first, last].filter(Boolean).join(" ");
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #111827" }}>
                          <td style={{ padding: "6px 10px", color: "#e5e7eb" }}>{get("email") || <span style={{ color: "#6b7280" }}>—</span>}</td>
                          <td style={{ padding: "6px 10px", color: "#e5e7eb" }}>{displayName || <span style={{ color: "#6b7280" }}>—</span>}</td>
                          <td style={{ padding: "6px 10px", color: "#9ca3af" }}>{get("phone") || "—"}</td>
                          <td style={{ padding: "6px 10px", color: "#9ca3af" }}>{get("tags") || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!mapping.email && (
            <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f87171", marginBottom: 16 }}>
              ⚠️ You must map the <strong>Email address</strong> column before importing.
            </div>
          )}

          {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <div style={{ display: "flex", gap: 12 }}>
            <button style={S.outlineBtn} onClick={() => setStep(1)}>← Back</button>
            <button
              style={{ ...S.btn("#2563eb"), opacity: (!mapping.email || importing) ? 0.5 : 1 }}
              disabled={!mapping.email || importing}
              onClick={handleConfirm}
            >
              {importing ? "Importing…" : `Import ${leadCount.toLocaleString()} contacts →`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: done ── */}
      {step === 3 && importResult && (
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f9fafb", marginBottom: 8 }}>
            {importResult.imported.toLocaleString()} contacts imported
          </div>
          <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 32 }}>
            From {platform?.name} — duplicates were skipped automatically.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/leads">
              <button style={S.btn("#22c55e")}>View Contacts →</button>
            </Link>
            <button style={S.outlineBtn} onClick={() => { setStep(0); setPlatform(null); setHeaders([]); setDataRows([]); setMapping({}); setPreview([]); setImportResult(null); }}>
              Import more
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
