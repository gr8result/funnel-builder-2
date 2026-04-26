// /components/nodes/EmailNodeDrawer.js
// FULL REPLACEMENT — stores HTML path + preview + bucket so engine can send the right email
// ✅ Saves: emailId, emailName, emailPreviewUrl, htmlPath, bucket
// ✅ htmlPath is always: `${userId}/finished-emails/${emailId}.html`
// ✅ Preview is still PNG/JPG/WEBP public URL guess

import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase-client";
import { useRouter } from "next/router";

function prettyTemplateName(value) {
  return String(value || "")
    .replace(/\.html$/i, "")
    .replace(/^doc:/i, "")
    .replace(/^legacy:/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function EmailNodeDrawer({ node, onSave, onClose, userId, flowId }) {
  const router = useRouter();

  const [label, setLabel] = useState(node?.data?.label || "Email Step");

  const [emailId, setEmailId] = useState(node?.data?.emailId || "");
  const [emailName, setEmailName] = useState(node?.data?.emailName || "");
  const [emailPreviewUrl, setEmailPreviewUrl] = useState(node?.data?.emailPreviewUrl || "");

  // ✅ NEW: this is what the engine needs
  const [bucket, setBucket] = useState(node?.data?.bucket || "email-user-assets");
  const [htmlPath, setHtmlPath] = useState(node?.data?.htmlPath || "");

  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState("");

  // ✅ Analytics: how many leads at this node
  const [nodeCount, setNodeCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    loadEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ✅ NEW: Fetch node stats to show how many leads at this node
  useEffect(() => {
    if (!flowId || !node?.id) return;
    
    const fetchNodeStats = async () => {
      setLoadingStats(true);
      try {
        const res = await fetch(`/api/automation/engine/node-stats?flow_id=${flowId}`);
        const data = await res.json();
        
        if (data.ok && data.counts) {
          const count = data.counts[node.id] || 0;
          setNodeCount(count);
        }
      } catch (err) {
        console.error('Failed to fetch node stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchNodeStats();
    // Poll every 5 seconds for live updates
    const interval = setInterval(fetchNodeStats, 5000);
    return () => clearInterval(interval);
  }, [flowId, node?.id]);

  async function loadPreviewForTemplate(template) {
    if (!template) {
      setPreviewHtml("");
      setPreviewError("");
      return;
    }

    try {
      setPreviewError("");
      let html = "";

      if (template.source === "doc" && template.htmlUrl) {
        const res = await fetch(`${template.htmlUrl}?v=${Date.now()}`);
        html = await res.text();
        if (!res.ok) throw new Error(html || "Unable to load email preview.");
      } else if (template.htmlPath) {
        const res = await fetch(`/api/email/get-saved-email?path=${encodeURIComponent(template.htmlPath)}`);
        html = await res.text();
        if (!res.ok) throw new Error(html || "Unable to load email preview.");
      }

      setPreviewHtml(String(html || ""));
    } catch (err) {
      console.error("email preview load failed:", err);
      setPreviewHtml("");
      setPreviewError(err?.message || "Unable to load email preview.");
    }
  }

  async function loadEmails() {
    setLoading(true);
    setPreviewError("");

    try {
      const [docsRes, legacyRes] = await Promise.allSettled([
        fetch(`/api/email/builder-doc-list?userId=${encodeURIComponent(userId)}`),
        fetch(`/api/email/list-saved-emails?userId=${encodeURIComponent(userId)}`),
      ]);

      const mapped = [];

      if (docsRes.status === "fulfilled") {
        const docsJson = await docsRes.value.json().catch(() => null);
        if (docsRes.value.ok && docsJson?.ok) {
          for (const doc of docsJson.docs || []) {
            const docId = String(doc?.docId || "");
            if (!docId) continue;
            mapped.push({
              id: `doc:${docId}`,
              name: prettyTemplateName(doc?.name || docId),
              previewUrl: String(doc?.thumbUrl || ""),
              source: "doc",
              bucket: "email-user-assets",
              htmlPath: `${userId}/builder-docs/${docId}.html`,
              htmlUrl: String(doc?.htmlUrl || ""),
            });
          }
        }
      }

      if (legacyRes.status === "fulfilled") {
        const legacyJson = await legacyRes.value.json().catch(() => null);
        if (legacyRes.value.ok && legacyJson?.ok) {
          for (const file of legacyJson.files || []) {
            const path = String(file?.path || "");
            if (!path) continue;
            mapped.push({
              id: `legacy:${path}`,
              name: prettyTemplateName(file?.name || file?.filename || path),
              previewUrl: "",
              source: "legacy",
              bucket: "email-user-assets",
              htmlPath: path,
              htmlUrl: "",
            });
          }
        }
      }

      const deduped = Array.from(new Map(mapped.map((item) => [item.id, item])).values()).sort((a, b) => a.name.localeCompare(b.name));
      setEmails(deduped);

      const existing = deduped.find((entry) => entry.id === emailId || entry.htmlPath === htmlPath);
      if (existing) {
        setEmailId(existing.id);
        setEmailName(existing.name || existing.id || "");
        setEmailPreviewUrl(existing.previewUrl || emailPreviewUrl || "");
        setHtmlPath(existing.htmlPath || htmlPath || "");
        setBucket(existing.bucket || "email-user-assets");
        await loadPreviewForTemplate(existing);
      }
    } catch (err) {
      console.error("loadEmails failed:", err);
      setEmails([]);
      setPreviewHtml("");
      setPreviewError(err?.message || "Unable to load saved emails.");
    } finally {
      setLoading(false);
    }
  }

  const saveAndClose = () => {
    onSave({
      ...node.data,
      label,
      emailId,
      emailName,
      emailPreviewUrl,

      // ✅ CRITICAL FOR ENGINE
      bucket: bucket || "email-user-assets",
      htmlPath,
      storagePath: htmlPath, // (extra compatibility, engine checks storagePath too)
    });
  };

  const createNewEmail = () => {
    router.push("/modules/email/templates/select?fromNode=1");
  };

  return (
    <div style={s.overlay}>
      <div style={s.drawer}>
        <div style={s.header}>
          <h2>Edit Email Node</h2>
          <button onClick={onClose} style={s.close}>×</button>
        </div>

        <div style={s.body}>
          <label style={s.label}>Node Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={s.input}
            placeholder="e.g. Send Welcome Email"
          />

          {/* ✅ Analytics: Show how many leads at this node */}
          <div style={s.statsBox}>
            <div style={s.statLabel}>Leads at this stage:</div>
            <div style={s.statValue}>{loadingStats ? "..." : nodeCount}</div>
          </div>

          <label style={s.label}>Select Email</label>
          {loading ? (
            <div style={{ opacity: 0.7 }}>Loading emails…</div>
          ) : (
            <select
              value={emailId}
              onChange={async (e) => {
                const id = e.target.value;
                setEmailId(id);

                const chosen = emails.find((em) => em.id === id);

                setEmailName(chosen?.name || prettyTemplateName(id) || "");
                setEmailPreviewUrl(chosen?.previewUrl || "");
                setHtmlPath(chosen?.htmlPath || "");
                setBucket(chosen?.bucket || "email-user-assets");
                await loadPreviewForTemplate(chosen);
              }}
              style={s.input}
            >
              <option value="">-- Select a Saved Email --</option>
              {emails.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}

          <button style={s.createBtn} onClick={createNewEmail}>
            ➕ Create New Email
          </button>

          <div style={s.previewWrap}>
            {previewError ? <div style={s.previewEmpty}>{previewError}</div> : null}
            {!previewError && previewHtml ? (
              <iframe title="Selected email preview" srcDoc={previewHtml} style={s.previewFrame} />
            ) : null}
            {!previewError && !previewHtml && emailPreviewUrl ? (
              <img src={emailPreviewUrl} alt={emailName || "Email preview"} style={s.previewImage} />
            ) : null}
            {!previewError && !previewHtml && !emailPreviewUrl ? (
              <div style={s.previewEmpty}>Select a saved email to preview it here.</div>
            ) : null}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
            <div><b>Bucket:</b> {bucket}</div>
            <div style={{ wordBreak: "break-all" }}><b>HTML:</b> {htmlPath || "-"}</div>
          </div>
        </div>

        <div style={s.footer}>
          <button onClick={saveAndClose} style={s.saveBtn}>💾 Save</button>
          <button onClick={onClose} style={s.cancelBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    zIndex: 4000,
    display: "flex",
    justifyContent: "flex-end",
  },
  drawer: {
    width: "420px",
    height: "100%",
    background: "#0f172a",
    borderLeft: "1px solid #1e293b",
    padding: "24px",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  close: {
    fontSize: 28,
    background: "transparent",
    border: "none",
    color: "#fff",
    cursor: "pointer",
  },
  body: {
    flex: 1,
    overflowY: "auto",
  },
  statsBox: {
    marginTop: 12,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    background: "rgba(59, 130, 246, 0.15)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    color: "#3b82f6",
  },
  label: {
    marginTop: 10,
    marginBottom: 4,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: "10px",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#fff",
    marginBottom: 14,
  },
  createBtn: {
    width: "100%",
    padding: "10px",
    background: "#3b82f6",
    color: "#fff",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    marginTop: 4,
    fontWeight: 600,
  },
  previewWrap: {
    marginTop: 14,
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid #334155",
    background: "#020617",
    minHeight: 220,
  },
  previewFrame: {
    width: "100%",
    height: 260,
    border: "none",
    background: "#fff",
  },
  previewImage: {
    display: "block",
    width: "100%",
    maxHeight: 260,
    objectFit: "contain",
    background: "#fff",
  },
  previewEmpty: {
    minHeight: 220,
    display: "grid",
    placeItems: "center",
    color: "#94a3b8",
    padding: 16,
    textAlign: "center",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTop: "1px solid #1e293b",
  },
  saveBtn: {
    background: "#22c55e",
    padding: "10px 14px",
    borderRadius: 8,
    border: "none",
    fontWeight: 700,
    cursor: "pointer",
  },
  cancelBtn: {
    background: "#ef4444",
    padding: "10px 14px",
    borderRadius: 8,
    border: "none",
    fontWeight: 700,
    cursor: "pointer",
  },
};
