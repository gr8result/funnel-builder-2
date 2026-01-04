// /pages/modules/affiliates/vendor/program-settings.js
// ✅ Vendor Program Settings page — define rules, commissions, tracking, and approval policies
// Saves to Supabase table: vendor_programs

import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../utils/supabase-client";

export default function ProgramSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [program, setProgram] = useState({
    program_name: "",
    default_commission: 35,
    cookie_duration: 30,
    auto_approve: false,
    allowed_countries: "AU,NZ,US,UK",
    terms: "",
    tracking_pixel: "",
  });

  useEffect(() => {
    loadProgram();
  }, []);

  async function loadProgram() {
    setLoading(true);
    const { data, error } = await supabase.from("vendor_programs").select("*").single();
    if (!error && data) setProgram(data);
    setLoading(false);
  }

  async function saveProgram(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from("vendor_programs").upsert(program);
      if (error) throw error;
      alert("Program settings saved successfully.");
    } catch (err) {
      console.error("Error saving program:", err);
      alert("Failed to save program. Check console for details.");
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    setProgram({
      program_name: "",
      default_commission: 35,
      cookie_duration: 30,
      auto_approve: false,
      allowed_countries: "AU,NZ,US,UK",
      terms: "",
      tracking_pixel: "",
    });
  }

  const page = {
    wrap: {
      minHeight: "100vh",
      background: "#0c121a",
      color: "#fff",
      padding: "28px 22px",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    },
    inner: { width: "100%", maxWidth: 900, margin: "0 auto" },
    banner: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#3b82f6",
      borderRadius: 12,
      padding: "14px 18px",
      marginBottom: 30,
    },
    form: {
      background: "#111827",
      borderRadius: 12,
      border: "1px solid #3b82f6",
      padding: 22,
      display: "flex",
      flexDirection: "column",
      gap: 14,
    },
    input: {
      background: "#0f172a",
      color: "#fff",
      border: "1px solid #374151",
      borderRadius: 8,
      padding: 10,
      width: "100%",
    },
    label: { fontWeight: 700, fontSize: 14 },
    button: {
      background: "#3b82f6",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "10px 18px",
      fontWeight: 700,
      cursor: "pointer",
    },
  };

  return (
    <>
      <Head>
        <title>Program Settings | GR8 RESULT</title>
      </Head>
      <main style={page.wrap}>
        <div style={page.inner}>
          <div style={page.banner}>
            <div>
              <h1 style={{ fontSize: 22, margin: 0 }}>Program Settings</h1>
              <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }}>
                Set your program rules, approval settings, and tracking details.
              </p>
            </div>
            <Link href="/modules/affiliates/affiliate-marketplace">
              <button
                style={{
                  background: "#1e293b",
                  color: "#fff",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
            </Link>
          </div>

          {loading ? (
            <p>Loading settings...</p>
          ) : (
            <form onSubmit={saveProgram} style={page.form}>
              <div>
                <label style={page.label}>Program Name</label>
                <input
                  type="text"
                  value={program.program_name}
                  onChange={(e) => setProgram({ ...program, program_name: e.target.value })}
                  style={page.input}
                  required
                />
              </div>
              <div>
                <label style={page.label}>Default Commission (%)</label>
                <input
                  type="number"
                  value={program.default_commission}
                  onChange={(e) => setProgram({ ...program, default_commission: e.target.value })}
                  style={page.input}
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label style={page.label}>Cookie Duration (days)</label>
                <input
                  type="number"
                  value={program.cookie_duration}
                  onChange={(e) => setProgram({ ...program, cookie_duration: e.target.value })}
                  style={page.input}
                />
              </div>
              <div>
                <label style={page.label}>Allowed Countries (comma-separated)</label>
                <input
                  type="text"
                  value={program.allowed_countries}
                  onChange={(e) => setProgram({ ...program, allowed_countries: e.target.value })}
                  style={page.input}
                />
              </div>
              <div>
                <label style={page.label}>Auto-Approve Affiliates?</label>
                <select
                  value={program.auto_approve ? "yes" : "no"}
                  onChange={(e) => setProgram({ ...program, auto_approve: e.target.value === "yes" })}
                  style={page.input}
                >
                  <option value="no">No (manual approval)</option>
                  <option value="yes">Yes (auto-approve)</option>
                </select>
              </div>
              <div>
                <label style={page.label}>Tracking Pixel / Postback URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/postback?click_id={clickid}"
                  value={program.tracking_pixel}
                  onChange={(e) => setProgram({ ...program, tracking_pixel: e.target.value })}
                  style={page.input}
                />
              </div>
              <div>
                <label style={page.label}>Terms & Conditions</label>
                <textarea
                  value={program.terms}
                  onChange={(e) => setProgram({ ...program, terms: e.target.value })}
                  style={{ ...page.input, minHeight: 100 }}
                  placeholder="List your promotional rules, compliance terms, or restrictions here..."
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button type="submit" style={page.button} disabled={saving}>
                  {saving ? "Saving..." : "Save Settings"}
                </button>
                <button
                  type="button"
                  style={{ ...page.button, background: "#ef4444" }}
                  onClick={resetDefaults}
                >
                  Reset Defaults
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
