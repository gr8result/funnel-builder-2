import Head from "next/head";
import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase-client";
import {
  BUSINESS_PROFILE_SECTIONS,
  VAULT_STATUS_LABELS,
} from "../../components/account/businessProfileVaultConfig";

function labelFor(sectionKey, fieldKey) {
  const section = BUSINESS_PROFILE_SECTIONS.find((item) => item.key === sectionKey);
  const field = section?.fields.find((item) => item.key === fieldKey);
  return field?.label || fieldKey;
}

export default function AdminBusinessProfileVaults() {
  const [vaults, setVaults] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function apiFetch(url, options = {}) {
    const token = await getToken();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "Request failed");
    return payload;
  }

  async function loadVaults() {
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch("/api/admin/business-profile-vaults");
      setVaults(payload.vaults || []);
      if (!selectedId && payload.vaults?.[0]?.id) setSelectedId(payload.vaults[0].id);
    } catch (err) {
      setError(err.message || "Could not load vaults.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSelected(id) {
    if (!id) return;
    try {
      const payload = await apiFetch(`/api/admin/business-profile-vaults?id=${encodeURIComponent(id)}`);
      setSelected(payload.vault);
      setDocuments(payload.documents || []);
      setNotes(payload.vault?.admin_notes || "");
      setReason(payload.vault?.needs_attention_reason || "");
    } catch (err) {
      setError(err.message || "Could not load vault.");
    }
  }

  useEffect(() => {
    loadVaults();
  }, []);

  useEffect(() => {
    loadSelected(selectedId);
  }, [selectedId]);

  async function updateStatus(status) {
    if (!selected?.id) return;
    try {
      const payload = await apiFetch("/api/admin/business-profile-vaults", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          status,
          adminNotes: notes,
          needsAttentionReason: reason,
        }),
      });
      setSelected(payload.vault);
      await loadVaults();
    } catch (err) {
      setError(err.message || "Status update failed.");
    }
  }

  async function openDocument(documentId) {
    try {
      const payload = await apiFetch("/api/admin/business-profile-document-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (payload.url) window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message || "Could not open document.");
    }
  }

  async function reviewDocument(documentId, verificationStatus) {
    try {
      const payload = await apiFetch("/api/admin/business-profile-document-review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, verificationStatus, adminNotes: notes }),
      });
      setDocuments((current) =>
        current.map((document) => (document.id === documentId ? payload.document : document))
      );
    } catch (err) {
      setError(err.message || "Document review failed.");
    }
  }

  return (
    <div className="admin-vault">
      <Head>
        <title>Business Profile Vault Reviews | GR8 Result</title>
      </Head>

      <header>
        <div>
          <h1>Business Profile Vault Reviews</h1>
          <p>Review submitted onboarding, verification, website, marketing, and integration records.</p>
        </div>
      </header>

      {error ? <div className="alert">{error}</div> : null}

      <div className="layout">
        <aside>
          {loading ? <p>Loading vaults...</p> : null}
          {vaults.map((vault) => (
            <button
              key={vault.id}
              type="button"
              className={selectedId === vault.id ? "active" : ""}
              onClick={() => setSelectedId(vault.id)}
            >
              <strong>{vault.accounts?.business_name || vault.accounts?.full_name || "Business Profile"}</strong>
              <span>{VAULT_STATUS_LABELS[vault.status] || vault.status} - {vault.completion_percent}%</span>
            </button>
          ))}
        </aside>

        <main>
          {!selected ? (
            <div className="card">Select a vault to review.</div>
          ) : (
            <>
              <section className="card summary">
                <div>
                  <h2>{selected.accounts?.business_name || "Business Profile"}</h2>
                  <p>{selected.accounts?.email || selected.data?.account_holder_verification?.emailAddress || "No email saved"}</p>
                </div>
                <div className="status">{VAULT_STATUS_LABELS[selected.status] || selected.status}</div>
              </section>

              <section className="card actions">
                <label>
                  Internal Notes
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
                </label>
                <label>
                  Additional Information Request
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
                </label>
                <div className="buttons">
                  <button type="button" onClick={() => updateStatus("under_review")}>Mark Under Review</button>
                  <button type="button" onClick={() => updateStatus("verified")}>Approve / Verify</button>
                  <button type="button" className="warn" onClick={() => updateStatus("needs_attention")}>Request Info</button>
                </div>
              </section>

              <section className="card">
                <h2>Documents</h2>
                <div className="documents">
                  {documents.length === 0 ? <p>No documents uploaded.</p> : null}
                  {documents.map((document) => (
                    <div key={document.id} className="document-row">
                      <button type="button" onClick={() => openDocument(document.id)}>
                        <strong>{labelFor(document.section_key, document.field_key)}</strong>
                        <span>{document.file_name} - {document.verification_status}</span>
                      </button>
                      <div>
                        <button type="button" onClick={() => reviewDocument(document.id, "approved")}>Approve</button>
                        <button type="button" className="warn" onClick={() => reviewDocument(document.id, "needs_attention")}>Needs Info</button>
                        <button type="button" className="danger" onClick={() => reviewDocument(document.id, "rejected")}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card">
                <h2>Submitted Information</h2>
                {BUSINESS_PROFILE_SECTIONS.map((section) => (
                  <details key={section.key}>
                    <summary>{section.title}</summary>
                    {section.fields.map((field) => {
                      const value = selected.data?.[section.key]?.[field.key];
                      return (
                        <div className="row" key={field.key}>
                          <strong>{field.label}</strong>
                          <span>{field.type === "boolean" ? (value ? "Yes" : "No") : value || "-"}</span>
                        </div>
                      );
                    })}
                  </details>
                ))}
              </section>
            </>
          )}
        </main>
      </div>

      <style jsx>{`
        .admin-vault {
          min-height: 100vh;
          background: #0c121a;
          color: #f8fafc;
          padding: 28px 22px 54px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        }
        header, .layout {
          max-width: 1320px;
          margin: 0 auto;
        }
        header { margin-bottom: 20px; }
        h1 { margin: 0 0 8px; font-size: 32px; letter-spacing: 0; }
        h2 { margin: 0 0 12px; font-size: 22px; letter-spacing: 0; }
        p { color: #b6c3d3; margin: 0; line-height: 1.55; }
        .layout {
          display: grid;
          grid-template-columns: 310px minmax(0, 1fr);
          gap: 20px;
        }
        aside {
          display: grid;
          gap: 8px;
          align-content: start;
        }
        aside button, .card {
          background: #111827;
          border: 1px solid #1f2937;
          border-radius: 8px;
        }
        aside button {
          color: #e5e7eb;
          padding: 12px;
          text-align: left;
          cursor: pointer;
        }
        aside button.active { border-color: #38bdf8; background: #102033; }
        aside span { display: block; margin-top: 4px; color: #9ca3af; }
        main { display: grid; gap: 14px; min-width: 0; }
        .card { padding: 18px; }
        .summary {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
        }
        .status {
          padding: 8px 12px;
          border-radius: 999px;
          background: #102033;
          color: #8bd7ff;
          font-weight: 800;
        }
        label { display: grid; gap: 8px; color: #e5e7eb; font-weight: 800; }
        textarea {
          width: 100%;
          box-sizing: border-box;
          background: #0b1220;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #f8fafc;
          padding: 11px 12px;
          font: inherit;
          resize: vertical;
        }
        .actions { display: grid; gap: 14px; }
        .buttons { display: flex; flex-wrap: wrap; gap: 10px; }
        button {
          background: #f97316;
          color: #fff;
          border: 0;
          border-radius: 8px;
          padding: 10px 14px;
          font-weight: 800;
          cursor: pointer;
        }
        button.warn { background: #d97706; }
        .documents { display: grid; gap: 8px; }
        .document-row {
          display: grid;
          background: #0f172a;
          border: 1px solid #263244;
          border-radius: 8px;
          padding: 10px;
          gap: 10px;
        }
        .document-row > button {
          display: grid;
          gap: 4px;
          text-align: left;
          background: transparent;
          color: #e5e7eb;
          padding: 0;
        }
        .document-row div { display: flex; flex-wrap: wrap; gap: 8px; }
        .documents span { color: #93c5fd; }
        button.danger { background: #dc2626; }
        details {
          border-top: 1px solid #263244;
          padding: 10px 0;
        }
        summary {
          cursor: pointer;
          color: #facc15;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .row {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 14px;
          padding: 8px 0;
        }
        .row span { color: #cbd5e1; word-break: break-word; }
        .alert {
          max-width: 1320px;
          margin: 0 auto 14px;
          border-radius: 8px;
          padding: 12px 14px;
          border: 1px solid #7f1d1d;
          background: #3b1117;
          color: #fecaca;
        }
        @media (max-width: 920px) {
          .layout { grid-template-columns: 1fr; }
          .row { grid-template-columns: 1fr; gap: 4px; }
          .summary { display: grid; }
        }
      `}</style>
    </div>
  );
}
