import Head from "next/head";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useApiFetch, useWorkspace } from "../../../hooks/useWorkspace";

const EMPTY_COMPOSE = {
  id: "",
  draftId: "",
  subject: "",
  previewText: "",
  bodyHtml: "",
  recipients: { to: [], cc: [], bcc: [] },
  attachments: [],
};

const STANDARD_LEGAL_NOTICE =
  "This email and any attachments are intended only for the named recipient. They may contain confidential or privileged information. If you received this email in error, please notify the sender and delete it. Any views expressed are those of the sender unless expressly stated otherwise.";

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function signatureHtml(signature) {
  if (!signature || signature.id === "none") return "";
  const rows = [signature.name, signature.title, signature.phone, signature.website].filter(Boolean);
  const logo = String(signature.logoUrl || signature.avatarUrl || "").trim();
  const socials = Array.isArray(signature.socialLinks) ? signature.socialLinks : [];
  const socialHtml = socials
    .filter((link) => link?.url)
    .map((link) => `<a href="${escapeHtml(link.url)}">${escapeHtml(link.label || link.url)}</a>`)
    .join(" ");

  return `
    <div class="sig">
      ${/^https?:\/\//i.test(logo) ? `<img src="${escapeHtml(logo)}" alt="" />` : ""}
      <div>
        ${rows.map((row, index) => `<div class="${index === 0 ? "strong" : ""}">${escapeHtml(row)}</div>`).join("")}
        ${socialHtml ? `<div class="links">${socialHtml}</div>` : ""}
        ${signature.legalFooter ? `<div class="legal">${escapeHtml(signature.legalFooter)}</div>` : ""}
      </div>
    </div>
  `;
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function makeId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ComposeEmailPage() {
  const apiFetch = useApiFetch();
  const { workspaceId, loading: workspaceLoading } = useWorkspace();
  const editorRef = useRef(null);

  const [profiles, setProfiles] = useState({ senders: [], signatures: [] });
  const [selectedSenderId, setSelectedSenderId] = useState("default");
  const [selectedSignatureId, setSelectedSignatureId] = useState("default");
  const [senderForm, setSenderForm] = useState({ label: "", fromName: "", fromEmail: "", replyTo: "" });
  const [senderEditorOpen, setSenderEditorOpen] = useState(false);
  const [signatureForm, setSignatureForm] = useState({
    label: "",
    name: "",
    title: "",
    phone: "",
    website: "",
    logoUrl: "",
    avatarUrl: "",
    socialLinksText: "",
    legalFooter: STANDARD_LEGAL_NOTICE,
  });
  const [signatureEditorOpen, setSignatureEditorOpen] = useState(false);
  const [compose, setCompose] = useState(EMPTY_COMPOSE);
  const [entry, setEntry] = useState({ to: "", cc: "", bcc: "" });
  const [crmSearch, setCrmSearch] = useState("");
  const [crmResults, setCrmResults] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [sent, setSent] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  const selectedSender = useMemo(
    () => profiles.senders.find((sender) => sender.id === selectedSenderId) || profiles.senders[0] || null,
    [profiles.senders, selectedSenderId]
  );

  const selectedSignature = useMemo(
    () => profiles.signatures.find((sig) => sig.id === selectedSignatureId) || null,
    [profiles.signatures, selectedSignatureId]
  );

  const renderedPreview = useMemo(() => {
    return `
      <div class="mail-body">
        ${compose.bodyHtml || ""}
        ${signatureHtml(selectedSignature)}
      </div>
    `;
  }, [compose.bodyHtml, selectedSignature]);

  const loadBootstrap = useCallback(async () => {
    if (!workspaceId) return;
    setStatus("Loading composer...");
    const res = await apiFetch(`/api/email/compose?type=bootstrap&workspace_id=${encodeURIComponent(workspaceId)}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || "Could not load composer.");
    setProfiles(json.profiles || { senders: [], signatures: [] });
    setDrafts(json.drafts || []);
    setSent(json.sent || []);
    setSelectedSenderId(json.profiles?.senders?.[0]?.id || "default");
    setSelectedSignatureId(json.profiles?.signatures?.[0]?.id || "default");
    setStatus("");
  }, [apiFetch, workspaceId]);

  useEffect(() => {
    loadBootstrap().catch((err) => setStatus(err.message || "Could not load composer."));
  }, [loadBootstrap]);

  useEffect(() => {
    if (!selectedSender) return;
    setSenderForm({
      label: selectedSender.label || "",
      fromName: selectedSender.fromName || "",
      fromEmail: selectedSender.fromEmail || "",
      replyTo: selectedSender.replyTo || "",
    });
  }, [selectedSender]);

  useEffect(() => {
    if (!selectedSignature) return;
    const socialLinksText = (selectedSignature.socialLinks || [])
      .map((link) => [link.label, link.url].filter(Boolean).join("|"))
      .join("\n");
    setSignatureForm({
      label: selectedSignature.label || "",
      name: selectedSignature.name || "",
      title: selectedSignature.title || "",
      phone: selectedSignature.phone || "",
      website: selectedSignature.website || "",
      logoUrl: selectedSignature.logoUrl || "",
      avatarUrl: selectedSignature.avatarUrl || "",
      socialLinksText,
      legalFooter: selectedSignature.legalFooter || STANDARD_LEGAL_NOTICE,
    });
  }, [selectedSignature]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== compose.bodyHtml) {
      editorRef.current.innerHTML = compose.bodyHtml || "";
    }
  }, [compose.id]);

  useEffect(() => {
    if (!crmSearch.trim() || !workspaceId) {
      setCrmResults([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/crm/leads?limit=20&search=${encodeURIComponent(crmSearch)}&workspace_id=${encodeURIComponent(workspaceId)}`);
        const json = await res.json().catch(() => ({}));
        setCrmResults(Array.isArray(json.leads) ? json.leads.filter((lead) => isEmail(lead.email)) : []);
      } catch {
        setCrmResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [apiFetch, crmSearch, workspaceId]);

  function updateCompose(patch) {
    setCompose((prev) => ({ ...prev, ...patch }));
  }

  function updateBody() {
    updateCompose({ bodyHtml: editorRef.current?.innerHTML || "" });
  }

  function command(name, value = null) {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    updateBody();
  }

  function addRecipient(group, recipient) {
    const email = String(recipient.email || recipient).trim().toLowerCase();
    if (!isEmail(email)) return;
    setCompose((prev) => {
      const current = prev.recipients[group] || [];
      if (current.some((item) => item.email === email)) return prev;
      return {
        ...prev,
        recipients: {
          ...prev.recipients,
          [group]: [
            ...current,
            {
              email,
              name: recipient.name || "",
              contactId: recipient.contactId || recipient.id || "",
              source: recipient.contactId || recipient.id ? "crm" : "manual",
            },
          ],
        },
      };
    });
    setEntry((prev) => ({ ...prev, [group]: "" }));
    if (recipient.contactId || recipient.id) {
      setCrmSearch("");
      setCrmResults([]);
    }
  }

  function addManualRecipient(group) {
    const raw = entry[group];
    raw
      .split(/[,\s;]+/)
      .map((email) => email.trim())
      .filter(Boolean)
      .forEach((email) => addRecipient(group, email));
  }

  function removeRecipient(group, email) {
    setCompose((prev) => ({
      ...prev,
      recipients: {
        ...prev.recipients,
        [group]: (prev.recipients[group] || []).filter((item) => item.email !== email),
      },
    }));
  }

  async function saveProfiles(nextProfiles = profiles) {
    const res = await apiFetch("/api/email/compose", {
      method: "POST",
      body: JSON.stringify({ action: "saveProfiles", workspace_id: workspaceId, ...nextProfiles }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || "Could not save profiles.");
    setProfiles(json.profiles);
    setStatus("Profiles saved.");
  }

  async function saveSenderProfile() {
    const id = selectedSender?.id || makeId("sender");
    const nextSender = {
      id,
      label: senderForm.label || senderForm.fromName || senderForm.fromEmail || "Sender profile",
      fromName: senderForm.fromName,
      fromEmail: senderForm.fromEmail,
      replyTo: senderForm.replyTo || senderForm.fromEmail,
    };
    if (!isEmail(nextSender.fromEmail)) return setStatus("Enter a valid sender email.");
    const nextProfiles = {
      ...profiles,
      senders: profiles.senders.some((sender) => sender.id === id)
        ? profiles.senders.map((sender) => (sender.id === id ? nextSender : sender))
        : [...profiles.senders, nextSender],
    };
    setProfiles(nextProfiles);
    setSelectedSenderId(id);
    await saveProfiles(nextProfiles);
  }

  async function saveSignatureProfile() {
    const id = selectedSignature?.id || makeId("signature");
    const socialLinks = signatureForm.socialLinksText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, url] = line.split("|").map((part) => part.trim());
        return { label: url ? label : "", url: url || label };
      });
    const nextSignature = {
      id,
      label: signatureForm.label || signatureForm.name || "Signature",
      name: signatureForm.name,
      title: signatureForm.title,
      phone: signatureForm.phone,
      website: signatureForm.website,
      logoUrl: signatureForm.logoUrl,
      avatarUrl: signatureForm.avatarUrl,
      socialLinks,
      legalFooter: signatureForm.legalFooter,
    };
    const nextProfiles = {
      ...profiles,
      signatures: profiles.signatures.some((sig) => sig.id === id)
        ? profiles.signatures.map((sig) => (sig.id === id ? nextSignature : sig))
        : [...profiles.signatures, nextSignature],
    };
    setProfiles(nextProfiles);
    setSelectedSignatureId(id);
    await saveProfiles(nextProfiles);
  }

  async function addAttachments(files) {
    const selected = Array.from(files || []);
    const encoded = await Promise.all(selected.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve({
          id: makeId("file"),
          filename: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          content: result.includes(",") ? result.split(",")[1] : result,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
    updateCompose({ attachments: [...compose.attachments, ...encoded] });
  }

  async function uploadSignatureLogo(file) {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setStatus("Choose an image file for the logo.");
      return;
    }
    setLogoUploading(true);
    setStatus("Uploading logo...");
    try {
      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          resolve(result.includes(",") ? result.split(",")[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiFetch("/api/email/compose", {
        method: "POST",
        body: JSON.stringify({
          action: "uploadLogo",
          workspace_id: workspaceId,
          filename: file.name,
          contentType: file.type || "image/png",
          content,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok || !json.url) throw new Error(json.error || "Logo upload failed.");
      setSignatureForm((prev) => ({ ...prev, logoUrl: json.url }));
      setStatus("Logo uploaded.");
    } catch (err) {
      setStatus(err.message || "Logo upload failed.");
    } finally {
      setLogoUploading(false);
    }
  }

  function buildPayload() {
    return {
      ...compose,
      id: compose.id || makeId("email"),
      sender: selectedSender ? { ...selectedSender, ...senderForm } : senderForm,
      signature: selectedSignature,
      subject: compose.subject,
      previewText: compose.previewText,
      bodyHtml: editorRef.current?.innerHTML || compose.bodyHtml,
      templateName: "",
      preset: "one-off-compose",
      type: "one-off",
    };
  }

  async function saveDraft() {
    setBusy(true);
    setStatus("Saving draft...");
    try {
      const draft = buildPayload();
      const res = await apiFetch("/api/email/compose", {
        method: "POST",
        body: JSON.stringify({ action: "saveDraft", workspace_id: workspaceId, draft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Draft save failed.");
      setCompose((prev) => ({ ...prev, id: json.draft.id, draftId: json.draft.id }));
      setDrafts((prev) => [json.draft, ...prev.filter((item) => item.id !== json.draft.id)]);
      setStatus("Draft saved.");
    } catch (err) {
      setStatus(err.message || "Draft save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendEmailNow(mode = "send") {
    const testTo = mode === "test" ? window.prompt("Send test email to:") : "";
    setBusy(true);
    setStatus(mode === "test" ? "Sending test..." : "Sending email...");
    try {
      const composePayload = buildPayload();
      const res = await apiFetch("/api/email/compose", {
        method: "POST",
        body: JSON.stringify({
          action: "send",
          mode,
          testTo,
          workspace_id: workspaceId,
          compose: composePayload,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Email send failed.");
      setSent((prev) => [json.sent, ...prev.filter((item) => item.id !== json.sent.id)]);
      if (mode === "send") {
        setDrafts((prev) => prev.filter((item) => item.id !== compose.draftId));
        setCompose(EMPTY_COMPOSE);
        if (editorRef.current) editorRef.current.innerHTML = "";
      }
      setStatus(mode === "test" ? "Test email sent." : "Email sent and saved to history.");
    } catch (err) {
      setStatus(err.message || "Email send failed.");
    } finally {
      setBusy(false);
    }
  }

  function loadDraft(draft) {
    setCompose({
      ...EMPTY_COMPOSE,
      ...draft,
      draftId: draft.id,
      recipients: draft.recipients || EMPTY_COMPOSE.recipients,
      attachments: draft.attachments || [],
    });
    setSelectedSenderId(draft.sender?.id || selectedSenderId);
    setSelectedSignatureId(draft.signature?.id || selectedSignatureId);
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = draft.bodyHtml || "";
    }, 0);
    setStatus("Draft loaded.");
  }

  async function deleteDraft(id) {
    const res = await apiFetch("/api/email/compose", {
      method: "POST",
      body: JSON.stringify({ action: "deleteDraft", workspace_id: workspaceId, id }),
    });
    if (res.ok) setDrafts((prev) => prev.filter((draft) => draft.id !== id));
  }

  return (
    <>
      <Head>
        <title>Compose Email - Email Marketing</title>
      </Head>

      <main className="page">
        <header className="banner">
          <div className="banner-left">
            <div className="banner-icon" aria-hidden="true">✉</div>
            <div>
              <h1>Compose Email</h1>
              <p className="banner-subtitle">Send a normal one-off business email.</p>
            </div>
          </div>
          <Link href="/modules/email" className="back">Back to Email</Link>
        </header>

        <section className="layout">
          <aside className="side">
            <section className="panel">
              <h2>Sender</h2>
              <select value={selectedSenderId} onChange={(event) => setSelectedSenderId(event.target.value)}>
                {profiles.senders.map((sender) => (
                  <option key={sender.id} value={sender.id}>{sender.label || sender.fromEmail}</option>
                ))}
              </select>
              <div className="compact-actions">
                <button type="button" className="secondary" onClick={() => setSenderEditorOpen((open) => !open)}>
                  {senderEditorOpen ? "Hide sender details" : "Edit sender"}
                </button>
                <button type="button" className="secondary" onClick={() => {
                  setSelectedSenderId("");
                  setSenderForm({ label: "", fromName: "", fromEmail: "", replyTo: "" });
                  setSenderEditorOpen(true);
                }}>New sender</button>
              </div>
              {senderEditorOpen && (
                <div className="profile-editor">
                  <input value={senderForm.label} onChange={(event) => setSenderForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Profile name" />
                  <input value={senderForm.fromName} onChange={(event) => setSenderForm((prev) => ({ ...prev, fromName: event.target.value }))} placeholder="From name" />
                  <input value={senderForm.fromEmail} onChange={(event) => setSenderForm((prev) => ({ ...prev, fromEmail: event.target.value }))} placeholder="From email" />
                  <input value={senderForm.replyTo} onChange={(event) => setSenderForm((prev) => ({ ...prev, replyTo: event.target.value }))} placeholder="Reply-to email" />
                  <button type="button" onClick={saveSenderProfile}>Save sender</button>
                </div>
              )}
            </section>

            <section className="panel">
              <h2>Signature</h2>
              <select value={selectedSignatureId} onChange={(event) => setSelectedSignatureId(event.target.value)}>
                <option value="none">No signature</option>
                {profiles.signatures.map((sig) => (
                  <option key={sig.id} value={sig.id}>{sig.label || sig.name}</option>
                ))}
              </select>
              <div className="compact-actions">
                <button type="button" className="secondary" onClick={() => setSignatureEditorOpen((open) => !open)}>
                  {signatureEditorOpen ? "Hide signature details" : "Edit signature"}
                </button>
                <button type="button" className="secondary" onClick={() => {
                  setSelectedSignatureId("");
                  setSignatureForm({ label: "", name: "", title: "", phone: "", website: "", logoUrl: "", avatarUrl: "", socialLinksText: "", legalFooter: STANDARD_LEGAL_NOTICE });
                  setSignatureEditorOpen(true);
                }}>New signature</button>
              </div>
              {signatureEditorOpen && (
                <div className="profile-editor">
                  <input value={signatureForm.label} onChange={(event) => setSignatureForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Signature name" />
                  <input value={signatureForm.name} onChange={(event) => setSignatureForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Name" />
                  <input value={signatureForm.title} onChange={(event) => setSignatureForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Title" />
                  <input value={signatureForm.phone} onChange={(event) => setSignatureForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Phone" />
                  <input value={signatureForm.website} onChange={(event) => setSignatureForm((prev) => ({ ...prev, website: event.target.value }))} placeholder="Website" />
                  <div className="logo-upload">
                    {signatureForm.logoUrl ? (
                      <img src={signatureForm.logoUrl} alt="Signature logo preview" />
                    ) : (
                      <div className="logo-empty">Logo</div>
                    )}
                    <div>
                      <label className="file-btn logo-btn">
                        {logoUploading ? "Uploading..." : "Upload logo"}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={logoUploading}
                          onChange={(event) => uploadSignatureLogo(event.target.files?.[0])}
                        />
                      </label>
                      <input
                        value={signatureForm.logoUrl}
                        onChange={(event) => setSignatureForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
                        placeholder="Logo URL"
                      />
                    </div>
                  </div>
                  <textarea value={signatureForm.socialLinksText} onChange={(event) => setSignatureForm((prev) => ({ ...prev, socialLinksText: event.target.value }))} placeholder="Social links: Label|https://..." rows={3} />
                  <div className="legal-head">
                    <span>Legal notice</span>
                    <button type="button" className="secondary" onClick={() => setSignatureForm((prev) => ({ ...prev, legalFooter: STANDARD_LEGAL_NOTICE }))}>
                      Standard notice
                    </button>
                  </div>
                  <textarea value={signatureForm.legalFooter} onChange={(event) => setSignatureForm((prev) => ({ ...prev, legalFooter: event.target.value }))} placeholder="Legal footer" rows={4} />
                  <button type="button" onClick={saveSignatureProfile}>Save signature</button>
                </div>
              )}
            </section>
          </aside>

          <section className="composer">
            <div className="recipients">
              {["to", "cc", "bcc"].map((group) => (
                <div className="recipient-row" key={group}>
                  <label>{group.toUpperCase()}</label>
                  <div className="chips">
                    {(compose.recipients[group] || []).map((recipient) => (
                      <button type="button" className="chip" key={`${group}-${recipient.email}`} onClick={() => removeRecipient(group, recipient.email)}>
                        {recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email} x
                      </button>
                    ))}
                    <input
                      value={entry[group]}
                      onChange={(event) => setEntry((prev) => ({ ...prev, [group]: event.target.value }))}
                      onBlur={() => addManualRecipient(group)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === "," || event.key === ";") {
                          event.preventDefault();
                          addManualRecipient(group);
                        }
                      }}
                      placeholder={`${group.toUpperCase()} recipients`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              className="crm-search"
              onBlur={() => {
                window.setTimeout(() => {
                  setCrmSearch("");
                  setCrmResults([]);
                }, 150);
              }}
            >
              <input value={crmSearch} onChange={(event) => setCrmSearch(event.target.value)} placeholder="Search CRM contacts by name, email or phone" />
              {crmResults.length > 0 && (
                <div className="crm-results">
                  {crmResults.map((lead) => (
                    <button type="button" key={lead.id} onClick={() => addRecipient("to", { id: lead.id, name: lead.name, email: lead.email })}>
                      <span>{lead.name || lead.email}</span>
                      <small>{lead.email}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input className="subject" value={compose.subject} onChange={(event) => updateCompose({ subject: event.target.value })} placeholder="Subject" />
            <input className="preview-text" value={compose.previewText} onChange={(event) => updateCompose({ previewText: event.target.value })} placeholder="Preview text" />

            <div className="toolbar">
              <button type="button" onClick={() => command("bold")}>B</button>
              <button type="button" onClick={() => command("italic")}>I</button>
              <button type="button" onClick={() => command("underline")}>U</button>
              <button type="button" onClick={() => command("insertUnorderedList")}>Bullets</button>
              <button type="button" onClick={() => command("insertOrderedList")}>Numbers</button>
              <button type="button" onClick={() => command("justifyLeft")}>Left</button>
              <button type="button" onClick={() => command("justifyCenter")}>Center</button>
              <button type="button" onClick={() => command("justifyRight")}>Right</button>
              <select onChange={(event) => command("fontSize", event.target.value)} defaultValue="">
                <option value="" disabled>Size</option>
                <option value="2">Small</option>
                <option value="3">Normal</option>
                <option value="4">Large</option>
                <option value="5">XL</option>
              </select>
              <button type="button" onClick={() => {
                const url = window.prompt("Link URL:");
                if (url) command("createLink", url);
              }}>Link</button>
            </div>

            <div
              ref={editorRef}
              className="editor"
              contentEditable
              suppressContentEditableWarning
              onInput={updateBody}
              onBlur={updateBody}
              data-placeholder="Type your email..."
            />

            {selectedSignatureId !== "none" && (
              <div className="signature-preview" dangerouslySetInnerHTML={{ __html: signatureHtml(selectedSignature) }} />
            )}

            <div className="attachments">
              <label className="file-btn">
                Attach files
                <input type="file" multiple onChange={(event) => addAttachments(event.target.files)} />
              </label>
              {compose.attachments.map((file) => (
                <div className="attachment" key={file.id}>
                  <span>{file.filename}</span>
                  <small>{formatBytes(file.size)}</small>
                  <button type="button" onClick={() => updateCompose({ attachments: compose.attachments.filter((item) => item.id !== file.id) })}>Remove</button>
                </div>
              ))}
            </div>

            <div className="actions">
              <button type="button" className="primary" disabled={busy || workspaceLoading} onClick={() => sendEmailNow("send")}>Send now</button>
              <button type="button" disabled={busy || workspaceLoading} onClick={saveDraft}>Save draft</button>
              <button type="button" disabled={busy} onClick={() => setPreviewOpen(true)}>Preview email</button>
              <button type="button" disabled={busy || workspaceLoading} onClick={() => sendEmailNow("test")}>Send test email</button>
            </div>
            {status && <p className="status">{status}</p>}
          </section>

          <aside className="history">
            <section className="panel">
              <h2>Drafts</h2>
              {!drafts.length && <p className="muted">No drafts yet.</p>}
              {drafts.slice(0, 8).map((draft) => (
                <div className="history-row" key={draft.id}>
                  <button type="button" onClick={() => loadDraft(draft)}>
                    <strong>{draft.subject || "Untitled draft"}</strong>
                    <span>{new Date(draft.updatedAt || draft.createdAt).toLocaleString()}</span>
                  </button>
                  <button type="button" className="text-btn" onClick={() => deleteDraft(draft.id)}>Delete</button>
                </div>
              ))}
            </section>
            <section className="panel">
              <h2>Sent history</h2>
              {!sent.length && <p className="muted">No one-off emails sent yet.</p>}
              {sent.slice(0, 10).map((item) => (
                <div className="sent-row" key={item.id}>
                  <strong>{item.subject || "No subject"}</strong>
                  <span>{(item.recipients?.to || []).map((r) => r.email).join(", ")}</span>
                  <small>{new Date(item.sentAt || item.updatedAt).toLocaleString()}</small>
                </div>
              ))}
            </section>
          </aside>
        </section>
      </main>

      {previewOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-inner">
            <div className="modal-head">
              <h2>{compose.subject || "Preview"}</h2>
              <button type="button" onClick={() => setPreviewOpen(false)}>Close</button>
            </div>
            <div className="preview-frame" dangerouslySetInnerHTML={{ __html: renderedPreview }} />
          </div>
        </div>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f4f7fb;
          color: #172033;
          padding: 22px;
        }
        .banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          max-width: 1320px;
          margin: 0 auto 20px;
          padding: 18px 22px;
          border-radius: 14px;
          background: #2563eb;
          border: 2px solid #1d4ed8;
          color: #fff;
        }
        .banner-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }
        .banner-icon {
          width: 69px;
          height: 69px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.16);
          font-size: 48px;
          line-height: 1;
          flex: 0 0 auto;
        }
        h1 {
          margin: 0;
          font-size: 48px;
          font-weight: 600;
          line-height: 1.1;
        }
        .banner-subtitle {
          margin: 4px 0 0;
          font-size: 18px;
          line-height: 1.35;
          opacity: 0.94;
        }
        h2 {
          margin: 0 0 10px;
          font-size: 16px;
        }
        .back {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 8px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          background: rgba(2, 6, 23, 0.35);
          color: #fff;
          text-decoration: none;
          font-size: 18px;
          font-weight: 700;
          white-space: nowrap;
        }
        .layout {
          max-width: 1500px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 300px minmax(0, 1fr) 300px;
          gap: 14px;
          align-items: start;
        }
        .side,
        .history {
          display: grid;
          gap: 12px;
        }
        .panel,
        .composer {
          background: #fff;
          border: 1px solid #dbe4ee;
          border-radius: 8px;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        }
        .panel {
          padding: 14px;
          display: grid;
          gap: 9px;
        }
        .compact-actions,
        .profile-editor {
          display: grid;
          gap: 8px;
        }
        .compact-actions {
          grid-template-columns: 1fr 1fr;
        }
        .logo-upload {
          display: grid;
          grid-template-columns: 64px 1fr;
          gap: 10px;
          align-items: start;
          padding: 10px;
          border: 1px solid #dbe4ee;
          border-radius: 7px;
          background: #f8fafc;
        }
        .logo-upload img,
        .logo-empty {
          width: 64px;
          height: 64px;
          border-radius: 7px;
          border: 1px solid #cbd5e1;
          background: #fff;
        }
        .logo-upload img {
          display: block;
          object-fit: contain;
        }
        .logo-empty {
          display: grid;
          place-items: center;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }
        .logo-upload > div:last-child {
          display: grid;
          gap: 8px;
        }
        .logo-btn {
          width: 100%;
        }
        .legal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: #475569;
          font-size: 13px;
          font-weight: 800;
        }
        .legal-head button {
          width: auto;
          padding: 7px 9px;
          font-size: 13px;
        }
        .composer {
          padding: 0;
          overflow: visible;
        }
        input,
        textarea,
        select {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 10px 11px;
          background: #fff;
          color: #172033;
          outline: none;
        }
        textarea {
          resize: vertical;
        }
        button {
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #172033;
          border-radius: 6px;
          padding: 9px 11px;
          cursor: pointer;
          font-weight: 700;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .primary,
        .panel button:not(.secondary):not(.text-btn) {
          background: #2563eb;
          border-color: #2563eb;
          color: #fff;
        }
        .secondary {
          background: #f8fafc;
        }
        .recipients {
          border-bottom: 1px solid #e2e8f0;
        }
        .recipient-row {
          display: grid;
          grid-template-columns: 52px 1fr;
          gap: 8px;
          align-items: start;
          padding: 9px 14px;
          border-bottom: 1px solid #eef2f7;
        }
        .recipient-row:last-child {
          border-bottom: 0;
        }
        .recipient-row label {
          padding-top: 10px;
          font-size: 12px;
          font-weight: 800;
          color: #64748b;
        }
        .chips {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .chips input {
          border: 0;
          min-width: 180px;
          flex: 1;
          padding-left: 0;
        }
        .chip {
          background: #e0f2fe;
          border-color: #bae6fd;
          color: #075985;
          padding: 6px 8px;
          max-width: 100%;
          overflow-wrap: anywhere;
        }
        .crm-search {
          position: relative;
          padding: 12px 14px;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .crm-results {
          position: absolute;
          left: 14px;
          right: 14px;
          top: 56px;
          z-index: 20;
          background: #fff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          box-shadow: 0 16px 30px rgba(15, 23, 42, 0.16);
          overflow: hidden;
        }
        .crm-results button {
          width: 100%;
          border: 0;
          border-radius: 0;
          text-align: left;
          display: grid;
          gap: 2px;
          border-bottom: 1px solid #eef2f7;
        }
        .crm-results small {
          color: #64748b;
        }
        .subject,
        .preview-text {
          border: 0;
          border-bottom: 1px solid #e2e8f0;
          border-radius: 0;
          padding: 14px;
          font-size: 18px;
        }
        .preview-text {
          font-size: 15px;
          color: #475569;
        }
        .toolbar {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          padding: 10px 14px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .toolbar button,
        .toolbar select {
          width: auto;
          min-height: 36px;
          padding: 7px 10px;
        }
        .editor {
          min-height: 360px;
          padding: 24px;
          outline: none;
          font-size: 16px;
          line-height: 1.65;
        }
        .editor:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
        }
        .signature-preview {
          margin: 0 24px 20px;
          padding-top: 14px;
          border-top: 1px solid #e2e8f0;
        }
        .attachments {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px 14px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .file-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #cbd5e1;
          background: #fff;
          border-radius: 6px;
          padding: 9px 11px;
          font-weight: 700;
          cursor: pointer;
        }
        .file-btn input {
          display: none;
        }
        .attachment {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #dbe4ee;
          background: #fff;
          border-radius: 6px;
          padding: 7px 8px;
        }
        .attachment small,
        .muted,
        .sent-row small,
        .sent-row span,
        .history-row span {
          color: #64748b;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 14px;
          border-top: 1px solid #e2e8f0;
        }
        .status {
          margin: 0;
          padding: 0 14px 14px;
          color: #2563eb;
          font-weight: 700;
        }
        .history-row,
        .sent-row {
          display: grid;
          gap: 4px;
          border: 1px solid #e2e8f0;
          border-radius: 7px;
          padding: 9px;
        }
        .history-row button:first-child {
          border: 0;
          padding: 0;
          text-align: left;
          display: grid;
          gap: 3px;
          background: transparent;
        }
        .text-btn {
          color: #b91c1c;
          background: #fff5f5;
          border-color: #fecaca;
        }
        .modal {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15, 23, 42, 0.62);
          display: grid;
          place-items: center;
          padding: 20px;
        }
        .modal-inner {
          width: min(860px, 100%);
          max-height: 90vh;
          overflow: auto;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.32);
        }
        .modal-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        .preview-frame {
          padding: 28px;
        }
        :global(.sig) {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          color: #172033;
          line-height: 1.5;
        }
        :global(.sig img) {
          width: 56px;
          height: 56px;
          object-fit: cover;
          border-radius: 6px;
        }
        :global(.sig .strong) {
          font-weight: 800;
        }
        :global(.sig .links a) {
          color: #2563eb;
          margin-right: 8px;
          text-decoration: none;
        }
        :global(.sig .legal) {
          margin-top: 8px;
          color: #64748b;
          font-size: 12px;
        }
        @media (max-width: 1180px) {
          .layout {
            grid-template-columns: 1fr;
          }
          .side,
          .history {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 760px) {
          .page {
            padding: 14px;
          }
          .banner,
          .side,
          .history {
            grid-template-columns: 1fr;
          }
          .banner {
            display: grid;
            padding: 16px;
          }
          h1 {
            font-size: 36px;
          }
          .banner-icon {
            width: 56px;
            height: 56px;
            font-size: 38px;
          }
          .recipient-row {
            grid-template-columns: 1fr;
          }
          .editor {
            min-height: 280px;
          }
        }
      `}</style>
    </>
  );
}
