import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../utils/supabase-client";
import {
  BUSINESS_PROFILE_SECTIONS,
  VAULT_STATUS_LABELS,
  calculateVaultCompletion,
  createEmptyVaultData,
} from "./businessProfileVaultConfig";

const REVIEW_STEP = BUSINESS_PROFILE_SECTIONS.length;

function fieldKey(sectionKey, fieldKey) {
  return `${sectionKey}.${fieldKey}`;
}

function getRequiredIssues(data) {
  const issues = [];
  BUSINESS_PROFILE_SECTIONS.forEach((section) => {
    section.fields.forEach((field) => {
      if (!field.required) return;
      const value = data?.[section.key]?.[field.key];
      if (value === undefined || value === null || String(value).trim() === "") {
        issues.push({ section: section.title, label: field.label });
      }
    });
  });
  return issues;
}

function makeDocumentMap(documents) {
  return (documents || []).reduce((acc, document) => {
    const key = fieldKey(document.section_key, document.field_key);
    if (!acc[key]) acc[key] = [];
    acc[key].push(document);
    return acc;
  }, {});
}

export default function BusinessProfileVault() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("Saved");
  const [submitState, setSubmitState] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [vault, setVault] = useState(null);
  const [data, setData] = useState(createEmptyVaultData());
  const [documents, setDocuments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [validationIssues, setValidationIssues] = useState([]);
  const [error, setError] = useState("");
  const loadedRef = useRef(false);

  const documentMap = useMemo(() => makeDocumentMap(documents), [documents]);
  const completion = useMemo(() => calculateVaultCompletion(data), [data]);
  const activeSection = BUSINESS_PROFILE_SECTIONS[activeStep];
  const isReview = activeStep === REVIEW_STEP;

  async function getToken() {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData?.session?.access_token || "";
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

  async function loadVault() {
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch("/api/account/business-profile-vault");
      setVault(payload.vault);
      setData({ ...createEmptyVaultData(), ...(payload.vault?.data || {}) });
      setDocuments(payload.documents || []);
      setSaveState("Saved");
      loadedRef.current = true;
    } catch (err) {
      setError(err.message || "Could not load Business Profile Vault.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVault();
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    setSaveState("Saving...");
    const timeout = setTimeout(async () => {
      setSaving(true);
      try {
        const payload = await apiFetch("/api/account/business-profile-vault", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        setVault(payload.vault);
        setDocuments(payload.documents || documents);
        setSaveState("Saved");
      } catch (err) {
        setSaveState("Save failed");
        setError(err.message || "Auto-save failed.");
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(timeout);
  }, [data]);

  function updateField(sectionKey, key, value) {
    setValidationIssues([]);
    setData((current) => ({
      ...current,
      [sectionKey]: {
        ...(current[sectionKey] || {}),
        [key]: value,
      },
    }));
  }

  function uploadFile(section, field, file) {
    if (!file) return;
    const key = fieldKey(section.key, field.key);
    setUploadProgress((current) => ({ ...current, [key]: 1 }));

    getToken()
      .then((token) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("sectionKey", section.key);
        formData.append("fieldKey", field.key);
        formData.append("documentType", data?.[section.key]?.documentType || field.label);

        const request = new XMLHttpRequest();
        request.open("POST", "/api/account/business-profile-upload");
        request.setRequestHeader("Authorization", `Bearer ${token}`);
        request.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          setUploadProgress((current) => ({
            ...current,
            [key]: Math.max(1, Math.round((event.loaded / event.total) * 100)),
          }));
        };
        request.onload = () => {
          const payload = JSON.parse(request.responseText || "{}");
          if (request.status < 200 || request.status >= 300) {
            setError(payload?.error || "Upload failed.");
            setUploadProgress((current) => ({ ...current, [key]: 0 }));
            return;
          }
          setDocuments((current) => [payload.document, ...current]);
          updateField(section.key, field.key, payload.document.id);
          if (section.key === "proof_of_address") {
            updateField(section.key, "uploadDate", new Date().toISOString().slice(0, 10));
            updateField(section.key, "verificationStatus", "Pending");
          }
          setUploadProgress((current) => ({ ...current, [key]: 100 }));
        };
        request.onerror = () => {
          setError("Upload failed.");
          setUploadProgress((current) => ({ ...current, [key]: 0 }));
        };
        request.send(formData);
      })
      .catch((err) => setError(err.message || "Upload failed."));
  }

  async function openDocument(documentId, admin = false) {
    try {
      const endpoint = admin
        ? "/api/admin/business-profile-document-url"
        : "/api/account/business-profile-document-url";
      const payload = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (payload.url) window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message || "Could not open document.");
    }
  }

  async function submitForReview() {
    const issues = getRequiredIssues(data);
    setValidationIssues(issues);
    if (issues.length > 0) {
      setActiveStep(REVIEW_STEP);
      return;
    }

    setSubmitState("Submitting...");
    try {
      const payload = await apiFetch("/api/account/business-profile-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      setVault(payload.vault);
      setDocuments(payload.documents || documents);
      setSubmitState("Submitted for review");
      setSaveState("Saved");
    } catch (err) {
      setSubmitState("");
      setError(err.message || "Submission failed.");
    }
  }

  function renderInput(section, field) {
    const value = data?.[section.key]?.[field.key];
    const key = fieldKey(section.key, field.key);
    const disabled = field.readOnly;

    if (field.type === "file") {
      const docs = documentMap[key] || [];
      return (
        <div>
          <input
            type="file"
            onChange={(event) => uploadFile(section, field, event.target.files?.[0])}
            className="vault-file"
          />
          {uploadProgress[key] > 0 && uploadProgress[key] < 100 ? (
            <div className="progress"><span style={{ width: `${uploadProgress[key]}%` }} /></div>
          ) : null}
          {docs.length > 0 ? (
            <div className="documents">
              {docs.slice(0, 3).map((document) => (
                <button key={document.id} type="button" onClick={() => openDocument(document.id)}>
                  {document.file_name} - {document.verification_status}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          value={value || ""}
          disabled={disabled}
          onChange={(event) => updateField(section.key, field.key, event.target.value)}
          rows={4}
        />
      );
    }

    if (field.type === "select") {
      return (
        <select
          value={value || ""}
          disabled={disabled}
          onChange={(event) => updateField(section.key, field.key, event.target.value)}
        >
          <option value="">Select...</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    if (field.type === "boolean") {
      return (
        <label className="toggle">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => updateField(section.key, field.key, event.target.checked)}
          />
          <span>{value ? "Yes" : "No"}</span>
        </label>
      );
    }

    if (field.type === "status") {
      return <input value={value || "Pending"} disabled />;
    }

    return (
      <input
        type={field.type || "text"}
        value={value || ""}
        disabled={disabled}
        onChange={(event) => updateField(section.key, field.key, event.target.value)}
      />
    );
  }

  if (loading) {
    return <div className="vault-shell"><div className="vault-card">Loading Business Profile Vault...</div></div>;
  }

  return (
    <div className="vault-shell">
      <div className="vault-header">
        <div>
          <Link href="/dashboard" className="back-link">Back to Dashboard</Link>
          <h1>Business Profile Vault</h1>
          <p>Verification, onboarding, integrations, website setup, marketing assets, and business management records.</p>
        </div>
        <div className="status-card">
          <span>{VAULT_STATUS_LABELS[vault?.status] || "Not Started"}</span>
          <strong>{completion}%</strong>
          <small>{saving ? "Auto-saving" : saveState}</small>
        </div>
      </div>

      {error ? <div className="alert error">{error}</div> : null}
      {vault?.needs_attention_reason ? <div className="alert warn">{vault.needs_attention_reason}</div> : null}

      <div className="progress-rail">
        <span style={{ width: `${completion}%` }} />
      </div>

      <div className="layout">
        <aside className="steps">
          {BUSINESS_PROFILE_SECTIONS.map((section, index) => (
            <button
              key={section.key}
              type="button"
              className={activeStep === index ? "active" : ""}
              onClick={() => setActiveStep(index)}
            >
              <span>{index + 1}</span>
              {section.title}
            </button>
          ))}
          <button
            type="button"
            className={isReview ? "active" : ""}
            onClick={() => setActiveStep(REVIEW_STEP)}
          >
            <span>{REVIEW_STEP + 1}</span>
            Review
          </button>
        </aside>

        <main className="vault-card">
          {!isReview ? (
            <>
              <div className="section-head">
                <div>
                  <h2>{activeSection.title}</h2>
                  <p>{activeSection.description}</p>
                </div>
                <button type="button" onClick={() => setActiveStep(Math.min(activeStep + 1, REVIEW_STEP))}>
                  Save & Continue
                </button>
              </div>

              <details open className="accordion">
                <summary>{activeSection.title}</summary>
                <div className="field-grid">
                  {activeSection.fields.map((field) => (
                    <label key={field.key} className={field.type === "textarea" ? "wide field" : "field"}>
                      <span>
                        {field.label}
                        {field.required ? <em>Required</em> : <small>Optional</small>}
                      </span>
                      {renderInput(activeSection, field)}
                    </label>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <div>
              <div className="section-head">
                <div>
                  <h2>Review Before Submission</h2>
                  <p>Check the vault information before sending it to the GR8 Result team for review.</p>
                </div>
                <button type="button" onClick={submitForReview}>Submit For Review</button>
              </div>

              {validationIssues.length > 0 ? (
                <div className="alert error">
                  {validationIssues.length} required field{validationIssues.length === 1 ? "" : "s"} still need attention.
                </div>
              ) : null}

              <div className="review-list">
                {BUSINESS_PROFILE_SECTIONS.map((section) => (
                  <details key={section.key} open={validationIssues.some((issue) => issue.section === section.title)}>
                    <summary>{section.title}</summary>
                    {section.fields.map((field) => {
                      const value = data?.[section.key]?.[field.key];
                      const docs = documentMap[fieldKey(section.key, field.key)] || [];
                      return (
                        <div key={field.key} className="review-row">
                          <strong>{field.label}</strong>
                          {field.type === "file" && docs.length > 0 ? (
                            <button type="button" onClick={() => openDocument(docs[0].id)}>{docs[0].file_name}</button>
                          ) : (
                            <span>{field.type === "boolean" ? (value ? "Yes" : "No") : value || "-"}</span>
                          )}
                        </div>
                      );
                    })}
                  </details>
                ))}
              </div>
              {submitState ? <div className="alert success">{submitState}</div> : null}
            </div>
          )}
        </main>
      </div>

      <style jsx>{`
        .vault-shell {
          min-height: 100vh;
          background: #0c121a;
          color: #f8fafc;
          padding: 28px 22px 56px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        }
        .vault-header {
          max-width: 1320px;
          margin: 0 auto 20px;
          display: grid;
          grid-template-columns: 1fr 180px;
          gap: 18px;
          align-items: end;
        }
        h1 { margin: 10px 0 8px; font-size: 34px; letter-spacing: 0; }
        h2 { margin: 0 0 8px; font-size: 24px; letter-spacing: 0; }
        p { color: #b6c3d3; margin: 0; line-height: 1.55; }
        .back-link { color: #8bd7ff; font-weight: 700; text-decoration: none; }
        .status-card, .vault-card {
          background: #111827;
          border: 1px solid #1f2937;
          border-radius: 8px;
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.22);
        }
        .status-card { padding: 16px; display: grid; gap: 4px; }
        .status-card span, .status-card small { color: #9ca3af; }
        .status-card strong { font-size: 30px; color: #38bdf8; }
        .progress-rail {
          max-width: 1320px;
          height: 8px;
          margin: 0 auto 18px;
          background: #1f2937;
          border-radius: 999px;
          overflow: hidden;
        }
        .progress-rail span, .progress span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, #14b8a6, #38bdf8);
        }
        .layout {
          max-width: 1320px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: 20px;
        }
        .steps {
          display: grid;
          gap: 8px;
          align-content: start;
        }
        .steps button {
          display: grid;
          grid-template-columns: 30px 1fr;
          gap: 10px;
          align-items: center;
          text-align: left;
          border: 1px solid #1f2937;
          background: #111827;
          color: #dbeafe;
          border-radius: 8px;
          padding: 11px 12px;
          cursor: pointer;
        }
        .steps button.active { border-color: #38bdf8; background: #102033; }
        .steps span {
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #1f2937;
          color: #93c5fd;
          font-size: 13px;
          font-weight: 800;
        }
        .vault-card { padding: 22px; min-width: 0; }
        .section-head {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 18px;
        }
        button {
          background: #f97316;
          color: #fff;
          border: 0;
          border-radius: 8px;
          padding: 11px 16px;
          font-weight: 800;
          cursor: pointer;
        }
        .accordion, .review-list details {
          border: 1px solid #263244;
          border-radius: 8px;
          background: #0f172a;
          margin-bottom: 12px;
        }
        summary {
          padding: 14px 16px;
          cursor: pointer;
          font-weight: 800;
          color: #facc15;
        }
        .field-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          padding: 0 16px 18px;
        }
        .field { display: grid; gap: 8px; min-width: 0; }
        .field.wide { grid-column: 1 / -1; }
        .field > span {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: #e5e7eb;
          font-weight: 700;
        }
        em, small {
          font-style: normal;
          color: #9ca3af;
          font-size: 12px;
          font-weight: 700;
        }
        input, select, textarea {
          width: 100%;
          box-sizing: border-box;
          background: #0b1220;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #f8fafc;
          padding: 11px 12px;
          font: inherit;
        }
        input:disabled { color: #94a3b8; background: #111827; }
        textarea { resize: vertical; min-height: 104px; }
        .toggle {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #e5e7eb;
        }
        .toggle input { width: 18px; height: 18px; }
        .progress {
          height: 7px;
          margin-top: 8px;
          background: #1f2937;
          border-radius: 999px;
          overflow: hidden;
        }
        .documents {
          display: grid;
          gap: 6px;
          margin-top: 8px;
        }
        .documents button, .review-row button {
          background: transparent;
          color: #93c5fd;
          padding: 0;
          text-align: left;
          text-decoration: underline;
          font-weight: 700;
        }
        .alert {
          max-width: 1320px;
          margin: 0 auto 14px;
          border-radius: 8px;
          padding: 12px 14px;
          border: 1px solid #334155;
        }
        .alert.error { background: #3b1117; border-color: #7f1d1d; color: #fecaca; }
        .alert.warn { background: #392912; border-color: #92400e; color: #fde68a; }
        .alert.success { background: #083520; border-color: #047857; color: #bbf7d0; margin-top: 14px; }
        .review-list { display: grid; gap: 10px; }
        .review-row {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 16px;
          padding: 10px 16px;
          border-top: 1px solid #1f2937;
        }
        .review-row span { color: #cbd5e1; word-break: break-word; }
        @media (max-width: 920px) {
          .vault-header, .layout { grid-template-columns: 1fr; }
          .steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .field-grid { grid-template-columns: 1fr; }
          .section-head { display: grid; }
          .review-row { grid-template-columns: 1fr; gap: 5px; }
        }
        @media (max-width: 560px) {
          .vault-shell { padding: 18px 12px 42px; }
          h1 { font-size: 28px; }
          .steps { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
