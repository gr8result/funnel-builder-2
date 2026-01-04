// /pages/modules/email/templates/new.js
// FULL REPLACEMENT
// ✅ Removes broken import: @services/supabaseClient
// ✅ Removes missing dependency: mjml
// ✅ Simple “new template” builder that saves HTML to storage

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../../utils/supabase-client";

export default function NewEmailTemplate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);

  const [name, setName] = useState("");
  const [html, setHtml] = useState(`<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; padding: 20px;">
    <h1>Hello 👋</h1>
    <p>This is a new email template.</p>
  </body>
</html>`);

  useEffect(() => {
    (async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      setUser(u || null);
    })();
  }, []);

  const save = async () => {
    if (!user) return alert("You must be logged in.");
    if (!name.trim()) return alert("Please enter a template name.");
    if (!html.trim()) return alert("HTML is empty.");

    setBusy(true);
    try {
      const safe = name.trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-");
      const path = `${user.id}/finished-emails/${safe}.html`;

      const blob = new Blob([html], { type: "text/html" });

      const { error: upErr } = await supabase.storage
        .from("email-user-assets")
        .upload(path, blob, { upsert: true, contentType: "text/html" });

      if (upErr) throw upErr;

      alert("Saved template to storage:\n" + path);
      router.push("/modules/email/broadcast");
    } catch (e) {
      console.error(e);
      alert("Save failed: " + (e?.message || "Unknown error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "#0c121a", minHeight: "100vh", color: "#fff" }}>
      <div
        style={{
          width: "1320px",
          maxWidth: "100%",
          margin: "24px auto 16px",
          background: "#f59e0b",
          color: "#111",
          padding: "18px 22px",
          borderRadius: "16px",
          fontWeight: 800,
          fontSize: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 44 }}>🧩</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span>New template</span>
            <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.9 }}>
              Create HTML and save it to your finished-emails library.
            </span>
          </div>
        </div>

        <Link
          href="/modules/email"
          style={{
            background: "#111",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 8,
            padding: "6px 14px",
            textDecoration: "none",
            border: "1px solid #000",
          }}
        >
          ← Back
        </Link>
      </div>

      <div style={{ width: "1320px", maxWidth: "100%", margin: "0 auto" }}>
        <div
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px" }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                Template name
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Welcome email"
                style={{
                  width: "100%",
                  padding: "12px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#0b1220",
                  color: "#fff",
                  fontSize: 16,
                }}
              />
              <button
                onClick={save}
                disabled={busy}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #15803d",
                  background: "#16a34a",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? "Saving..." : "Save template"}
              </button>
            </div>

            <div style={{ flex: "2 1 640px" }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>HTML</div>
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={16}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#0b1220",
                  color: "#fff",
                  fontSize: 14,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
