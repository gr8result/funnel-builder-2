// pages/modules/email/templates/edit.js
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import styles from "../../../../styles/templates-dashboard.module.css";

export default function EditTemplate() {
  const router = useRouter();
  const webPath = typeof router.query.path === "string" ? router.query.path : "";
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [dirty, setDirty] = useState(false);
  const debounceRef = useRef(null);

  const title = webPath ? webPath.split("/").slice(-1)[0] : "Edit template";

  // Load initial content
  useEffect(() => {
    if (!webPath) return;
    (async () => {
      try {
        setLoading(true);
        setStatus("Loading…");
        const res = await fetch(`/api/templates/read?path=${encodeURIComponent(webPath)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load");
        setContent(data.content || "");
        setStatus("");
      } catch (e) {
        setStatus(`Error: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [webPath]);

  // Debounced autosave (nice-to-have). Saves 1.2s after typing stops.
  useEffect(() => {
    if (!dirty || !webPath) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/templates/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: webPath, content }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Save failed");
        setStatus("Saved");
        setDirty(false);
      } catch (e) {
        setStatus(`Error: ${e.message}`);
      }
    }, 1200);
    return () => clearTimeout(debounceRef.current);
  }, [content, dirty, webPath]);

  async function onSaveClick() {
    try {
      setStatus("Saving…");
      const res = await fetch("/api/templates/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: webPath, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setStatus("Saved");
      setDirty(false);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  }

  const previewHref = webPath || "";

  return (
    <div className={styles.wrap}>
      <h1 className={styles.h1}>Edit: {title}</h1>
      <p className={styles.lede}>
        File: <code>{webPath || "(none)"}</code>
      </p>

      <div style={{ display: "flex", gap: 12, margin: "8px 0 16px" }}>
        <Link href="/modules/email/templates/all" legacyBehavior>
          <a className="btn btn-muted">← Back</a>
        </Link>
        <button className="btn" onClick={onSaveClick} disabled={!webPath || loading}>
          Save
        </button>
        {previewHref ? (
          <a className="btn btn-ghost" href={previewHref} target="_blank" rel="noreferrer">
            Preview in new tab
          </a>
        ) : null}
        <span style={{ alignSelf: "center", color: "var(--muted)" }}>{status}</span>
      </div>

      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
          setStatus("Editing…");
        }}
        placeholder={loading ? "Loading…" : "Edit HTML here…"}
        spellCheck={false}
        style={{
          width: "100%",
          minHeight: "70vh",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 13,
          lineHeight: 1.5,
          background: "var(--panel)",
          color: "var(--text)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 14,
          outline: "none",
        }}
      />

      <style jsx>{`
        .btn {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: #0ea5e9;
          color: white;
          padding: 8px 12px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
        }
        .btn:hover {
          filter: brightness(1.05);
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-muted {
          background: transparent;
          color: var(--text);
        }
        .btn-ghost {
          background: transparent;
          color: var(--text);
        }
        @media (prefers-color-scheme: dark) {
          .btn {
            background: #22c55e;
          }
        }
      `}</style>
    </div>
  );
}




