// /pages/modules/email/broadcast/import.js
import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../../../../utils/supabase-client";

export default function BroadcastImport() {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result || "";
      setContent(String(text));
      if (!subject) {
        setSubject(file.name.replace(/\.[^/.]+$/, ""));
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!content.trim()) {
      alert("Please choose a file first.");
      return;
    }

    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) {
        alert("Please log in");
        router.push("/login");
        return;
      }

      const title = subject || fileName || "Imported email";

      const { error } = await supabase.from("email_broadcasts").insert({
        user_id: user.id,
        title,
        subject: subject || title,
        to_field: "",
        html_content: content,
      });

      if (error) throw error;

      alert("Broadcast imported and saved!");
      router.push("/modules/email/broadcast/list");
    } catch (e) {
      console.error(e);
      alert("Could not import file");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Import Broadcast | Email</title>
      </Head>

      <main style={styles.wrap}>
        <div style={styles.inner}>
          <div style={styles.banner}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 26 }}>📂</span>
              <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
                  Import Broadcast
                </h1>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
                  Upload an HTML email file from your computer.
                </p>
              </div>
            </div>
            <button
              style={styles.backBtn}
              onClick={() => router.push("/modules/email")}
            >
              ← Back
            </button>
          </div>

          <div style={styles.card}>
            <div style={{ marginBottom: 14 }}>
              <label style={styles.label}>Choose file</label>
              <input
                type="file"
                accept=".html,.htm,.txt,.eml"
                onChange={handleFileChange}
                style={{ color: "#e5e7eb", fontSize: 13 }}
              />
              <p style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                We&apos;ll read the file as text and save it as a broadcast.
              </p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={styles.label}>Subject / Internal title</label>
              <input
                style={styles.input}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Optional subject line"
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={styles.label}>Preview (read-only)</label>
              <textarea
                style={{ ...styles.input, minHeight: 220, fontFamily: "monospace" }}
                value={content}
                readOnly
                placeholder="File contents will appear here after you choose a file."
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => router.push("/modules/email/broadcast/list")}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.saveBtn}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Imported Broadcast"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    padding: "24px 16px 40px",
    color: "#fff",
  },
  inner: { maxWidth: 900, margin: "0 auto" },
  banner: {
    background: "#f59e0b",
    borderRadius: 14,
    padding: "14px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: {
    background: "#111827",
    color: "#fff",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 13,
    cursor: "pointer",
  },
  card: {
    background: "#111827",
    borderRadius: 14,
    border: "1px solid #1f2937",
    padding: 18,
  },
  label: { display: "block", marginBottom: 5, fontSize: 13, opacity: 0.9 },
  input: {
    width: "100%",
    borderRadius: 8,
    border: "1px solid #374151",
    padding: "8px 10px",
    background: "#020617",
    color: "#fff",
    fontSize: 14,
  },
  saveBtn: {
    background: "#22c55e",
    color: "#fff",
    borderRadius: 8,
    border: "none",
    padding: "8px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtn: {
    background: "#374151",
    color: "#e5e7eb",
    borderRadius: 8,
    border: "1px solid #4b5563",
    padding: "8px 16px",
    fontWeight: 500,
    cursor: "pointer",
  },
};
